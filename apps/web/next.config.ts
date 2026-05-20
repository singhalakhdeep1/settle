import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    transpilePackages: ["@payflow/ui", "@payflow/shared"],
    experimental: {
        typedRoutes: true,
    },
    images: {
        remotePatterns: [
            { protocol: "https", hostname: "avatars.githubusercontent.com" },
            { protocol: "https", hostname: "lh3.googleusercontent.com" },
        ],
    },
};

export default nextConfig;
