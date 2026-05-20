import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Inject, Logger } from "@nestjs/common";
import { PrismaClient, DeliveryStatus } from "@payflow/database";
import { PRISMA_TOKEN } from "../database/database.module";
import { WEBHOOK_QUEUE } from "./webhooks.module";
import { WebhooksService } from "./webhooks.service";
import { signWebhookPayload } from "@payflow/shared";
import type { WebhookJobData } from "./webhook-dispatch.service";

@Processor(WEBHOOK_QUEUE)
export class WebhookDeliveryProcessor extends WorkerHost {
    private readonly logger = new Logger(WebhookDeliveryProcessor.name);

    // Retry delays matching .env.example: 30s, 2m, 10m, 1h, 24h
    private readonly RETRY_DELAYS_MS = [30_000, 120_000, 600_000, 3_600_000, 86_400_000];

    constructor(
        @Inject(PRISMA_TOKEN) private readonly prisma: PrismaClient,
        private readonly webhooksService: WebhooksService,
    ) {
        super();
    }

    async process(job: Job<WebhookJobData>): Promise<void> {
        const { deliveryId, endpointId, url, payload, attempt } = job.data;

        const delivery = await this.prisma.webhookDelivery.findUnique({ where: { id: deliveryId } });
        if (!delivery) {
            this.logger.warn(`Delivery ${deliveryId} not found — skipping`);
            return;
        }

        if (delivery.status === DeliveryStatus.DELIVERED || delivery.status === DeliveryStatus.DEAD_LETTER) {
            return; // Already resolved
        }

        // Get the webhook secret for HMAC signing
        const secret = await this.webhooksService.getDecryptedSecret(endpointId);
        const timestamp = Math.floor(Date.now() / 1000);
        const { signature } = signWebhookPayload(payload, secret, timestamp);

        let responseCode: number | null = null;
        let responseBody: string | null = null;
        let success = false;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10_000);

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Payflow-Signature": signature,
                    "Payflow-Timestamp": String(timestamp),
                    "User-Agent": "PayFlow-Webhooks/1.0",
                },
                body: payload,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);
            responseCode = response.status;
            responseBody = (await response.text()).slice(0, 1000); // Truncate large responses
            success = response.ok;
        } catch (err) {
            const message = err instanceof Error ? err.message : "Unknown error";
            responseBody = message;
            this.logger.warn(`Webhook delivery ${deliveryId} attempt ${attempt + 1} failed: ${message}`);
        }

        const newAttempts = delivery.attempts + 1;
        const isLastAttempt = newAttempts >= delivery.maxAttempts;

        if (success) {
            await this.prisma.webhookDelivery.update({
                where: { id: deliveryId },
                data: {
                    status: DeliveryStatus.DELIVERED,
                    attempts: newAttempts,
                    lastResponseCode: responseCode,
                    lastResponseBody: responseBody,
                    deliveredAt: new Date(),
                    nextRetryAt: null,
                },
            });
            this.logger.log(`Webhook delivery ${deliveryId} succeeded (HTTP ${responseCode})`);
        } else {
            const nextDelay = this.RETRY_DELAYS_MS[attempt] ?? this.RETRY_DELAYS_MS[this.RETRY_DELAYS_MS.length - 1]!;
            const nextRetryAt = isLastAttempt ? null : new Date(Date.now() + nextDelay);

            await this.prisma.webhookDelivery.update({
                where: { id: deliveryId },
                data: {
                    status: isLastAttempt ? DeliveryStatus.DEAD_LETTER : DeliveryStatus.FAILED,
                    attempts: newAttempts,
                    lastResponseCode: responseCode,
                    lastResponseBody: responseBody,
                    nextRetryAt,
                },
            });

            if (isLastAttempt) {
                this.logger.error(`Webhook delivery ${deliveryId} moved to dead-letter queue after ${newAttempts} attempts`);
            } else {
                // Re-throw to trigger BullMQ retry with delay
                throw new Error(`Delivery failed (HTTP ${responseCode ?? "network error"}), retrying in ${nextDelay / 1000}s`);
            }
        }
    }
}
