/**
 * UTC calendar-day difference between `from` and `endDate`.
 * Positive when endDate is in the future.
 */
export function utcDaysUntil(endDate: Date, from: Date = new Date()): number {
  const end = Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate());
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  return Math.round((end - start) / 86_400_000);
}

export function matchesReminderDay(endDate: Date, days: number, from: Date = new Date()): boolean {
  return utcDaysUntil(endDate, from) === days;
}

/** Inventory expiry alert when item expires within this many days (inclusive). */
export const INVENTORY_EXPIRY_ALERT_DAYS = 7;

export function isExpiringWithinDays(expiryDate: Date, days: number, from: Date = new Date()): boolean {
  const remaining = utcDaysUntil(expiryDate, from);
  return remaining >= 0 && remaining <= days;
}

export function isExpired(expiryDate: Date, from: Date = new Date()): boolean {
  return utcDaysUntil(expiryDate, from) < 0;
}
