import apiClient from "@/lib/api-client";
import type { PaymentIntentResponse as PaymentIntent, PaginatedResponse } from "@payflow/shared";

export interface CreatePaymentIntentInput {
    amount: string;
    currency: string;
    customerId?: string;
    metadata?: Record<string, string>;
    idempotencyKey: string;
}

export interface ListPaymentIntentsParams {
    page?: number;
    limit?: number;
    status?: string;
    currency?: string;
    customerId?: string;
}

export async function createPaymentIntent(data: CreatePaymentIntentInput, idempotencyKey: string) {
    const res = await apiClient.post<{ data: PaymentIntent }>("/v1/payments", data, {
        headers: { "Idempotency-Key": idempotencyKey },
    });
    return (res as any).data;
}

export async function listPaymentIntents(params?: ListPaymentIntentsParams) {
    return apiClient.get<PaginatedResponse<PaymentIntent>>("/v1/payments", { params: params as Record<string, unknown> });
}

export async function getPaymentIntent(id: string) {
    const res = await apiClient.get<{ data: PaymentIntent }>(`/v1/payments/${id}`);
    return (res as any).data;
}

export async function confirmPaymentIntent(id: string) {
    const res = await apiClient.post<{ data: PaymentIntent }>(`/v1/payments/${id}/confirm`);
    return (res as any).data;
}

export async function cancelPaymentIntent(id: string) {
    const res = await apiClient.delete<{ data: PaymentIntent }>(`/v1/payments/${id}`);
    return (res as any).data;
}
