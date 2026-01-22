import { IsString, IsNotEmpty, IsPhoneNumber } from 'class-validator';

export class SendOtpDto {
  @IsString()
  @IsNotEmpty()
  @IsPhoneNumber('IN')
  phoneNumber: string;
}


