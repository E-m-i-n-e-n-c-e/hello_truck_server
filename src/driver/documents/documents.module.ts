import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { FirebaseModule } from 'src/auth/firebase/firebase.module';

@Module({
  imports: [PrismaModule, FirebaseModule],
  providers: [DocumentsService],
  exports: [DocumentsService]
})
export class DocumentsModule {}