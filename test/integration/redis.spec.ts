import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '../../src/redis/redis.service';
import { ConfigModule } from '@nestjs/config';

describe('Redis Integration', () => {
  let redisService: RedisService;

  let module: TestingModule;

  beforeAll(async () => {
    if (process.env.INTEGRATION_TESTS !== 'true') {
      const red = (text: string) => `\x1b[31m${text}\x1b[0m`;
      console.log(
        red(
          '🚨 FATAL ERROR: Integration tests require INTEGRATION_TESTS to be "true".',
        ),
      );
      console.log(
        red(
          `Current INTEGRATION_TESTS value: "${process.env.INTEGRATION_TESTS || 'undefined'}".`,
        ),
      );
      console.log(
        red(
          'Please ensure INTEGRATION_TESTS=true is set in your .env.test file or environment variables.',
        ),
      );
      console.log(red('Tests aborted.'));
      process.exit(1);
    }

    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
      providers: [RedisService],
    }).compile();

    redisService = module.get<RedisService>(RedisService);
    await redisService.connect();
  });

  afterAll(async () => {
    await module.close();
  });

  describe('Basic Operations', () => {
    it('should set and get value', async () => {
      await redisService.set('test-key', 'test-value');
      const value = await redisService.get('test-key');
      expect(value).toBe('test-value');
      await redisService.del('test-key');
    });

    it('should set value with expiry', async () => {
      await redisService.set('expiring-key', 'value', 'EX', 10);
      const ttl = await redisService.ttl('expiring-key');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(10);
      await redisService.del('expiring-key');
    });

    it('should delete key', async () => {
      await redisService.set('delete-key', 'value');
      await redisService.del('delete-key');
      const value = await redisService.get('delete-key');
      expect(value).toBeNull();
    });
  });

  describe('Pub/Sub', () => {
    it('should publish and receive messages', async () => {
      const messages: string[] = [];
      const channel = 'test-channel';

      await redisService.subscribeChannel(channel, (msg) => {
        messages.push(msg);
      });

      await redisService.publish(channel, 'hello');
      await redisService.publish(channel, 'world');

      // Wait for messages to be received
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(messages).toContain('hello');
      expect(messages).toContain('world');

      await redisService.unsubscribeChannel(channel, () => {});
    });
  });

  describe('Distributed Locking', () => {
    it('should acquire lock', async () => {
      const lockKey = 'test-lock';
      const acquired = await redisService.tryLock(lockKey, 10);
      expect(acquired).toBe(true);
      await redisService.releaseLock(lockKey);
    });

    it('should fail to acquire existing lock', async () => {
      const lockKey = 'test-lock-2';

      const first = await redisService.tryLock(lockKey, 10);
      expect(first).toBe(true);

      const second = await redisService.tryLock(lockKey, 10);
      expect(second).toBe(false);

      await redisService.releaseLock(lockKey);
    });

    it('should release lock', async () => {
      const lockKey = 'test-lock-3';

      await redisService.tryLock(lockKey, 10);
      const released = await redisService.releaseLock(lockKey);
      expect(released).toBe(true);

      const reacquired = await redisService.tryLock(lockKey, 10);
      expect(reacquired).toBe(true);

      await redisService.releaseLock(lockKey);
    });
  });
});
