import { Suspense } from "react";
import SettingsContent from "@/components/settings/settings-content";

export const metadata = { title: "Settings | PayFlow" };

export default function SettingsPage() {
    return (
        <Suspense fallback={<div className="p-8 text-sm text-gray-500">Loading settings…</div>}>
            <SettingsContent />
        </Suspense>
    );
}
