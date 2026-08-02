import { Prisma } from "@prisma/client";

/**
 * Converts a Prisma `Decimal` (or already-plain number) to a plain JS number, following the
 * project convention (see `tax-rules.service.ts`'s `toNumber` helper) of never letting raw
 * `Decimal` instances reach `res.json()` — their default `toJSON()` serializes to a string,
 * which would silently turn numeric fields into strings on the frontend.
 */
export function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === "number" ? value : Number(value);
}

/**
 * Returns a shallow copy of `record` with each field in `decimalFields` converted from
 * `Prisma.Decimal` to a plain number (or null).
 */
export function serializeDecimals<T extends Record<string, unknown>>(record: T, decimalFields: readonly (keyof T)[]): T {
  const result = { ...record };
  for (const field of decimalFields) {
    result[field] = decimalToNumber(result[field] as Prisma.Decimal | number | null | undefined) as T[typeof field];
  }
  return result;
}
