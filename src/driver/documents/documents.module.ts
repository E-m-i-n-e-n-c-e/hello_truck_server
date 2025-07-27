import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [DocumentsService],
  exports: [DocumentsService]
})
export class DocumentsModule {}