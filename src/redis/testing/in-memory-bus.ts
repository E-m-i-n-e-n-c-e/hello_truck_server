import { Injectable, Logger } from '@nestjs/common';
import { RealtimeBus } from 'src/redis/interfaces/realtime-bus.interface';

/**
 * In-memory implementation of RealtimeBus for testing.
 * No Redis dependency - instant, deterministic, CI-safe.
 */
@Injectable()
export class InMemoryBus implements RealtimeBus {
  private readonly logger = new Logger(InMemoryBus.name);

  private readonly channels = new Map<string, Set<(message: string) => void>>();
  private readonly cache = new Map<string, string>();

  async publish(channel: string, data: string): Promise<void> {
    const handlers = this.channels.get(channel);
    if (handlers) {
      // Immediate delivery (synchronous for testing predictability)
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (error) {
          this.logger.warn(`Handler error on channel ${channel}: ${error}`);
        }
      }
    }
    this.logger.debug(
      `Published to ${channel} (${handlers?.size || 0} subscribers)`,
    );
  }

  async subscribe(
    channel: string,
    handler: (message: string) => void,
  ): Promise<void> {
    let handlers = this.channels.get(channel);
    if (!handlers) {
      handlers = new Set();
      this.channels.set(channel, handlers);
    }
    handlers.add(handler);
    this.logger.debug(`Subscribed to ${channel}`);
  }

  async unsubscribe(
    channel: string,
    handler: (message: string) => void,
  ): Promise<void> {
    const handlers = this.channels.get(channel);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.channels.delete(channel);
      }
    }
    this.logger.debug(`Unsubscribed from ${channel}`);
  }

  async get(key: string): Promise<string | null> {
    return this.cache.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.cache.set(key, value);
  }

  /**
   * Clear all subscriptions and cache (useful in test teardown)
   */
  clear(): void {
    this.channels.clear();
    this.cache.clear();
  }
}
