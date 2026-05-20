"use client";

import { signOut } from "next-auth/react";
import { LogOut, User } from "lucide-react";
import { Button } from "@payflow/ui";

interface HeaderProps {
    user: { name?: string | null; email?: string | null };
}

export default function Header({ user }: HeaderProps) {
    return (
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div />
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                    <User className="h-4 w-4" />
                    <span>{user.name ?? user.email}</span>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                >
                    <LogOut className="h-4 w-4 mr-1" />
                    Sign out
                </Button>
            </div>
        </header>
    );
}
