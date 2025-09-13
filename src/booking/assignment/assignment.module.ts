import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { FirebaseModule } from 'src/auth/firebase/firebase.module';
import { RedisModule } from 'src/redis/redis.module';
import { BullModule } from '@nestjs/bullmq';
import { AssignmentService } from './assignment.service';
import { AssignmentWorker } from './assignment.worker';
import { RedisService } from 'src/redis/redis.service';

@Module({
  imports: [
    PrismaModule,
    FirebaseModule,
    RedisModule,
    BullModule.forRootAsync({
      inject: [RedisService],
      useFactory: (redisService: RedisService) => ({
        connection: redisService.bullClient,
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: true,
          removeOnFail: true,
        },
      }),
    }),
    BullModule.registerQueue({ name: 'booking-assignment' }),
  ],
  providers: [AssignmentService, AssignmentWorker],
  exports: [AssignmentService],
})
export class AssignmentModule {}


