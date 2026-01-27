import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpsertFcmTokenDto {
  @ApiProperty({
    description: 'FCM token for web push notifications',
    example: 'fZj8xK...',
  })
  @IsString()
  @IsNotEmpty()
  fcmToken: string;
}
