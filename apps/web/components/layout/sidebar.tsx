"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    CreditCard,
    Webhook,
    Key,
    Settings,
    Building2,
} from "lucide-react";
import { cn } from "@payflow/shared";

const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/payments", label: "Payments", icon: CreditCard },
    { href: "/webhooks", label: "Webhooks", icon: Webhook },
    { href: "/api-keys", label: "API Keys", icon: Key },
    { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <div className="w-64 bg-slate-900 text-white flex flex-col">
            <div className="p-6 flex items-center gap-2 border-b border-slate-700">
                <Building2 className="h-6 w-6 text-blue-400" />
                <span className="text-lg font-bold">PayFlow</span>
            </div>

            <nav className="flex-1 p-4 space-y-1">
                {navItems.map(({ href, label, icon: Icon }) => (
                    <Link
                        key={href}
                        href={href}
                        className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                            pathname === href || pathname.startsWith(href + "/")
                                ? "bg-blue-600 text-white"
                                : "text-slate-300 hover:bg-slate-800 hover:text-white",
                        )}
                    >
                        <Icon className="h-4 w-4" />
                        {label}
                    </Link>
                ))}
            </nav>
        </div>
    );
}
