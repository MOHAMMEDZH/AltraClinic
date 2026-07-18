import { apiRequest } from './api-client';
import type { AuthSession } from './auth-storage';
import { getDeviceTrustToken, getStoredTenantId } from './auth-storage';

export interface LoginPayload {
  email: string;
  password: string;
  tenantId: string;
  deviceName?: string;
  deviceTrustToken?: string;
}

export interface LoginResponse {
  accessToken?: string;
  refreshToken?: string;
  accessExpiresIn?: number;
  sessionId?: string;
  tokenType?: string;
  mfaRequired?: boolean;
  mfaChallengeToken?: string;
  mfaExpiresIn?: number;
  deviceTrustToken?: string;
  deviceTrustExpiresIn?: number;
}

export type LoginResult =
  | { status: 'authenticated'; session: AuthSession }
  | { status: 'mfa_required'; mfaChallengeToken: string; mfaExpiresIn: number; tenantId: string };

export interface MeResponse {
  userId: string;
  tenantId: string;
  branchId: string | null;
  roles: string[];
  sessionId: string;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  mfaEnabled: boolean;
  mfaPending: boolean;
  mfaBackupCodesRemaining: number;
}

export interface SessionRecord {
  sessionId: string;
  deviceName: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface MfaSetupResponse {
  secret: string;
  otpauthUrl: string;
  pending: boolean;
}

export interface VerifyMfaResult {
  session: AuthSession;
  deviceTrust?: { token: string; expiresAt: number };
}

function toSession(data: LoginResponse, tenantId: string): AuthSession {
  return {
    accessToken: data.accessToken!,
    refreshToken: data.refreshToken!,
    accessExpiresIn: data.accessExpiresIn!,
    sessionId: data.sessionId!,
    tenantId,
    obtainedAt: Date.now(),
  };
}

export async function loginRequest(payload: LoginPayload): Promise<LoginResult> {
  const deviceTrustToken = payload.deviceTrustToken ?? getDeviceTrustToken(payload.tenantId) ?? undefined;
  const data = await apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { ...payload, deviceTrustToken },
    tenantId: payload.tenantId,
  });

  if (data.mfaRequired && data.mfaChallengeToken) {
    return {
      status: 'mfa_required',
      mfaChallengeToken: data.mfaChallengeToken,
      mfaExpiresIn: data.mfaExpiresIn ?? 300,
      tenantId: payload.tenantId,
    };
  }

  return {
    status: 'authenticated',
    session: toSession(data, payload.tenantId),
  };
}

export async function verifyMfaRequest(payload: {
  mfaChallengeToken: string;
  code: string;
  tenantId: string;
  trustDevice?: boolean;
}): Promise<VerifyMfaResult> {
  const data = await apiRequest<LoginResponse>('/auth/mfa/verify', {
    method: 'POST',
    body: {
      mfaChallengeToken: payload.mfaChallengeToken,
      code: payload.code,
      trustDevice: payload.trustDevice,
    },
    tenantId: payload.tenantId,
  });

  const result: VerifyMfaResult = {
    session: toSession(data, payload.tenantId),
  };

  if (data.deviceTrustToken && data.deviceTrustExpiresIn) {
    result.deviceTrust = {
      token: data.deviceTrustToken,
      expiresAt: Date.now() + data.deviceTrustExpiresIn * 1000,
    };
  }

  return result;
}

export async function setupMfaRequest(token: string): Promise<MfaSetupResponse> {
  return apiRequest<MfaSetupResponse>('/auth/mfa/setup', { method: 'POST', token });
}

export async function confirmMfaRequest(
  token: string,
  code: string,
): Promise<{ enabled: boolean; backupCodes: string[] }> {
  return apiRequest<{ enabled: boolean; backupCodes: string[] }>('/auth/mfa/confirm', {
    method: 'POST',
    token,
    body: { code },
  });
}

export async function regenerateMfaBackupCodesRequest(
  token: string,
  payload: { password: string; code: string },
): Promise<{ backupCodes: string[]; remaining: number }> {
  return apiRequest<{ backupCodes: string[]; remaining: number }>('/auth/mfa/backup-codes/regenerate', {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function disableMfaRequest(
  token: string,
  payload: { password: string; code: string },
): Promise<{ enabled: boolean }> {
  return apiRequest<{ enabled: boolean }>('/auth/mfa/disable', {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function refreshRequest(refreshToken: string): Promise<AuthSession> {
  const data = await apiRequest<LoginResponse>('/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
  });

  return {
    accessToken: data.accessToken!,
    refreshToken: data.refreshToken!,
    accessExpiresIn: data.accessExpiresIn!,
    sessionId: data.sessionId!,
    tenantId: getStoredTenantId() ?? '',
    obtainedAt: Date.now(),
  };
}

export async function fetchMe(accessToken: string): Promise<MeResponse> {
  return apiRequest<MeResponse>('/auth/me', { token: accessToken });
}

export async function logoutRequest(accessToken: string): Promise<void> {
  await apiRequest<void>('/auth/logout', { method: 'POST', token: accessToken });
}

export async function logoutAllRequest(
  accessToken: string,
): Promise<{ revokedCount: number }> {
  return apiRequest<{ revokedCount: number }>('/auth/logout-all', {
    method: 'POST',
    token: accessToken,
  });
}

export async function forgotPasswordRequest(payload: {
  email: string;
  tenantId: string;
}): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: payload,
    tenantId: payload.tenantId,
  });
}

export async function resetPasswordRequest(payload: {
  token: string;
  newPassword: string;
  tenantId: string;
}): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    body: payload,
    tenantId: payload.tenantId,
  });
}

export async function verifyEmailRequest(payload: {
  token: string;
  tenantId: string;
}): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/auth/verify-email', {
    method: 'POST',
    body: payload,
    tenantId: payload.tenantId,
  });
}

export async function changePasswordRequest(
  accessToken: string,
  payload: { currentPassword: string; newPassword: string },
): Promise<{ message: string; revokedOtherSessions: number }> {
  return apiRequest<{ message: string; revokedOtherSessions: number }>(
    '/auth/change-password',
    {
      method: 'POST',
      token: accessToken,
      body: payload,
    },
  );
}

export async function fetchSessionsRequest(accessToken: string): Promise<SessionRecord[]> {
  return apiRequest<SessionRecord[]>('/auth/sessions', { token: accessToken });
}

export async function revokeSessionRequest(
  accessToken: string,
  sessionId: string,
): Promise<{ revoked: boolean; wasCurrent: boolean }> {
  return apiRequest<{ revoked: boolean; wasCurrent: boolean }>(
    `/auth/sessions/${encodeURIComponent(sessionId)}/revoke`,
    { method: 'POST', token: accessToken },
  );
}

export async function resendVerificationRequest(
  accessToken: string,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/auth/resend-verification', {
    method: 'POST',
    token: accessToken,
  });
}
