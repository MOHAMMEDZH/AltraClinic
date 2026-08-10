/**
 * Phase 46b/46e — patient portal auth API client (no staff auth crossover).
 */
import type { PortalHttpClient } from './api-client';
import type { SecureStorage } from './secure-storage';

export interface PortalTokenResponse {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;
  sessionId: string;
  sessionClass: 'patient';
  portalAccountId?: string;
}

export interface PortalMeResponse {
  userId: string;
  portalAccountId: string;
  status: string;
  enrollmentComplete: boolean;
  mfaEnabled: boolean;
  sessionClass: 'patient';
  email?: string;
}

export function persistPortalSession(storage: SecureStorage, tokens: PortalTokenResponse, tenantId: string): void {
  storage.setItem('portal.accessToken', tokens.accessToken);
  storage.setItem('portal.refreshToken', tokens.refreshToken);
  storage.setItem('portal.sessionId', tokens.sessionId);
  storage.setItem('portal.tenantId', tenantId);
}

export function clearPortalSession(storage: SecureStorage): void {
  storage.removeItem('portal.accessToken');
  storage.removeItem('portal.refreshToken');
  storage.removeItem('portal.sessionId');
}

export async function portalLogin(
  api: PortalHttpClient,
  input: { tenantId: string; email: string; password: string },
): Promise<
  | { kind: 'tokens'; tokens: PortalTokenResponse }
  | { kind: 'mfa_required'; mfaChallengeToken: string; mfaExpiresIn: number }
> {
  return api.request('/patient-portal/auth/login', {
    method: 'POST',
    body: input,
    tenantId: input.tenantId,
  });
}

export async function portalEnroll(
  api: PortalHttpClient,
  input: {
    tenantId: string;
    enrollmentToken: string;
    email: string;
    password: string;
    consentAccepted: boolean;
    firstName?: string;
    lastName?: string;
  },
): Promise<PortalTokenResponse> {
  return api.request('/patient-portal/auth/enroll', {
    method: 'POST',
    body: input,
    tenantId: input.tenantId,
  });
}

export async function portalVerifyMfa(
  api: PortalHttpClient,
  input: { mfaChallengeToken: string; code: string },
): Promise<PortalTokenResponse> {
  return api.request('/patient-portal/auth/mfa/verify', {
    method: 'POST',
    body: input,
  });
}

function sessionAuth(accessToken: string, tenantId: string) {
  return { accessToken, tenantId };
}

export async function portalGetMe(
  api: PortalHttpClient,
  accessToken: string,
  tenantId: string,
): Promise<PortalMeResponse> {
  return api.request('/patient-portal/auth/me', sessionAuth(accessToken, tenantId));
}

export async function portalLogout(
  api: PortalHttpClient,
  accessToken: string,
  tenantId: string,
): Promise<{ ok: boolean }> {
  return api.request('/patient-portal/auth/logout', {
    method: 'POST',
    body: {},
    ...sessionAuth(accessToken, tenantId),
  });
}

export async function portalLogoutAll(
  api: PortalHttpClient,
  accessToken: string,
  tenantId: string,
): Promise<{ ok: boolean }> {
  return api.request('/patient-portal/auth/logout-all', {
    method: 'POST',
    body: {},
    ...sessionAuth(accessToken, tenantId),
  });
}

export async function portalChangePassword(
  api: PortalHttpClient,
  accessToken: string,
  tenantId: string,
  body: { currentPassword: string; newPassword: string },
): Promise<{ ok: boolean }> {
  return api.request('/patient-portal/auth/change-password', {
    method: 'POST',
    body,
    ...sessionAuth(accessToken, tenantId),
  });
}

export async function portalSetupMfa(
  api: PortalHttpClient,
  accessToken: string,
  tenantId: string,
): Promise<{ secret: string; otpauthUrl?: string }> {
  return api.request('/patient-portal/auth/mfa/setup', {
    method: 'POST',
    body: {},
    ...sessionAuth(accessToken, tenantId),
  });
}

export async function portalConfirmMfa(
  api: PortalHttpClient,
  accessToken: string,
  tenantId: string,
  code: string,
): Promise<{ ok: boolean; mfaEnabled?: boolean }> {
  return api.request('/patient-portal/auth/mfa/confirm', {
    method: 'POST',
    body: { code },
    ...sessionAuth(accessToken, tenantId),
  });
}
