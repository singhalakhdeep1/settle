/**
 * Idempotency Service for Settle
 * Ensures duplicate requests do not cause duplicate payments
 */
import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class IdempotencyService {
  private redis: Redis;
  private defaultTTL: number = 86400; // 24 hours

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });
  }

  async checkAndSet(key: string, response: string, ttl?: number): Promise<boolean> {
    const existing = await this.redis.get(`idempotency:${key}`);

    if (existing !== null) {
      return false; // Request already processed
    }

    await this.redis.setex(`idempotency:${key}`, ttl || this.defaultTTL, response);
    return true; // Request is new
  }

  async getResponse(key: string): Promise<string | null> {
    return await this.redis.get(`idempotency:${key}`);
  }

  async invalidate(key: string): Promise<void> {
    await this.redis.del(`idempotency:${key}`);
  }

  async clearAll(): Promise<void> {
    const keys = await this.redis.keys('idempotency:*');
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
