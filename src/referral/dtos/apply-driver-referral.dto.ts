import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class ApplyDriverReferralDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^DRI-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/, {
    message: 'Invalid driver referral code format',
  })
  referralCode: string;
}
