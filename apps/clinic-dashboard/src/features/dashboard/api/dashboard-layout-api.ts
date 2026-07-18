import { apiRequest } from '@/lib/api-client';
import type { DashboardProfileId } from '../config/dashboard-config';
import type { DashboardLayoutPrefs } from '../lib/dashboard-layout-storage';

export async function fetchRemoteDashboardLayout(
  token: string,
  tenantId: string,
  profile: DashboardProfileId,
): Promise<DashboardLayoutPrefs | null> {
  const body = await apiRequest<{ layout: DashboardLayoutPrefs | null }>(
    `/dashboard/layout?profile=${encodeURIComponent(profile)}`,
    { token, tenantId },
  );
  return body.layout;
}

export async function saveRemoteDashboardLayout(
  token: string,
  tenantId: string,
  profile: DashboardProfileId,
  prefs: Omit<DashboardLayoutPrefs, 'version'>,
): Promise<DashboardLayoutPrefs> {
  const body = await apiRequest<{ layout: DashboardLayoutPrefs }>('/dashboard/layout', {
    method: 'PUT',
    token,
    tenantId,
    body: { profile, hiddenWidgets: prefs.hiddenWidgets, widgetOrder: prefs.widgetOrder },
  });
  return body.layout;
}

export async function clearRemoteDashboardLayout(
  token: string,
  tenantId: string,
  profile: DashboardProfileId,
): Promise<void> {
  await apiRequest<{ ok: boolean }>(
    `/dashboard/layout?profile=${encodeURIComponent(profile)}`,
    { method: 'DELETE', token, tenantId },
  );
}
