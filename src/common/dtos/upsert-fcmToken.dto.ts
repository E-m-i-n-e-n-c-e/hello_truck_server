import { IsNotEmpty, IsString } from "class-validator";

export class UsertFcmTokenDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsNotEmpty()
  fcmToken: string;
}
