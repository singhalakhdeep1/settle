"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { getOrg, inviteMember, removeMember } from "@/lib/api/organizations";
import { Card, CardContent, CardHeader, CardTitle } from "@payflow/ui";
import { Button } from "@payflow/ui";
import { Badge } from "@payflow/ui";
import { Input } from "@payflow/ui";
import { useToast } from "@payflow/ui";
import { UserPlus, Trash2, Building2, CreditCard } from "lucide-react";

const ROLE_OPTIONS = ["VIEWER", "ADMIN", "OWNER"] as const;

export default function SettingsContent() {
    const { data: session } = useSession();
    const qc = useQueryClient();
    const { toast } = useToast();

    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState<string>("VIEWER");

    const { data: org, isLoading } = useQuery({
        queryKey: ["org"],
        queryFn: getOrg,
    });

    const inviteMut = useMutation({
        mutationFn: () => inviteMember({ email: inviteEmail.trim(), role: inviteRole }),
        onSuccess: () => {
            toast({ title: "Invitation sent", description: `${inviteEmail} has been invited as ${inviteRole}.` });
            setInviteEmail("");
            qc.invalidateQueries({ queryKey: ["org"] });
        },
        onError: () => {
            toast({ title: "Failed to invite member", variant: "destructive" });
        },
    });

    const removeMut = useMutation({
        mutationFn: (memberId: string) => removeMember(memberId),
        onSuccess: () => {
            toast({ title: "Member removed" });
            qc.invalidateQueries({ queryKey: ["org"] });
        },
        onError: () => {
            toast({ title: "Failed to remove member", variant: "destructive" });
        },
    });

    const currentUserId = (session?.user as { id?: string } | undefined)?.id;
    const currentMember = org?.members?.find((m) => m.user.id === currentUserId);
    const isOwner = currentMember?.role === "OWNER";

    if (isLoading) {
        return <div className="p-8 text-sm text-gray-500">Loading settings…</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                <p className="text-gray-500 mt-1">Manage your organization and team</p>
            </div>

            {/* Organization info */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        Organization
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Name</span>
                        <span className="font-medium">{org?.name ?? "—"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Slug</span>
                        <span className="font-mono text-sm text-gray-700">{org?.slug ?? "—"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600 flex items-center gap-1">
                            <CreditCard className="h-4 w-4" />
                            Plan
                        </span>
                        <Badge variant={org?.plan === "ENTERPRISE" ? "default" : "secondary"}>
                            {org?.plan ?? "FREE"}
                        </Badge>
                    </div>
                </CardContent>
            </Card>

            {/* Members */}
            <Card>
                <CardHeader>
                    <CardTitle>Team Members</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="divide-y divide-gray-100">
                        {org?.members?.map((member) => (
                            <div key={member.id} className="flex items-center justify-between py-3">
                                <div>
                                    <p className="text-sm font-medium text-gray-900">{member.user.fullName}</p>
                                    <p className="text-xs text-gray-500">{member.user.email}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Badge variant={member.role === "OWNER" ? "default" : "secondary"}>
                                        {member.role}
                                    </Badge>
                                    {isOwner && member.user.id !== currentUserId && (
                                        <button
                                            onClick={() => removeMut.mutate(member.id)}
                                            disabled={removeMut.isPending}
                                            className="text-red-500 hover:text-red-700 disabled:opacity-50"
                                            aria-label={`Remove ${member.user.fullName}`}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Invite form */}
                    {isOwner && (
                        <div className="pt-4 border-t border-gray-100">
                            <p className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                                <UserPlus className="h-4 w-4" />
                                Invite member
                            </p>
                            <div className="flex gap-2">
                                <Input
                                    type="email"
                                    placeholder="colleague@company.com"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    className="flex-1"
                                />
                                <select
                                    value={inviteRole}
                                    onChange={(e) => setInviteRole(e.target.value)}
                                    className="rounded-md border border-input px-3 py-2 text-sm bg-background"
                                >
                                    {ROLE_OPTIONS.map((r) => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </select>
                                <Button
                                    onClick={() => inviteMut.mutate()}
                                    disabled={!inviteEmail.trim() || inviteMut.isPending}
                                    isLoading={inviteMut.isPending}
                                >
                                    Invite
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
