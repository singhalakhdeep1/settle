import apiClient from "@/lib/api-client";

export interface ApiKey {
    id: string;
    name: string;
    keyPrefix: string;
    permissions: string[];
    rateLimit: number;
    lastUsedAt?: string;
    expiresAt?: string;
    createdAt: string;
}

export interface CreateApiKeyInput {
    name: string;
    permissions: string[];
    rateLimit?: number;
    expiresAt?: string;
}

export async function listApiKeys() {
    const res = await apiClient.get<{ data: ApiKey[] }>("/v1/api-keys");
    return res.data;
}

export async function createApiKey(data: CreateApiKeyInput) {
    const res = await apiClient.post<{ data: ApiKey & { key: string } }>("/v1/api-keys", data);
    return res.data;
}

export async function revokeApiKey(id: string) {
    await apiClient.delete(`/v1/api-keys/${id}`);
}
