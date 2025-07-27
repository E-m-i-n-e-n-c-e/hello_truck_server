import { Module } from '@nestjs/common';
import { DriverProfileController } from './driver-profile.controller';
import { DriverDocumentsController } from './driver-documents.controller';
import { ProfileModule } from './profile/profile.module';
import { DocumentsModule } from './documents/documents.module';
import { TokenModule } from 'src/token/token.module';

@Module({
  imports: [TokenModule, ProfileModule, DocumentsModule],
  controllers: [DriverProfileController, DriverDocumentsController],
})
export class DriverModule {}
