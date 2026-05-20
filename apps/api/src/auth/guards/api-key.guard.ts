import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Inject } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import Redis from "ioredis";
import { REDIS_TOKEN } from "../../redis/redis.module";
import { ApiKeyPermission } from "@payflow/shared";

export const PERMISSIONS_KEY = "permissions";

/**
 * Sliding-window rate limiter + permission checker for API key requests.
 * Uses Redis sorted sets: key = rate_limit:{apiKeyId}, score = timestamp ms
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
    constructor(
        @Inject(REDIS_TOKEN) private readonly redis: Redis,
        private readonly reflector: Reflector,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest<{
            user?: {
                isApiKey?: boolean;
                apiKeyId?: string;
                permissions?: string[];
                rateLimit?: number;
            };
        }>();
        const user = req.user;

        // Only apply this guard when the request is authenticated via API key
        if (!user?.isApiKey || !user.apiKeyId) return true;

        // ── Permission check ────────────────────────────────────────────────
        const requiredPermissions = this.reflector.getAllAndOverride<ApiKeyPermission[]>(
            PERMISSIONS_KEY,
            [context.getHandler(), context.getClass()],
        );

        if (requiredPermissions?.length) {
            const hasAll = requiredPermissions.every((p) => user.permissions?.includes(p));
            if (!hasAll) {
                throw new ForbiddenException(
                    `API key missing required permissions: ${requiredPermissions.join(", ")}`,
                );
            }
        }

        // ── Sliding window rate limiting ─────────────────────────────────────
        const rateLimit = user.rateLimit ?? 1000;
        const windowMs = 60_000;
        const now = Date.now();
        const windowStart = now - windowMs;
        const redisKey = `rl:${user.apiKeyId}`;

        const pipeline = this.redis.pipeline();
        pipeline.zremrangebyscore(redisKey, 0, windowStart);
        pipeline.zadd(redisKey, now, `${now}-${Math.random()}`);
        pipeline.zcard(redisKey);
        pipeline.expire(redisKey, 70);
        const results = await pipeline.exec();

        const count = results?.[2]?.[1] as number ?? 0;

        if (count > rateLimit) {
            throw new ForbiddenException(
                `Rate limit exceeded. Max ${rateLimit} requests per minute.`,
            );
        }

        return true;
    }
}
