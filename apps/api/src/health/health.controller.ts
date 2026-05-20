import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { Inject } from "@nestjs/common";
import { PrismaClient } from "@payflow/database";
import { PRISMA_TOKEN } from "../database/database.module";
import Redis from "ioredis";
import { REDIS_TOKEN } from "../redis/redis.module";

@ApiTags("health")
@Controller("health")
export class HealthController {
    constructor(
        @Inject(PRISMA_TOKEN) private readonly prisma: PrismaClient,
        @Inject(REDIS_TOKEN) private readonly redis: Redis,
    ) {}

    @Get()
    @ApiOperation({ summary: "Health check" })
    async check() {
        const checks = await Promise.allSettled([
            this.prisma.$queryRaw`SELECT 1`,
            this.redis.ping(),
        ]);

        const db = checks[0]?.status === "fulfilled";
        const cache = checks[1]?.status === "fulfilled";
        const healthy = db && cache;

        return {
            status: healthy ? "ok" : "degraded",
            timestamp: new Date().toISOString(),
            services: {
                database: db ? "ok" : "error",
                redis: cache ? "ok" : "error",
            },
        };
    }
}
