import { Metadata } from "next";
import ApiKeysContent from "@/components/api-keys/api-keys-content";

export const metadata: Metadata = { title: "API Keys" };

export default function ApiKeysPage() {
    return <ApiKeysContent />;
}
