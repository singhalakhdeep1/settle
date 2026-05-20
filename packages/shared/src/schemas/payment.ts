import { z } from "zod";
import { PaymentIntentStatus } from "../types";

// ─── Create Payment Intent ────────────────────────────────────────────────────

export const CreatePaymentIntentSchema = z.object({
    amount: z
        .number()
        .int("Amount must be an integer (paise)")
        .positive("Amount must be positive")
        .max(100_000_00, "Amount exceeds maximum allowed (₹1,00,000)"),
    currency: z
        .string()
        .length(3, "Currency must be a 3-letter ISO code")
        .toUpperCase()
        .default("INR"),
    description: z.string().max(500).optional(),
    customerId: z.string().max(100).optional(),
    metadata: z
        .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
        .optional()
        .default({}),
    idempotencyKey: z
        .string()
        .min(8, "Idempotency key must be at least 8 characters")
        .max(255)
        .regex(/^[\w\-]+$/, "Idempotency key must be alphanumeric or dashes/underscores"),
});

export type CreatePaymentIntentDto = z.infer<typeof CreatePaymentIntentSchema>;

// ─── Update Payment Intent ────────────────────────────────────────────────────

export const UpdatePaymentIntentSchema = z.object({
    description: z.string().max(500).optional(),
    metadata: z
        .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
        .optional(),
    customerId: z.string().max(100).optional(),
});

export type UpdatePaymentIntentDto = z.infer<typeof UpdatePaymentIntentSchema>;

// ─── Confirm Payment Intent ───────────────────────────────────────────────────

export const ConfirmPaymentIntentSchema = z.object({
    paymentMethodId: z.string().min(1, "Payment method ID is required"),
    returnUrl: z.string().url("Return URL must be a valid URL").optional(),
});

export type ConfirmPaymentIntentDto = z.infer<typeof ConfirmPaymentIntentSchema>;

// ─── Cancel Payment Intent ────────────────────────────────────────────────────

export const CancelPaymentIntentSchema = z.object({
    cancellationReason: z
        .enum([
            "duplicate",
            "fraudulent",
            "requested_by_customer",
            "abandoned",
        ])
        .optional(),
});

export type CancelPaymentIntentDto = z.infer<typeof CancelPaymentIntentSchema>;

// ─── List Payment Intents (query params) ──────────────────────────────────────

export const ListPaymentIntentsSchema = z.object({
    status: z.nativeEnum(PaymentIntentStatus).optional(),
    currency: z.string().length(3).toUpperCase().optional(),
    customerId: z.string().optional(),
    fromDate: z.coerce.date().optional(),
    toDate: z.coerce.date().optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListPaymentIntentsDto = z.infer<typeof ListPaymentIntentsSchema>;

// ─── Payment Intent Response ──────────────────────────────────────────────────

export interface PaymentIntentResponse {
    id: string;
    orgId: string;
    idempotencyKey: string;
    amountPaise: string;        // BigInt serialized as string
    amountFormatted: string;    // "₹999.00"
    currency: string;
    status: PaymentIntentStatus;
    description: string | null;
    customerId: string | null;
    metadata: Record<string, unknown>;
    stripeId: string | null;
    failureReason: string | null;
    capturedAt: string | null;
    cancelledAt: string | null;
    createdAt: string;
    updatedAt: string;
}
