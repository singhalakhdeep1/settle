"use client";

import { useQuery } from "@tanstack/react-query";
import { getOrgMetrics } from "@/lib/api/organizations";
import { listPaymentIntents } from "@/lib/api/payments";
import { Card, CardContent, CardHeader, CardTitle } from "@payflow/ui";
import { Badge } from "@payflow/ui";
import { TrendingUp, CreditCard, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

export default function DashboardContent() {
    const { data: metrics } = useQuery({
        queryKey: ["org-metrics"],
        queryFn: getOrgMetrics,
    });

    const { data: recentPayments } = useQuery({
        queryKey: ["payments", { limit: 5 }],
        queryFn: () => listPaymentIntents({ limit: 5 }),
    });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-500 mt-1">Overview of your payment activity</p>
            </div>

            {/* Metrics cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics?.monthlyRevenueFormatted ?? "—"}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics?.totalPayments ?? "—"}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics ? `${metrics.successRate}%` : "—"}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Failed Payments</CardTitle>
                        <XCircle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics?.failedPayments ?? "—"}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Recent payments */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Payments</CardTitle>
                </CardHeader>
                <CardContent>
                    {recentPayments?.data.length === 0 && (
                        <p className="text-gray-500 text-sm">No payments yet.</p>
                    )}
                    <div className="divide-y divide-gray-100">
                        {recentPayments?.data.map((payment) => (
                            <div key={payment.id} className="flex items-center justify-between py-3">
                                <div>
                                    <p className="text-sm font-medium">{payment.id}</p>
                                    <p className="text-xs text-gray-500">{format(new Date(payment.createdAt), "PPp")}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-medium">{payment.amountFormatted}</span>
                                    <Badge variant={
                                        payment.status === "SUCCEEDED" ? "success" :
                                            payment.status === "FAILED" ? "destructive" :
                                                payment.status === "PROCESSING" ? "processing" : "secondary"
                                    }>
                                        {payment.status}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
