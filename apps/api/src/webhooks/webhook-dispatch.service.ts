import { Injectable, Inject, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { PrismaClient, DeliveryStatus, WebhookEventType } from "@payflow/database";
import { PRISMA_TOKEN } from "../database/database.module";
import { WEBHOOK_QUEUE } from "./webhooks.module";
import { v4 as uuidv4 } from "uuid";

export interface WebhookJobData {
    deliveryId: string;
    endpointId: string;
    url: string;
    payload: string;  // JSON string
    attempt: number;
}

@Injectable()
export class WebhookDispatchService {
    private readonly logger = new Logger(WebhookDispatchService.name);

    // Retry delays in seconds: 30s, 2m, 10m, 1h, 24h
    private readonly RETRY_DELAYS = [30, 120, 600, 3600, 86400];
    private readonly MAX_ATTEMPTS = 5;

    constructor(
        @Inject(PRISMA_TOKEN) private readonly prisma: PrismaClient,
        @InjectQueue(WEBHOOK_QUEUE) private readonly queue: Queue,
    ) {}

    async dispatch(orgId: string, eventType: string, data: Record<string, unknown>) {
        const event = {
            id: uuidv4(),
            type: eventType,
            created: Math.floor(Date.now() / 1000),
            apiVersion: "2025-01-01",
            orgId,
            data: { object: data },
        };

        const payload = JSON.stringify(event);

        // Find all enabled endpoints subscribed to this event
        const endpoints = await this.prisma.webhookEndpoint.findMany({
            where: {
                orgId,
                enabled: true,
                OR: [
                    { events: { has: eventType } },
                    { events: { has: "*" } },
                ],
            },
        });

        for (const endpoint of endpoints) {
            const delivery = await this.prisma.webhookDelivery.create({
                data: {
                    endpointId: endpoint.id,
                    eventType,
                    payload: event,
                    status: DeliveryStatus.PENDING,
                    maxAttempts: this.MAX_ATTEMPTS,
                    nextRetryAt: new Date(),
                },
            });

            const job = await this.queue.add(
                "deliver",
                {
                    deliveryId: delivery.id,
                    endpointId: endpoint.id,
                    url: endpoint.url,
                    payload,
                    attempt: 0,
                } satisfies WebhookJobData,
                {
                    attempts: this.MAX_ATTEMPTS,
                    backoff: {
                        type: "custom",
                    },
                    removeOnComplete: 1000,
                    removeOnFail: 5000,
                },
            );

            // Save BullMQ job ID
            await this.prisma.webhookDelivery.update({
                where: { id: delivery.id },
                data: { bullJobId: job.id },
            });

            this.logger.log(`Queued webhook delivery ${delivery.id} for endpoint ${endpoint.id}`);
        }
    }
}
