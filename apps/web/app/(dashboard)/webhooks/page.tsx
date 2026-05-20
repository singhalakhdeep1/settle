import { Metadata } from "next";
import WebhooksContent from "@/components/webhooks/webhooks-content";

export const metadata: Metadata = { title: "Webhooks" };

export default function WebhooksPage() {
    return <WebhooksContent />;
}
