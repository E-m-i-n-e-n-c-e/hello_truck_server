/**
 * RealtimeBus interface for pub/sub messaging.
 * Allows swapping Redis for InMemory implementation in tests.
 */
export interface RealtimeBus {
  /**
   * Publish a message to a channel
   */
  publish(channel: string, data: string): Promise<void>;

  /**
   * Subscribe to a channel with a handler
   */
  subscribe(channel: string, handler: (message: string) => void): Promise<void>;

  /**
   * Unsubscribe a handler from a channel
   */
  unsubscribe(channel: string, handler: (message: string) => void): Promise<void>;

  /**
   * Get cached data by key (optional, for navigation caching)
   */
  get(key: string): Promise<string | null>;

  /**
   * Set cached data by key (optional, for navigation caching)
   */
  set(key: string, value: string): Promise<void>;
}

export const REALTIME_BUS = Symbol('REALTIME_BUS');
