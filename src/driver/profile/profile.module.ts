import { Module } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { FirebaseModule } from 'src/auth/firebase/firebase.module';
import { DocumentsModule } from '../documents/documents.module';

@Module({
  imports: [PrismaModule, FirebaseModule, DocumentsModule],
  providers: [ProfileService],
  exports: [ProfileService]
})
export class ProfileModule {}
