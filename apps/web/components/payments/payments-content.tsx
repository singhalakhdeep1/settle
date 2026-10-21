"use client";

import { useQuery } from "@tanstack/react-query";
import { listPaymentIntents } from "@/lib/api/payments";
import { Card, CardContent, CardHeader, CardTitle } from "@payflow/ui";
import { Badge } from "@payflow/ui";
import { format } from "date-fns";
import Link from "next/link";

export default function PaymentsContent() {
    const { data, isLoading } = useQuery({
        queryKey: ["payments"],
        queryFn: () => listPaymentIntents({ limit: 20 }),
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
                    <p className="text-gray-500 mt-1">All payment intents for your organization</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Payment Intents</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading && <p className="text-sm text-gray-500">Loading...</p>}
                    {data?.data.length === 0 && <p className="text-sm text-gray-500">No payments found.</p>}
                    <div className="divide-y divide-gray-100">
                        {data?.data.map((payment) => (
                            <div key={payment.id} className="flex items-center justify-between py-3">
                                <div>
                                    <Link href={`/payments/${payment.id}` as any} className="text-sm font-medium text-blue-600 hover:underline">
                                        {payment.id.slice(0, 16)}...
                                    </Link>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        {payment.customerId && `Customer: ${payment.customerId} Â· `}
                                        {format(new Date(payment.createdAt), "PPp")}
                                    </p>
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
