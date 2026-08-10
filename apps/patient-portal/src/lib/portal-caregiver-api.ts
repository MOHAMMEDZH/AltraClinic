/**
 * Phase 46d — caregiver + patient-safe profile API client.
 */
import type { PortalHttpClient } from './api-client';

export interface PortalSafeProfile {
  patientId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  gender: string | null;
  actingContext: 'self' | 'caregiver';
}

export interface PortalCaregiverGrant {
  grantId: string;
  caregiverContact: string | null;
  caregiverName: string | null;
  scopes: string[];
  status: string;
  active: boolean;
  expiresAt: string | null;
}

function auth(accessToken: string, tenantId: string, extra?: Record<string, string>) {
  return {
    accessToken,
    tenantId,
    headers: extra,
  };
}

export async function fetchMyProfile(
  api: PortalHttpClient,
  accessToken: string,
  tenantId: string,
  acting?: { mode: 'self' | 'caregiver'; subjectPatientId?: string },
): Promise<PortalSafeProfile> {
  const headers: Record<string, string> = {
    'X-Portal-Acting-Context': acting?.mode ?? 'self',
  };
  if (acting?.mode === 'caregiver' && acting.subjectPatientId) {
    headers['X-Portal-Subject-Patient-Id'] = acting.subjectPatientId;
  }
  return api.request('/patient-portal/me/profile', auth(accessToken, tenantId, headers));
}

export async function fetchMyCaregivers(
  api: PortalHttpClient,
  accessToken: string,
  tenantId: string,
): Promise<{ items: PortalCaregiverGrant[] }> {
  return api.request('/patient-portal/me/caregivers', auth(accessToken, tenantId));
}

export async function inviteCaregiver(
  api: PortalHttpClient,
  accessToken: string,
  tenantId: string,
  body: { caregiverContact: string; caregiverName: string; scopes: string[] },
) {
  return api.request('/patient-portal/me/caregivers', {
    method: 'POST',
    body,
    ...auth(accessToken, tenantId),
  });
}

export async function revokeCaregiver(
  api: PortalHttpClient,
  accessToken: string,
  tenantId: string,
  grantId: string,
) {
  return api.request(`/patient-portal/me/caregivers/${encodeURIComponent(grantId)}/revoke`, {
    method: 'POST',
    body: {},
    ...auth(accessToken, tenantId),
  });
}

export async function acceptCaregiverInvitation(
  api: PortalHttpClient,
  accessToken: string,
  tenantId: string,
  invitationToken: string,
) {
  return api.request('/patient-portal/me/caregiver-invitations/accept', {
    method: 'POST',
    body: { invitationToken },
    ...auth(accessToken, tenantId),
  });
}

export async function fetchDelegatedPatients(
  api: PortalHttpClient,
  accessToken: string,
  tenantId: string,
) {
  return api.request<{
    items: Array<{ grantId: string; subjectPatientId: string; scopes: string[] }>;
  }>('/patient-portal/me/delegated-patients', auth(accessToken, tenantId));
}

export async function fetchDelegatedAppointments(
  api: PortalHttpClient,
  accessToken: string,
  tenantId: string,
  subjectPatientId: string,
) {
  return api.request('/patient-portal/me/appointments?scope=upcoming', {
    ...auth(accessToken, tenantId, {
      'X-Portal-Acting-Context': 'caregiver',
      'X-Portal-Subject-Patient-Id': subjectPatientId,
    }),
  });
}
