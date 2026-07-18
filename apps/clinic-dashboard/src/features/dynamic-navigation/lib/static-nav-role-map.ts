import { CLINIC_NAV_ITEMS } from '@booking/permissions';

/** Legacy role constraints preserved during migration — not RBAC enforcement. */
export const STATIC_NAV_ROLE_BY_PATH: Record<string, string[]> = Object.fromEntries(
  CLINIC_NAV_ITEMS.filter((item) => item.roles?.length).map((item) => [item.path, item.roles!]),
);

/** Stable sidebar ids aligned with static CLINIC_NAV_ITEMS for React keys and parity. */
export const STATIC_NAV_ID_BY_PATH: Record<string, string> = Object.fromEntries(
  CLINIC_NAV_ITEMS.map((item) => [item.path, item.id]),
);

export function isRegistryNavigationEnabled(): boolean {
  const flag = import.meta.env.VITE_USE_STATIC_NAV_ONLY;
  return flag !== 'true' && flag !== '1';
}
