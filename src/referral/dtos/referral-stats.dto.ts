import { Expose, Type } from 'class-transformer';

/**
 * DTO for referred customer info shown in referrer's stats
 */
export class ReferredCustomerDto {
  @Expose()
  id: string;

  @Expose()
  firstName: string | null;

  @Expose()
  lastName: string | null;

  @Expose()
  phoneNumber: string;

  @Expose()
  bookingCount: number;

  @Expose()
  createdAt: Date;
}

/**
 * DTO for individual customer referral entry
 */
export class CustomerReferralEntryDto {
  @Expose()
  id: string;

  @Expose()
  @Type(() => ReferredCustomerDto)
  referredCustomer: ReferredCustomerDto;

  @Expose()
  referrerRewardApplied: boolean;

  @Expose()
  createdAt: Date;
}

/**
 * DTO for customer referral stats response
 */
export class CustomerReferralStatsDto {
  @Expose()
  referralCode: string | null;

  @Expose()
  totalReferrals: number;

  @Expose()
  remainingReferrals: number;

  @Expose()
  maxReferrals: number;

  @Expose()
  @Type(() => CustomerReferralEntryDto)
  referrals: CustomerReferralEntryDto[];
}

/**
 * DTO for referred driver info shown in referrer's stats
 */
export class ReferredDriverDto {
  @Expose()
  id: string;

  @Expose()
  firstName: string | null;

  @Expose()
  lastName: string | null;

  @Expose()
  phoneNumber: string;

  @Expose()
  photo: string | null;

  @Expose()
  rideCount: number;

  @Expose()
  createdAt: Date;
}

/**
 * DTO for individual driver referral entry
 */
export class DriverReferralEntryDto {
  @Expose()
  id: string;

  @Expose()
  @Type(() => ReferredDriverDto)
  referredDriver: ReferredDriverDto;

  @Expose()
  referrerRewardApplied: boolean;

  @Expose()
  createdAt: Date;
}

/**
 * DTO for driver referral stats response
 */
export class DriverReferralStatsDto {
  @Expose()
  referralCode: string | null;

  @Expose()
  totalReferrals: number;

  @Expose()
  remainingReferrals: number;

  @Expose()
  maxReferrals: number;

  @Expose()
  @Type(() => DriverReferralEntryDto)
  referrals: DriverReferralEntryDto[];
}
