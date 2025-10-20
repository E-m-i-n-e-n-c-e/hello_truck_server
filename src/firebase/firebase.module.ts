import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FirebaseService } from './firebase.service';
import { SessionModule } from 'src/token/session/session.module';

@Module({
  imports: [ConfigModule, SessionModule],
  providers: [FirebaseService],
  exports: [FirebaseService],
})
export class FirebaseModule {}
