import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { DatabaseModule } from "./database/database.module";
import { RedisModule } from "./redis/redis.module";
import { AuthModule } from "./auth/auth.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { ApiKeysModule } from "./api-keys/api-keys.module";
import { PaymentsModule } from "./payments/payments.module";
import { WebhooksModule } from "./webhooks/webhooks.module";
import { AuditModule } from "./audit/audit.module";
import { HealthModule } from "./health/health.module";
import appConfig from "./config/app.config";

@Module({
    imports: [
        // Config — load before everything
        ConfigModule.forRoot({
            isGlobal: true,
            load: [appConfig],
            envFilePath: ["../../.env.local", "../../.env"],
        }),

        // Rate limiting (fallback — API key-level done in Redis guard)
        ThrottlerModule.forRoot([{
            name: "global",
            ttl: 60_000,
            limit: 200,
        }]),

        // Core infrastructure
        DatabaseModule,
        RedisModule,
        AuditModule,

        // Feature modules
        AuthModule,
        OrganizationsModule,
        ApiKeysModule,
        PaymentsModule,
        WebhooksModule,
        HealthModule,
    ],
})
export class AppModule {}
