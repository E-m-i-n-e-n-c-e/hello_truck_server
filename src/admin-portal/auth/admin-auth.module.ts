/**
 * Admin Auth Module
 *
 * Handles authentication for admin portal:
 * - Email/password login
 * - JWT token generation
 * - Token validation
 *
 * Uses separate JWT secret from customer/driver auth.
 */
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminJwtStrategy } from './strategies/admin-jwt.strategy';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminFirebaseModule } from '../firebase/admin-firebase.module';

@Module({
  imports: [
    PrismaModule,
    AdminFirebaseModule,
    PassportModule.register({ defaultStrategy: 'admin-jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('ADMIN_JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('ADMIN_JWT_EXPIRES_IN', '1h'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AdminAuthController],
  providers: [AdminAuthService, AdminJwtStrategy],
  exports: [AdminAuthService, JwtModule],
})
export class AdminAuthModule {}
