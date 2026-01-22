import { Decimal } from '@prisma/client/runtime/library';

export type Address = {
  addressLine1: string;
  longitude: Decimal;
  latitude: Decimal;

  // We dont know how accurate reverse geo location is, so they may be null
  landmark?: string;
  pincode?: string;
  city?: string;
  district?: string;
  state?: string;
};

export type AddressWithPhoneNumber = Address & {
  phoneNumber: string;
};
