import { IsNotEmpty, IsString } from 'class-validator';

export class UsertFcmTokenDto {
  @IsString()
  @IsNotEmpty()
  fcmToken: string;
}
