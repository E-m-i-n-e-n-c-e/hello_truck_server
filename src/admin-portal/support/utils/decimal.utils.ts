import { Decimal } from '@prisma/client/runtime/library';

export function truncateDecimal(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_DOWN);
}

export function toDecimal(value: number | Decimal | string): Decimal {
  if (value instanceof Decimal) {
    return value;
  }

  return new Decimal(value);
}

export function toNumber(value: Decimal): number {
  return value.toNumber();
}
