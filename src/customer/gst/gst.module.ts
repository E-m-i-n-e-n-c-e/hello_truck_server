import { Module } from '@nestjs/common';
import { GstService } from './gst.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { TokenModule } from 'src/token/token.module';
import { CustomerGstController } from '../controllers/customer-gst.controller';

@Module({
  imports: [PrismaModule, TokenModule],
  controllers: [CustomerGstController],
  providers: [GstService],
  exports: [GstService],
})
export class GstModule {}
