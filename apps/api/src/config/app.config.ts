import { registerAs } from "@nestjs/config";

export default registerAs("app", () => ({
    env: process.env.NODE_ENV ?? "development",
    port: parseInt(process.env.API_PORT ?? "4000", 10),
    webUrl: process.env.WEB_URL ?? "http://localhost:3000",
    apiUrl: process.env.API_URL ?? "http://localhost:4000",

    database: {
        url: process.env.DATABASE_URL ?? "postgresql://payflow:payflow_dev@localhost:5432/payflow_dev",
    },

    redis: {
        url: process.env.REDIS_URL ?? "redis://localhost:6379",
    },

    jwt: {
        secret: process.env.JWT_SECRET ?? "change-me-in-production-min-32-chars",
        expiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
    },

    stripe: {
        secretKey: process.env.STRIPE_SECRET_KEY ?? "sk_test_default",
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_default",
    },

    encryption: {
        key: process.env.ENCRYPTION_KEY ?? "change-me-32-char-encryption-key!!",
    },

    webhook: {
        signingSecret: process.env.WEBHOOK_SIGNING_SECRET ?? "change-me-webhook-signing-secret",
        maxRetries: parseInt(process.env.WEBHOOK_MAX_RETRIES ?? "5", 10),
        retryDelays: JSON.parse(process.env.WEBHOOK_RETRY_DELAYS ?? "[30,120,600,3600,86400]") as number[],
    },

    rateLimit: {
        defaultRpm: parseInt(process.env.RATE_LIMIT_DEFAULT_RPM ?? "1000", 10),
        windowSeconds: parseInt(process.env.RATE_LIMIT_WINDOW_SECONDS ?? "60", 10),
    },
}));
