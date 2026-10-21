import {
    Injectable,
    Inject,
    NotFoundException,
    ConflictException,
    BadRequestException,
    UnprocessableEntityException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient, PaymentIntentStatus } from "@payflow/database";
import {
    CreatePaymentIntentDto,
    UpdatePaymentIntentDto,
    ConfirmPaymentIntentDto,
    CancelPaymentIntentDto,
    ListPaymentIntentsDto,
    formatMoney,
    paise_to_string,
} from "@payflow/shared";
import { PRISMA_TOKEN } from "../database/database.module";
import { AuditService } from "../audit/audit.service";
import { WebhookDispatchService } from "../webhooks/webhook-dispatch.service";
import Stripe from "stripe";

@Injectable()
export class PaymentsService {
    private readonly stripe: Stripe;

    constructor(
        @Inject(PRISMA_TOKEN) private readonly prisma: PrismaClient,
        private readonly config: ConfigService,
        private readonly audit: AuditService,
        private readonly webhookDispatch: WebhookDispatchService,
    ) {
        this.stripe = new Stripe(this.config.get<string>("app.stripe.secretKey")!, {
            apiVersion: "2025-04-30.basil" as Stripe.LatestApiVersion,
        });
    }

    async create(
        orgId: string,
        dto: CreatePaymentIntentDto,
        idempotencyKey: string,
        actorId?: string,
        actorEmail?: string,
        ipAddress?: string,
    ) {
        // ── Idempotency check ─────────────────────────────────────────────────
        const existing = await this.prisma.paymentIntent.findUnique({
            where: { orgId_idempotencyKey: { orgId, idempotencyKey } },
        });

        if (existing) {
            // Return cached response — same request, same result
            return this.serialize(existing);
        }

        // ── Create Stripe PaymentIntent ────────────────────────────────────────
        const stripeIntent = await this.stripe.paymentIntents.create(
            {
                amount: dto.amount,
                currency: dto.currency.toLowerCase(),
                description: dto.description,
                metadata: {
                    orgId,
                    idempotencyKey,
                    customerId: dto.customerId ?? "",
                    ...dto.metadata,
                },
            },
            { idempotencyKey: `${orgId}:${idempotencyKey}` },
        );

        // ── Persist ────────────────────────────────────────────────────────────
        const intent = await this.prisma.paymentIntent.create({
            data: {
                orgId,
                idempotencyKey,
                amountPaise: BigInt(dto.amount),
                currency: dto.currency,
                description: dto.description,
                customerId: dto.customerId,
                metadata: dto.metadata as object,
                stripeId: stripeIntent.id,
                status: PaymentIntentStatus.REQUIRES_PAYMENT_METHOD,
            },
        });

        await this.audit.log({
            orgId,
            actorId,
            actorEmail,
            action: "payment.created",
            resourceType: "payment_intent",
            resourceId: intent.id,
            after: { status: intent.status, amountPaise: intent.amountPaise.toString() },
            ipAddress,
        });

        await this.webhookDispatch.dispatch(orgId, "payment.created", this.serialize(intent));

        return this.serialize(intent);
    }

    async findAll(orgId: string, dto: ListPaymentIntentsDto) {
        const { status, currency, customerId, fromDate, toDate, page, pageSize } = dto;
        const skip = (page - 1) * pageSize;

        const where = {
            orgId,
            ...(status ? { status } : {}),
            ...(currency ? { currency } : {}),
            ...(customerId ? { customerId } : {}),
            ...(fromDate || toDate
                ? { createdAt: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } }
                : {}),
        };

        const [data, total] = await Promise.all([
            this.prisma.paymentIntent.findMany({
                where,
                orderBy: { createdAt: "desc" },
                take: pageSize,
                skip,
            }),
            this.prisma.paymentIntent.count({ where }),
        ]);

