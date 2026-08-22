import { Prisma } from '@prisma/client';

/**
 * Money is stored as NUMERIC(12,2) and surfaces as Prisma.Decimal. JSON has no
 * decimal type, so every amount is converted to a 2dp `number` exactly once,
 * at the serialization boundary — never mixed into float math beforehand.
 */

export type Money = Prisma.Decimal | number | string | null | undefined;

export function toDecimal(value: Money): Prisma.Decimal {
  if (value === null || value === undefined) return new Prisma.Decimal(0);
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

/** Rounds to 2dp and returns a plain number safe for JSON. */
export function toAmount(value: Money): number {
  return Number(toDecimal(value).toFixed(2));
}

export function sum(...values: Money[]): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>((acc, v) => acc.add(toDecimal(v)), new Prisma.Decimal(0));
}

export function multiply(value: Money, factor: number): Prisma.Decimal {
  return toDecimal(value).mul(factor);
}

/** Guards against divide-by-zero when a trip somehow has no days. */
export function divide(value: Money, divisor: number): Prisma.Decimal {
  if (!divisor) return new Prisma.Decimal(0);
  return toDecimal(value).div(divisor);
}

/** What share of `total` is `part`, as a 0-100 percentage rounded to 1dp. */
export function percentage(part: Money, total: Money): number {
  const t = toDecimal(total);
  if (t.isZero()) return 0;
  return Number(toDecimal(part).div(t).mul(100).toFixed(1));
}
