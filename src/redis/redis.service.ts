import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService extends Redis implements OnModuleDestroy {
  private bullRedisInstance: Redis | null = null;

  constructor() {
    super(
      process.env.REDIS_URL ||
        'rediss://default:ARqpAAImcDFkNDJiYzliM2NjNDA0MThmODlmMWNhZjVkODRjZTE0OHAxNjgyNQ@blessed-bobcat-6825.upstash.io:6379',
      {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
      }
    );
  }

  async onModuleDestroy() {
    await this.quit();
    if (this.bullRedisInstance) {
      await this.bullRedisInstance.quit();
    }
  }

  get bullClient(): Redis {
    if (!this.bullRedisInstance) {
      this.bullRedisInstance = new Redis(
        process.env.REDIS_URL ||
          'rediss://default:ARqpAAImcDFkNDJiYzliM2NjNDA0MThmODlmMWNhZjVkODRjZTE0OHAxNjgyNQ@blessed-bobcat-6825.upstash.io:6379',
        {
          maxRetriesPerRequest: null, // Important for Bull queues - null means infinite retries
          enableReadyCheck: false,    // Prevents some connection issues
          lazyConnect: true,
        }
      );
    }
    return this.bullRedisInstance;
  }
}
