"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listApiKeys, createApiKey, revokeApiKey } from "@/lib/api/api-keys";
import { Card, CardContent, CardHeader, CardTitle } from "@payflow/ui";
import { Button } from "@payflow/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@payflow/ui";
import { Input } from "@payflow/ui";
import { Trash2, Plus } from "lucide-react";
import { format } from "date-fns";

const ALL_PERMISSIONS = [
    "payments:read",
    "payments:write",
    "webhooks:read",
    "webhooks:write",
];

export default function ApiKeysContent() {
    const qc = useQueryClient();
    const [createOpen, setCreateOpen] = useState(false);
    const [revealedKey, setRevealedKey] = useState<string | null>(null);
    const [name, setName] = useState("");
    const [selectedPerms, setSelectedPerms] = useState<string[]>(["payments:read"]);

    const { data: keys = [], isLoading } = useQuery({
        queryKey: ["api-keys"],
        queryFn: listApiKeys,
    });

    const createMut = useMutation({
        mutationFn: () => createApiKey({ name, permissions: selectedPerms }),
        onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: ["api-keys"] });
            setCreateOpen(false);
            setName("");
            setSelectedPerms(["payments:read"]);
            setRevealedKey(data.key);
        },
    });

    const revokeMut = useMutation({
        mutationFn: revokeApiKey,
        onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] }),
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
                    <p className="text-gray-500 mt-1">Manage programmatic access keys</p>
                </div>
                <Button onClick={() => setCreateOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Create API key
                </Button>
            </div>

            {/* Key reveal */}
            {revealedKey && (
                <Card className="border-amber-200 bg-amber-50">
                    <CardContent className="pt-4">
                        <p className="text-sm font-medium text-amber-800 mb-2">
                            ⚠️ Save this API key — it won&apos;t be shown again.
                        </p>
                        <code className="block text-xs bg-white border rounded px-3 py-2 break-all">{revealedKey}</code>
                        <Button size="sm" variant="outline" className="mt-2" onClick={() => setRevealedKey(null)}>Dismiss</Button>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader><CardTitle>Active Keys</CardTitle></CardHeader>
                <CardContent>
                    {isLoading && <p className="text-sm text-gray-500">Loading...</p>}
                    {keys.length === 0 && !isLoading && <p className="text-sm text-gray-500">No API keys yet.</p>}
                    <div className="divide-y divide-gray-100">
                        {keys.map((key) => (
                            <div key={key.id} className="flex items-center justify-between py-3">
                                <div>
                                    <p className="text-sm font-medium">{key.name}</p>
                                    <code className="text-xs text-gray-500">{key.keyPrefix}••••••••••••</code>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        Created {format(new Date(key.createdAt), "PP")}
                                        {key.lastUsedAt && ` · Last used ${format(new Date(key.lastUsedAt), "PP")}`}
                                    </p>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {key.permissions.map(p => (
                                            <span key={p} className="text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">{p}</span>
                                        ))}
                                    </div>
                                </div>
                                <Button size="sm" variant="destructive" onClick={() => revokeMut.mutate(key.id)}>
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    Revoke
                                </Button>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create API Key</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Key name</label>
                            <Input placeholder="Production API key" value={name} onChange={e => setName(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">Permissions</label>
                            <div className="space-y-2">
                                {ALL_PERMISSIONS.map((perm) => (
                                    <label key={perm} className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedPerms.includes(perm)}
                                            onChange={(e) => {
                                                setSelectedPerms(e.target.checked
                                                    ? [...selectedPerms, perm]
                                                    : selectedPerms.filter(p => p !== perm));
                                            }}
                                        />
                                        {perm}
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                        <Button onClick={() => createMut.mutate()} isLoading={createMut.isPending} disabled={!name}>
                            Create key
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
