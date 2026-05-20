"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@payflow/ui";
import { Badge } from "@payflow/ui";
import { format } from "date-fns";
import { Search, Shield } from "lucide-react";

const ACTION_COLOR: Record<string, string> = {
    create: "bg-green-100 text-green-700",
    update: "bg-blue-100 text-blue-700",
    delete: "bg-red-100 text-red-700",
    login: "bg-purple-100 text-purple-700",
    logout: "bg-gray-100 text-gray-700",
    payment_captured: "bg-emerald-100 text-emerald-700",
    payment_failed: "bg-red-100 text-red-700",
    webhook_sent: "bg-yellow-100 text-yellow-700",
    api_key_created: "bg-indigo-100 text-indigo-700",
    api_key_revoked: "bg-rose-100 text-rose-700",
};

function ActionBadge({ action }: { action: string }) {
    const cls = ACTION_COLOR[action] ?? "bg-gray-100 text-gray-700";
    return (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
            {action}
        </span>
    );
}

export default function AuditLogContent() {
    const [resourceType, setResourceType] = useState("");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);

    const { data, isLoading } = useQuery({
        queryKey: ["audit-log", resourceType, page],
        queryFn: async () => {
            const res = await apiClient.get("/v1/audit", {
                params: { resourceType: resourceType || undefined, page, pageSize: 50 },
            });
            return res.data;
        },
    });

    const entries: any[] = data?.data ?? [];
    const total: number = data?.total ?? 0;
    const totalPages: number = data?.totalPages ?? 1;

    const filtered = search
        ? entries.filter(
            (e) =>
                e.action?.toLowerCase().includes(search.toLowerCase()) ||
                e.actorEmail?.toLowerCase().includes(search.toLowerCase()) ||
                e.resourceType?.toLowerCase().includes(search.toLowerCase()),
        )
        : entries;

    return (
        <div className="space-y-6">
            <div>
                <div className="flex items-center gap-2">
                    <Shield className="h-6 w-6 text-blue-600" />
                    <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
                </div>
                <p className="text-gray-500 mt-1">
                    Immutable record of all actions taken in your organization
                </p>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search action, actor, resource…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                    />
                </div>
                <select
                    value={resourceType}
                    onChange={(e) => { setResourceType(e.target.value); setPage(1); }}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">All Resources</option>
                    <option value="payment">Payment</option>
                    <option value="webhook">Webhook</option>
                    <option value="api_key">API Key</option>
                    <option value="organization">Organization</option>
                    <option value="user">User</option>
                </select>
                <span className="text-sm text-gray-500 ml-auto">{total.toLocaleString()} entries</span>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Events</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-6 text-sm text-gray-500">Loading…</div>
                    ) : filtered.length === 0 ? (
                        <div className="p-6 text-sm text-gray-500 text-center">No audit events found.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="text-left px-4 py-3 font-medium text-gray-600">Timestamp</th>
                                        <th className="text-left px-4 py-3 font-medium text-gray-600">Actor</th>
                                        <th className="text-left px-4 py-3 font-medium text-gray-600">Action</th>
                                        <th className="text-left px-4 py-3 font-medium text-gray-600">Resource</th>
                                        <th className="text-left px-4 py-3 font-medium text-gray-600">Resource ID</th>
                                        <th className="text-left px-4 py-3 font-medium text-gray-600">IP</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {filtered.map((entry: any) => (
                                        <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">
                                                {entry.createdAt
                                                    ? format(new Date(entry.createdAt), "MMM d, yyyy HH:mm:ss")
                                                    : "—"}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-gray-900 truncate max-w-[160px]">
                                                    {entry.actorEmail ?? entry.actorId ?? "system"}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <ActionBadge action={entry.action} />
                                            </td>
                                            <td className="px-4 py-3 text-gray-600 capitalize">{entry.resourceType}</td>
                                            <td className="px-4 py-3 font-mono text-xs text-gray-400 truncate max-w-[120px]">
                                                {entry.resourceId}
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 text-xs">{entry.ipAddress ?? "—"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between text-sm">
                    <button
                        disabled={page === 1}
                        onClick={() => setPage((p) => p - 1)}
                        className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                    >
                        Previous
                    </button>
                    <span className="text-gray-500">
                        Page {page} of {totalPages}
                    </span>
                    <button
                        disabled={page === totalPages}
                        onClick={() => setPage((p) => p + 1)}
                        className="px-4 py-2 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}
