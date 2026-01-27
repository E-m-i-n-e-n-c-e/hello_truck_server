import { Module } from '@nestjs/common';
import { TokenService } from './token.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SessionModule } from './session/session.module';
import { AccessTokenGuard } from './guards/access-token.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    SessionModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '2h' },
      }),
    }),
  ],
  providers: [TokenService, AccessTokenGuard, RolesGuard],
  exports: [TokenService, AccessTokenGuard, RolesGuard],
})
export class TokenModule {}
