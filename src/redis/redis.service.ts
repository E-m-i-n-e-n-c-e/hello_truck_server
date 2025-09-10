import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService extends Redis implements OnModuleDestroy {

  constructor() {
    super(process.env.REDIS_URL || 'rediss://default:ARqpAAImcDFkNDJiYzliM2NjNDA0MThmODlmMWNhZjVkODRjZTE0OHAxNjgyNQ@blessed-bobcat-6825.upstash.io:6379', {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }

  async onModuleDestroy() {
    await this.quit();
  }
}
