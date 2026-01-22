import { Injectable, Logger } from '@nestjs/common';
import { RealtimeBus } from 'src/redis/interfaces/realtime-bus.interface';
import { RedisService } from './redis.service';

/**
 * Redis implementation of RealtimeBus.
 * Uses RedisService for pub/sub and caching.
 */
@Injectable()
export class RedisBus implements RealtimeBus {
  private readonly logger = new Logger(RedisBus.name);

  constructor(private readonly redisService: RedisService) {}

  async publish(channel: string, data: string): Promise<void> {
    await this.redisService.publish(channel, data);
    this.logger.debug(`Published to ${channel}`);
  }

  async subscribe(
    channel: string,
    handler: (message: string) => void,
  ): Promise<void> {
    await this.redisService.subscribeChannel(channel, handler);
    this.logger.debug(`Subscribed to ${channel}`);
  }

  async unsubscribe(
    channel: string,
    handler: (message: string) => void,
  ): Promise<void> {
    await this.redisService.unsubscribeChannel(channel, handler);
    this.logger.debug(`Unsubscribed from ${channel}`);
  }

  async get(key: string): Promise<string | null> {
    return this.redisService.get(key);
  }

  async set(key: string, value: string): Promise<void> {
    await this.redisService.set(key, value);
  }
}
