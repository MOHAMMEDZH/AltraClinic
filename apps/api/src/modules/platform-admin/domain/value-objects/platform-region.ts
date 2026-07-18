/**
 * Supported data-residency regions for a tenant (TENANCY.md — data residency).
 * Provisioning a tenant pins its region; downstream storage, backups and
 * exports must honour it.
 */
export const PLATFORM_REGIONS = ['me-central', 'eu-west', 'us-east'] as const;

export type PlatformRegion = (typeof PLATFORM_REGIONS)[number];

export function isPlatformRegion(value: unknown): value is PlatformRegion {
  return typeof value === 'string' && (PLATFORM_REGIONS as readonly string[]).includes(value);
}
