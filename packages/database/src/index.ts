// Re-export Prisma client singleton for use across apps/api
export { PrismaClient } from "@prisma/client";
export * from "@prisma/client";

import { PrismaClient } from "@prisma/client";

// Set default DATABASE_URL if not provided
if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = "postgresql://payflow:payflow_dev@localhost:5432/payflow_dev";
}

// Set default REDIS_URL if not provided
if (!process.env.REDIS_URL) {
    process.env.REDIS_URL = "redis://localhost:6379";
}

declare global {
    // eslint-disable-next-line no-var
    var __prisma: PrismaClient | undefined;
}

function createPrismaClient() {
    return new PrismaClient({
        log: process.env.NODE_ENV === "development"
            ? ["query", "error", "warn"]
            : ["error"],
    });
}

// Singleton pattern — prevent multiple instances in dev (HMR)
export const prisma: PrismaClient =
    globalThis.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
    globalThis.__prisma = prisma;
}
