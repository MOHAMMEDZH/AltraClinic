export const PLATFORM_TENANT_STATUSES = ['provisioning', 'active', 'suspended', 'archived'] as const;

export type PlatformTenantStatus = (typeof PLATFORM_TENANT_STATUSES)[number];

export function isPlatformTenantStatus(value: unknown): value is PlatformTenantStatus {
  return typeof value === 'string' && (PLATFORM_TENANT_STATUSES as readonly string[]).includes(value);
}
