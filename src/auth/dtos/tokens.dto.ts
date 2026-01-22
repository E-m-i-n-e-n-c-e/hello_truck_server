import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

export class TokenResponseDto {
  @Expose()
  accessToken: string;

  @Expose()
  refreshToken: string;
}

export class refreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
