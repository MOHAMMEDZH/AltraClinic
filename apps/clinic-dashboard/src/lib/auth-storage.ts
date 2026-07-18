const REFRESH_KEY = 'booking.refreshToken';
const TENANT_KEY = 'booking.tenantId';
const MFA_CHALLENGE_KEY = 'booking.mfaChallenge';
const DEVICE_TRUST_KEY = 'booking.deviceTrust';

export interface DeviceTrustState {
  token: string;
  tenantId: string;
  expiresAt: number;
}

export interface MfaChallengeState {
  mfaChallengeToken: string;
  tenantId: string;
  expiresAt: number;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;
  sessionId: string;
  tenantId: string;
  obtainedAt: number;
}

let memoryAccessToken: string | null = null;

/** Access token in memory only — mitigates XSS exfiltration vs localStorage. */
export function getAccessToken(): string | null {
  return memoryAccessToken;
}

export function setAccessToken(token: string | null): void {
  memoryAccessToken = token;
}

export function getRefreshToken(): string | null {
  return sessionStorage.getItem(REFRESH_KEY);
}

export function setRefreshToken(token: string | null): void {
  if (token) sessionStorage.setItem(REFRESH_KEY, token);
  else sessionStorage.removeItem(REFRESH_KEY);
}

export function getStoredTenantId(): string | null {
  return localStorage.getItem(TENANT_KEY);
}

export function setStoredTenantId(tenantId: string): void {
  localStorage.setItem(TENANT_KEY, tenantId);
}

export function persistSession(session: AuthSession): void {
  setAccessToken(session.accessToken);
  setRefreshToken(session.refreshToken);
  setStoredTenantId(session.tenantId);
}

export function clearSession(): void {
  memoryAccessToken = null;
  setRefreshToken(null);
  clearMfaChallenge();
}

export function persistMfaChallenge(state: MfaChallengeState): void {
  sessionStorage.setItem(MFA_CHALLENGE_KEY, JSON.stringify(state));
}

export function getMfaChallenge(): MfaChallengeState | null {
  const raw = sessionStorage.getItem(MFA_CHALLENGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as MfaChallengeState;
    if (!parsed.mfaChallengeToken || !parsed.tenantId) return null;
    if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
      clearMfaChallenge();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearMfaChallenge(): void {
  sessionStorage.removeItem(MFA_CHALLENGE_KEY);
}

export function persistDeviceTrust(state: DeviceTrustState): void {
  localStorage.setItem(DEVICE_TRUST_KEY, JSON.stringify(state));
}

export function getDeviceTrustToken(tenantId: string): string | null {
  const raw = localStorage.getItem(DEVICE_TRUST_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DeviceTrustState;
    if (!parsed.token || parsed.tenantId !== tenantId) return null;
    if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
      clearDeviceTrust();
      return null;
    }
    return parsed.token;
  } catch {
    return null;
  }
}

export function clearDeviceTrust(): void {
  localStorage.removeItem(DEVICE_TRUST_KEY);
}

export function isAccessTokenExpired(obtainedAt: number, expiresInSec: number, skewSec = 30): boolean {
  return Date.now() >= obtainedAt + (expiresInSec - skewSec) * 1000;
}
