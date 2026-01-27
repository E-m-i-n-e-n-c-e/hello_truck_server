import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RedisBus } from './redis-bus';
import { REALTIME_BUS } from './interfaces/realtime-bus.interface';

@Global()
@Module({
  providers: [
    RedisService,
    RedisBus,
    {
      provide: REALTIME_BUS,
      useExisting: RedisBus,
    },
  ],
  exports: [RedisService, REALTIME_BUS],
})
export class RedisModule {}
