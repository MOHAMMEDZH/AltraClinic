import { Prisma } from '@prisma/client';

const ZERO = new Prisma.Decimal(0);
const HUNDRED = new Prisma.Decimal(100);

/** Half-up to 2 minor units (currency cents / fils). */
export function roundMoney(value: Prisma.Decimal.Value): Prisma.Decimal {
  return new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/**
 * Split `total` across percentage `shares` (0–100 each).
 * Each part except the last is half-up independently; residual goes to the last share
 * so parts sum exactly to round(total * sum(shares) / 100).
 */
export function splitByShares(
  total: Prisma.Decimal.Value,
  shares: Prisma.Decimal.Value[],
): Prisma.Decimal[] {
  if (shares.length === 0) return [];
  const totalDec = new Prisma.Decimal(total);
  const shareDecs = shares.map((s) => new Prisma.Decimal(s));

  if (shares.length === 1) {
    return [roundMoney(totalDec.mul(shareDecs[0]).div(HUNDRED))];
  }

  const parts: Prisma.Decimal[] = [];
  let allocated = ZERO;
  for (let i = 0; i < shareDecs.length - 1; i++) {
    const part = roundMoney(totalDec.mul(shareDecs[i]).div(HUNDRED));
    parts.push(part);
    allocated = allocated.add(part);
  }

  const totalShare = shareDecs.reduce((acc, s) => acc.add(s), ZERO);
  const targetTotal = roundMoney(totalDec.mul(totalShare).div(HUNDRED));
  parts.push(targetTotal.sub(allocated));
  return parts;
}
