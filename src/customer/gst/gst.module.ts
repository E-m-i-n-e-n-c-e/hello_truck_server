import { Module } from '@nestjs/common';
import { GstService } from './gst.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [GstService],
  exports: [GstService],
})
export class GstModule {}
