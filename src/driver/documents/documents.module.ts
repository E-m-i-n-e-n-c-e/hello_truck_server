import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { FirebaseModule } from 'src/firebase/firebase.module';
import { TokenModule } from 'src/token/token.module';
import { DriverDocumentsController } from '../controllers/driver-documents.controller';

@Module({
  imports: [PrismaModule, FirebaseModule, TokenModule],
  controllers: [DriverDocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
