import apiClient from "@/lib/api-client";

export interface WebhookEndpoint {
    id: string;
    url: string;
    description?: string;
    events: string[];
    enabled: boolean;
    createdAt: string;
}

export interface WebhookDelivery {
    id: string;
    eventType: string;
    status: string;
    attempts: number;
    lastResponseCode?: number;
    lastResponseBody?: string;
    createdAt: string;
    deliveredAt?: string;
}

export async function listWebhookEndpoints() {
    const res = await apiClient.get<{ data: WebhookEndpoint[] }>("/v1/webhooks/endpoints");
    return res.data;
}

export async function createWebhookEndpoint(data: { url: string; description?: string; events: string[] }) {
    const res = await apiClient.post<{ data: WebhookEndpoint & { secret: string } }>("/v1/webhooks/endpoints", data);
    return res.data;
}

export async function rotateWebhookSecret(id: string) {
    const res = await apiClient.post<{ data: { secret: string } }>(`/v1/webhooks/endpoints/${id}/rotate-secret`);
    return res.data;
}

export async function deleteWebhookEndpoint(id: string) {
    await apiClient.delete(`/v1/webhooks/endpoints/${id}`);
}

export async function listWebhookDeliveries(params?: { page?: number; limit?: number; status?: string }) {
    const res = await apiClient.get<{ data: WebhookDelivery[]; total: number }>("/v1/webhooks/deliveries", { params });
    return res.data;
}
