import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class ApplyCustomerReferralDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^CUS-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/, {
    message: 'Invalid customer referral code format',
  })
  referralCode: string;
}
