import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService extends Redis implements OnModuleDestroy {
  private bullRedisInstance: Redis | null = null;
  private subscriberInstance: Redis | null = null;
  private channelToListeners: Map<string, Set<(message: string) => void>> = new Map();

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
    if (this.subscriberInstance) {
      await this.subscriberInstance.quit();
    }
    this.subscriberInstance = null;
    this.bullRedisInstance = null;
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

  private async ensureSubscriber(): Promise<Redis> {
    if (this.subscriberInstance) return this.subscriberInstance;
    const sub = this.duplicate();
    await sub.connect();
    sub.on('message', (channel: string, message: string) => {
      const listeners = this.channelToListeners.get(channel);
      if (!listeners || listeners.size === 0) return;
      for (const listener of Array.from(listeners)) {
        try {
          listener(message);
        } catch {
          // ignore listener errors
        }
      }
    });
    this.subscriberInstance = sub;
    return sub;
  }

  async subscribeChannel(channel: string, handler: (message: string) => void): Promise<void> {
    const sub = await this.ensureSubscriber();
    let listeners = this.channelToListeners.get(channel);
    const isFirst = !listeners || listeners.size === 0;
    if (!listeners) {
      listeners = new Set();
      this.channelToListeners.set(channel, listeners);
    }
    listeners.add(handler);
    if (isFirst) {
      await sub.subscribe(channel);
    }
  }

  async unsubscribeChannel(channel: string, handler: (message: string) => void): Promise<void> {
    const sub = await this.ensureSubscriber();
    const listeners = this.channelToListeners.get(channel);
    if (!listeners) return;
    listeners.delete(handler);
    if (listeners.size === 0) {
      this.channelToListeners.delete(channel);
      await sub.unsubscribe(channel);
    }
  }
}