        return {
            data: data.map((i) => this.serialize(i)),
            meta: {
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
                hasNextPage: page * pageSize < total,
                hasPrevPage: page > 1,
            },
        };
    }

    async findOne(orgId: string, id: string) {
        const intent = await this.prisma.paymentIntent.findFirst({
            where: { id, orgId },
        });
        if (!intent) throw new NotFoundException(`Payment intent ${id} not found`);
        return this.serialize(intent);
    }

    async update(orgId: string, id: string, dto: UpdatePaymentIntentDto, actorId?: string, actorEmail?: string) {
        const intent = await this.prisma.paymentIntent.findFirst({ where: { id, orgId } });
        if (!intent) throw new NotFoundException(`Payment intent ${id} not found`);

        if (intent.status === PaymentIntentStatus.SUCCEEDED || intent.status === PaymentIntentStatus.CANCELLED) {
            throw new BadRequestException(`Cannot update a ${intent.status.toLowerCase()} payment intent`);
        }

        const updated = await this.prisma.paymentIntent.update({
            where: { id },
            data: {
                ...(dto.description !== undefined ? { description: dto.description } : {}),
                ...(dto.customerId !== undefined ? { customerId: dto.customerId } : {}),
                ...(dto.metadata !== undefined ? { metadata: dto.metadata as object } : {}),
            },
        });

        await this.audit.log({
            orgId,
            actorId,
            actorEmail,
            action: "payment.updated",
            resourceType: "payment_intent",
            resourceId: id,
            before: { description: intent.description, customerId: intent.customerId },
            after: { description: updated.description, customerId: updated.customerId },
        });

        return this.serialize(updated);
    }

    async confirm(orgId: string, id: string, dto: ConfirmPaymentIntentDto, actorId?: string, actorEmail?: string) {
        const intent = await this.prisma.paymentIntent.findFirst({ where: { id, orgId } });
        if (!intent) throw new NotFoundException(`Payment intent ${id} not found`);

        if (intent.status !== PaymentIntentStatus.REQUIRES_PAYMENT_METHOD) {
            throw new UnprocessableEntityException(
                `Cannot confirm a payment intent with status: ${intent.status}`,
            );
        }

        // Confirm via Stripe
        if (intent.stripeId) {
            await this.stripe.paymentIntents.confirm(intent.stripeId, {
                payment_method: dto.paymentMethodId,
                return_url: dto.returnUrl,
            });
        }

        const updated = await this.prisma.paymentIntent.update({
            where: { id },
            data: { status: PaymentIntentStatus.PROCESSING },
        });

        await this.audit.log({
            orgId, actorId, actorEmail,
            action: "payment.confirmed",
            resourceType: "payment_intent",
            resourceId: id,
            before: { status: intent.status },
            after: { status: updated.status },
        });

        return this.serialize(updated);
    }

    async cancel(orgId: string, id: string, dto: CancelPaymentIntentDto, actorId?: string, actorEmail?: string) {
        const intent = await this.prisma.paymentIntent.findFirst({ where: { id, orgId } });
        if (!intent) throw new NotFoundException(`Payment intent ${id} not found`);

        const cancellableStatuses: PaymentIntentStatus[] = [
            PaymentIntentStatus.REQUIRES_PAYMENT_METHOD,
            PaymentIntentStatus.REQUIRES_CONFIRMATION,
            PaymentIntentStatus.REQUIRES_ACTION,
        ];

        if (!cancellableStatuses.includes(intent.status)) {
            throw new UnprocessableEntityException(
                `Cannot cancel a payment intent with status: ${intent.status}`,
            );
        }

        if (intent.stripeId) {
            await this.stripe.paymentIntents.cancel(intent.stripeId, {
                cancellation_reason: dto.cancellationReason ?? "requested_by_customer",
            });
        }

        const updated = await this.prisma.paymentIntent.update({
            where: { id },
            data: {
                status: PaymentIntentStatus.CANCELLED,
                cancelledAt: new Date(),
            },
        });

        await this.audit.log({
            orgId, actorId, actorEmail,
            action: "payment.cancelled",
            resourceType: "payment_intent",
            resourceId: id,
            before: { status: intent.status },
            after: { status: updated.status, cancelledAt: updated.cancelledAt },
        });

        await this.webhookDispatch.dispatch(orgId, "payment.cancelled", this.serialize(updated));

        return this.serialize(updated);
    }

    serialize(intent: {
        id: string;
        orgId: string;
        idempotencyKey: string;
        amountPaise: bigint;
        currency: string;
        status: PaymentIntentStatus;
        description: string | null;
        customerId: string | null;
        metadata: unknown;
        stripeId: string | null;
        failureReason: string | null;
        capturedAt: Date | null;
        cancelledAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }) {
        return {
            id: intent.id,
            orgId: intent.orgId,
            idempotencyKey: intent.idempotencyKey,
            amountPaise: paise_to_string(intent.amountPaise),
            amountFormatted: formatMoney(intent.amountPaise, intent.currency),
            currency: intent.currency,
            status: intent.status,
            description: intent.description,
            customerId: intent.customerId,
            metadata: intent.metadata,
            stripeId: intent.stripeId,
            failureReason: intent.failureReason,
            capturedAt: intent.capturedAt?.toISOString() ?? null,
            cancelledAt: intent.cancelledAt?.toISOString() ?? null,
            createdAt: intent.createdAt.toISOString(),
            updatedAt: intent.updatedAt.toISOString(),
        };
    }
}
