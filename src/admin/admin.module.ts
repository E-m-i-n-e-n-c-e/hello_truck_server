import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { FirebaseModule } from 'src/firebase/firebase.module';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      global: false, // We can keep it local to admin module or make it global if needed
      secret: process.env.ADMIN_JWT_SECRET || 'admin-secret-key-change-me',
      signOptions: { expiresIn: '1d' },
    }),
    FirebaseModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
