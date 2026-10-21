import {
    Controller,
    Post,
    Headers,
    RawBodyRequest,
    Req,
    BadRequestException,
    Inject,
    Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";
import Stripe from "stripe";
import { PrismaClient } from "@payflow/database";
import { PRISMA_TOKEN } from "../database/database.module";
import { WebhookDispatchService } from "../webhooks/webhook-dispatch.service";
import { PaymentIntentStatus } from "@payflow/shared";
import { formatMoney } from "@payflow/shared";
import { ApiExcludeController } from "@nestjs/swagger";

@ApiExcludeController()
@Controller({ path: "stripe-webhook", version: false as unknown as string })
export class StripeWebhookController {
    private readonly logger = new Logger(StripeWebhookController.name);
    private readonly stripe: Stripe;

    constructor(
        private readonly config: ConfigService,
        @Inject(PRISMA_TOKEN) private readonly prisma: PrismaClient,
        private readonly webhookDispatch: WebhookDispatchService,
    ) {
        this.stripe = new Stripe(config.get<string>("app.stripe.secretKey")!, {
            apiVersion: "2025-04-30.basil" as Stripe.LatestApiVersion,
        });
    }

    @Post()
    async handleWebhook(
        @Req() req: RawBodyRequest<Request>,
        @Headers("stripe-signature") sig: string,
    ) {
        const webhookSecret = this.config.get<string>("app.stripe.webhookSecret");
        if (!webhookSecret) {
            this.logger.warn("STRIPE_WEBHOOK_SECRET not configured — skipping verification");
            return { received: true };
        }

        const rawBody = req.rawBody;
        if (!rawBody) {
            throw new BadRequestException("Missing raw body");
        }

        let event: Stripe.Event;
        try {
            event = this.stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Signature verification failed";
            this.logger.warn(`Stripe webhook signature verification failed: ${msg}`);
            throw new BadRequestException(`Webhook signature verification failed: ${msg}`);
        }

        await this.processEvent(event);
        return { received: true };
    }

    private async processEvent(event: Stripe.Event) {
        switch (event.type) {
            case "payment_intent.succeeded":
                await this.handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
                break;
            case "payment_intent.payment_failed":
                await this.handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
                break;
            case "payment_intent.canceled":
                await this.handlePaymentCanceled(event.data.object as Stripe.PaymentIntent);
                break;
            default:
                this.logger.debug(`Unhandled Stripe event: ${event.type}`);
        }
    }

    private async handlePaymentSucceeded(pi: Stripe.PaymentIntent) {
        const payment = await this.prisma.paymentIntent.findFirst({
            where: { stripeId: pi.id },
        });
        if (!payment) {
            this.logger.warn(`PaymentIntent not found for Stripe id: ${pi.id}`);
            return;
        }

        await this.prisma.paymentIntent.update({
            where: { id: payment.id },
            data: {
                status: PaymentIntentStatus.SUCCEEDED,
                capturedAt: new Date(),
            },
        });

        await this.webhookDispatch.dispatch(payment.orgId, "payment.succeeded", {
            id: payment.id,
            amount: payment.amountPaise.toString(),
            amountFormatted: formatMoney(payment.amountPaise, payment.currency),
            currency: payment.currency,
            status: PaymentIntentStatus.SUCCEEDED,
            stripeId: pi.id,
        });

        this.logger.log(`PaymentIntent ${payment.id} marked SUCCEEDED`);
    }

    private async handlePaymentFailed(pi: Stripe.PaymentIntent) {
        const payment = await this.prisma.paymentIntent.findFirst({
            where: { stripeId: pi.id },
        });
        if (!payment) return;

        const failureReason = pi.last_payment_error?.message ?? "Payment failed";

        await this.prisma.paymentIntent.update({
            where: { id: payment.id },
            data: {
                status: PaymentIntentStatus.FAILED,
                failureReason,
            },
        });

        await this.webhookDispatch.dispatch(payment.orgId, "payment.failed", {
            id: payment.id,
            amount: payment.amountPaise.toString(),
            currency: payment.currency,
            status: PaymentIntentStatus.FAILED,
            failureReason,
            stripeId: pi.id,
        });

        this.logger.log(`PaymentIntent ${payment.id} marked FAILED`);
    }

    private async handlePaymentCanceled(pi: Stripe.PaymentIntent) {
        const payment = await this.prisma.paymentIntent.findFirst({
            where: { stripeId: pi.id },
        });
        if (!payment) return;

        await this.prisma.paymentIntent.update({
            where: { id: payment.id },
            data: { status: PaymentIntentStatus.CANCELLED },
        });

        this.logger.log(`PaymentIntent ${payment.id} marked CANCELLED`);
    }
}
