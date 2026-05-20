import { Module, Global } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

export const REDIS_TOKEN = "REDIS";

@Global()
@Module({
    providers: [
        {
            provide: REDIS_TOKEN,
            inject: [ConfigService],
            useFactory: (config: ConfigService) => {
                const redis = new Redis(config.get<string>("app.redis.url")!, {
                    maxRetriesPerRequest: 3,
                    enableReadyCheck: true,
                    lazyConnect: false,
                });
                redis.on("error", (err) => {
                    console.error("[Redis] Connection error:", err.message);
                });
                return redis;
            },
        },
    ],
    exports: [REDIS_TOKEN],
})
export class RedisModule {}
