import { z } from "zod";
import { WEBHOOK_EVENT_TYPES } from "../types";

// ─── Create Webhook Endpoint ──────────────────────────────────────────────────

export const CreateWebhookEndpointSchema = z.object({
    url: z
        .string()
        .url("Must be a valid HTTPS URL")
        .refine((url) => url.startsWith("https://"), {
            message: "Webhook URL must use HTTPS",
        }),
    events: z
        .array(z.enum(WEBHOOK_EVENT_TYPES as [string, ...string[]]))
        .min(1, "At least one event type must be selected")
        .max(10, "Cannot subscribe to more than 10 event types"),
    description: z.string().max(200).optional(),
    enabled: z.boolean().default(true),
});

export type CreateWebhookEndpointDto = z.infer<typeof CreateWebhookEndpointSchema>;

// ─── Update Webhook Endpoint ──────────────────────────────────────────────────

export const UpdateWebhookEndpointSchema = z.object({
    url: z
        .string()
        .url("Must be a valid HTTPS URL")
        .refine((url) => url.startsWith("https://"), {
            message: "Webhook URL must use HTTPS",
        })
        .optional(),
    events: z
        .array(z.enum(WEBHOOK_EVENT_TYPES as [string, ...string[]]))
        .min(1)
        .max(10)
        .optional(),
    description: z.string().max(200).optional(),
    enabled: z.boolean().optional(),
});

export type UpdateWebhookEndpointDto = z.infer<typeof UpdateWebhookEndpointSchema>;

// ─── List Webhook Deliveries ──────────────────────────────────────────────────

export const ListWebhookDeliveriesSchema = z.object({
    endpointId: z.string().optional(),
    status: z.enum(["PENDING", "DELIVERED", "FAILED", "DEAD_LETTER"]).optional(),
    eventType: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListWebhookDeliveriesDto = z.infer<typeof ListWebhookDeliveriesSchema>;
