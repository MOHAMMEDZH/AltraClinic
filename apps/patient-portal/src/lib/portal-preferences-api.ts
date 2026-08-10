/**
 * Phase 46e — portal-owned notification preferences (locale + channels only).
 */
import type { PortalHttpClient } from './api-client';

export interface PortalPreferences {
  locale: 'en' | 'ar';
  channels: { email: boolean; sms: boolean; push: boolean };
}

export async function fetchMyPreferences(
  api: PortalHttpClient,
  accessToken: string,
  tenantId: string,
): Promise<PortalPreferences> {
  return api.request('/patient-portal/me/preferences', { accessToken, tenantId });
}

export async function updateMyPreferences(
  api: PortalHttpClient,
  accessToken: string,
  tenantId: string,
  body: PortalPreferences,
): Promise<{ ok: boolean }> {
  return api.request('/patient-portal/me/preferences', {
    method: 'PATCH',
    body,
    accessToken,
    tenantId,
  });
}
