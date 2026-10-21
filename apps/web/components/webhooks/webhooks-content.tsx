"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listWebhookEndpoints, createWebhookEndpoint, deleteWebhookEndpoint, rotateWebhookSecret } from "@/lib/api/webhooks";
import { Card, CardContent, CardHeader, CardTitle } from "@payflow/ui";
import { Badge } from "@payflow/ui";
import { Button } from "@payflow/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@payflow/ui";
import { Input } from "@payflow/ui";
import { Trash2, RotateCcw, Plus } from "lucide-react";
import { format } from "date-fns";

const AVAILABLE_EVENTS = [
    "payment_intent.created",
    "payment_intent.succeeded",
    "payment_intent.failed",
    "payment_intent.cancelled",
];

export default function WebhooksContent() {
    const qc = useQueryClient();
    const [createOpen, setCreateOpen] = useState(false);
    const [newSecret, setNewSecret] = useState<{ id: string; secret: string } | null>(null);
    const [url, setUrl] = useState("");
    const [description, setDescription] = useState("");
    const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

    const { data: endpoints = [], isLoading } = useQuery({
        queryKey: ["webhook-endpoints"],
        queryFn: listWebhookEndpoints,
    });

    const createMut = useMutation({
        mutationFn: () => createWebhookEndpoint({ url, description, events: selectedEvents }),
        onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: ["webhook-endpoints"] });
            setCreateOpen(false);
            setNewSecret({ id: data.id, secret: data.secret });
        },
    });

    const rotateMut = useMutation({
        mutationFn: (id: string) => rotateWebhookSecret(id),
        onSuccess: (data, id) => {
            setNewSecret({ id, secret: data.secret });
        },
    });

    const deleteMut = useMutation({
        mutationFn: deleteWebhookEndpoint,
        onSuccess: () => qc.invalidateQueries({ queryKey: ["webhook-endpoints"] }),
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Webhooks</h1>
                    <p className="text-gray-500 mt-1">Manage webhook endpoints</p>
                </div>
                <Button onClick={() => setCreateOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add endpoint
                </Button>
            </div>

            {/* New secret reveal */}
            {newSecret && (
                <Card className="border-green-200 bg-green-50">
                    <CardContent className="pt-4">
                        <p className="text-sm font-medium text-green-800 mb-2">
                            âš ï¸ Save this secret now â€” it won&apos;t be shown again.
                        </p>
                        <code className="block text-xs bg-white border rounded px-3 py-2 break-all">{newSecret.secret}</code>
                        <Button size="sm" variant="outline" className="mt-2" onClick={() => setNewSecret(null)}>Dismiss</Button>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader><CardTitle>Endpoints</CardTitle></CardHeader>
                <CardContent>
                    {isLoading && <p className="text-sm text-gray-500">Loading...</p>}
                    {endpoints.length === 0 && !isLoading && <p className="text-sm text-gray-500">No endpoints configured.</p>}
                    <div className="divide-y divide-gray-100">
                        {endpoints.map((ep) => (
                            <div key={ep.id} className="flex items-start justify-between py-4">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{ep.url}</p>
                                    {ep.description && <p className="text-xs text-gray-500">{ep.description}</p>}
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {ep.events.map((e) => <Badge key={e} variant="secondary" className="text-xs">{e}</Badge>)}
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">Created {format(new Date(ep.createdAt), "PP")}</p>
                                </div>
                                <div className="flex gap-2 ml-4 shrink-0">
                                    <Button size="sm" variant="outline" onClick={() => rotateMut.mutate(ep.id)}>
                                        <RotateCcw className="h-3 w-3 mr-1" />Rotate
                                    </Button>
                                    <Button size="sm" variant="destructive" onClick={() => deleteMut.mutate(ep.id)}>
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Create dialog */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Webhook Endpoint</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">URL</label>
                            <Input placeholder="https://example.com/webhook" value={url} onChange={e => setUrl(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Description (optional)</label>
                            <Input placeholder="Production webhook" value={description} onChange={e => setDescription(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">Events</label>
                            <div className="space-y-2">
                                {AVAILABLE_EVENTS.map((event) => (
                                    <label key={event} className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedEvents.includes(event)}
                                            onChange={(e) => {
                                                setSelectedEvents(e.target.checked
                                                    ? [...selectedEvents, event]
                                                    : selectedEvents.filter(ev => ev !== event));
                                            }}
                                        />
                                        {event}
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                        <Button onClick={() => createMut.mutate()} loading={createMut.isPending} disabled={!url || selectedEvents.length === 0}>
                            Create endpoint
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
