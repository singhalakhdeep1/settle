import apiClient from "@/lib/api-client";

export interface OrgMetrics {
    totalPayments: number;
    successfulPayments: number;
    failedPayments: number;
    successRate: number;
    monthlyRevenuePaise: string;
    monthlyRevenueFormatted: string;
}

export interface OrgMember {
    id: string;
    role: string;
    user: { id: string; email: string; fullName: string; avatarUrl?: string };
}

export async function getOrg() {
    const res = await apiClient.get<{ id: string; name: string; slug: string; plan: string; members: OrgMember[] }>("/v1/organizations/me");
    return res.data;
}

export async function getOrgMetrics() {
    const res = await apiClient.get<OrgMetrics>("/v1/organizations/me/metrics");
    return res.data;
}

export async function inviteMember(data: { email: string; role: string }) {
    const res = await apiClient.post<OrgMember>("/v1/organizations/me/members", data);
    return res.data;
}

export async function removeMember(memberId: string) {
    await apiClient.delete(`/v1/organizations/me/members/${memberId}`);
}
