import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { FirebaseModule } from 'src/auth/firebase/firebase.module';
import { RedisModule } from 'src/redis/redis.module';
import { BullModule } from '@nestjs/bullmq';
import { AssignmentService } from './assignment.service';
import { AssignmentProcessor } from './assignment.processor';
import { RedisService } from 'src/redis/redis.service';

@Module({
  imports: [
    PrismaModule,
    FirebaseModule,
    RedisModule,
    BullModule.forRootAsync({
      useFactory: async (redisService: RedisService) => ({
        connection: redisService,
      }),
      inject: [RedisService],
    }),
    BullModule.registerQueue({
      name: 'booking-assignment',
    }),
  ],
  providers: [AssignmentService, AssignmentProcessor],
  exports: [AssignmentService],
})
export class AssignmentModule {}


