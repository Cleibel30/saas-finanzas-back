import { Prisma } from '@prisma/client';

export type Money = Prisma.Decimal;

export function dec(value: Money | number | string): Money {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

export function roundCents(value: Money | number | string): Money {
  return dec(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function toNum(value: Money): number {
  return value.toNumber();
}

export function isZero(value: Money): boolean {
  return value.isZero();
}

export function mul(
  a: Money | number | string,
  b: Money | number | string,
): Money {
  return dec(a).mul(dec(b));
}

export function div(
  a: Money | number | string,
  b: Money | number | string,
): Money {
  return dec(a).div(dec(b));
}
