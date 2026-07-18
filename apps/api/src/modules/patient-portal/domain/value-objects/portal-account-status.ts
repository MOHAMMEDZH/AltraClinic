export const PORTAL_ACCOUNT_STATUSES = ['invited', 'active', 'suspended', 'deactivated'] as const;

export type PortalAccountStatus = (typeof PORTAL_ACCOUNT_STATUSES)[number];

export function isPortalAccountStatus(value: unknown): value is PortalAccountStatus {
  return typeof value === 'string' && (PORTAL_ACCOUNT_STATUSES as readonly string[]).includes(value);
}
