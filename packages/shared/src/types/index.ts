// ─── Enums (mirror Prisma enums — no Prisma import here for portability) ──────

export enum Plan {
    STARTER = "STARTER",
    GROWTH = "GROWTH",
    ENTERPRISE = "ENTERPRISE",
}

export enum MemberRole {
    OWNER = "OWNER",
    ADMIN = "ADMIN",
    VIEWER = "VIEWER",
}

export enum PaymentIntentStatus {
    REQUIRES_PAYMENT_METHOD = "REQUIRES_PAYMENT_METHOD",
    REQUIRES_CONFIRMATION = "REQUIRES_CONFIRMATION",
    REQUIRES_ACTION = "REQUIRES_ACTION",
    PROCESSING = "PROCESSING",
    REQUIRES_CAPTURE = "REQUIRES_CAPTURE",
    SUCCEEDED = "SUCCEEDED",
    CANCELLED = "CANCELLED",
    FAILED = "FAILED",
}

export enum DeliveryStatus {
    PENDING = "PENDING",
    DELIVERED = "DELIVERED",
    FAILED = "FAILED",
    DEAD_LETTER = "DEAD_LETTER",
}

// ─── API Key Permission ────────────────────────────────────────────────────────

export type ApiKeyPermission =
    | "payments:read"
    | "payments:write"
    | "webhooks:read"
    | "webhooks:write";

export const ALL_PERMISSIONS: ApiKeyPermission[] = [
    "payments:read",
    "payments:write",
    "webhooks:read",
    "webhooks:write",
];

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginationMeta {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
}

export interface PaginatedResponse<T> {
    data: T[];
    meta: PaginationMeta;
}

// ─── API Response wrapper ─────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: unknown;
    };
}

// ─── JWT Payload ──────────────────────────────────────────────────────────────

export interface JwtPayload {
    sub: string;        // userId
    email: string;
    orgId: string;
    role: MemberRole;
    iat: number;
    exp: number;
}

// ─── Webhook event types ──────────────────────────────────────────────────────

export type WebhookEventType =
    | "payment.created"
    | "payment.succeeded"
    | "payment.failed"
    | "payment.cancelled"
    | "payment.processing"
    | "*";

export const WEBHOOK_EVENT_TYPES: WebhookEventType[] = [
    "payment.created",
    "payment.succeeded",
    "payment.failed",
    "payment.cancelled",
    "payment.processing",
];

export interface WebhookEvent {
    id: string;
    type: WebhookEventType;
    created: number;
    data: {
        object: Record<string, unknown>;
        previousAttributes?: Record<string, unknown>;
    };
    orgId: string;
    apiVersion: string;
}
