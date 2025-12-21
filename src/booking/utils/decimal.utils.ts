import { Decimal } from '@prisma/client/runtime/library';

/**
 * Truncate Decimal to 2 decimal places (always round DOWN towards zero)
 * This matches the behavior of the original truncate2() function
 */
export function truncateDecimal(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_DOWN);
}

/**
 * Safe conversion from any numeric type to Decimal
 */
export function toDecimal(value: number | Decimal | string): Decimal {
  if (value instanceof Decimal) {
    return value;
  }
  return new Decimal(value);
}

/**
 * Min operation for Decimals
 */
export function minDecimal(a: Decimal, b: Decimal): Decimal {
  return a.lessThanOrEqualTo(b) ? a : b;
}

/**
 * Max operation for Decimals
 */
export function maxDecimal(a: Decimal, b: Decimal): Decimal {
  return a.greaterThanOrEqualTo(b) ? a : b;
}

/**
 * Absolute value for Decimal
 */
export function absDecimal(value: Decimal): Decimal {
  return value.abs();
}

/**
 * Convert Decimal to number (use only when absolutely necessary)
 * For DB storage or external API calls
 */
export function toNumber(value: Decimal): number {
  return value.toNumber();
}

/**
 * Check if Decimal is zero
 */
export function isZero(value: Decimal): boolean {
  return value.isZero();
}

/**
 * Check if Decimal is positive
 */
export function isPositive(value: Decimal): boolean {
  return value.greaterThan(0);
}

/**
 * Check if Decimal is negative
 */
export function isNegative(value: Decimal): boolean {
  return value.lessThan(0);
}
