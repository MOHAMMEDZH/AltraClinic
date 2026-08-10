export interface PlatformRbacConfig {
  invitationTtlSeconds: number;
  invitationAppOrigin: string;
  invitationResendLimit: number;
  mfaResetTtlSeconds: number;
}

export const PLATFORM_RBAC_CONFIG = 'PLATFORM_RBAC_CONFIG';

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadPlatformRbacConfig(): PlatformRbacConfig {
  return {
    invitationTtlSeconds: positiveInt(process.env.PLATFORM_INVITATION_TTL_SECONDS, 172800),
    invitationAppOrigin: process.env.PLATFORM_INVITATION_APP_ORIGIN ?? 'http://127.0.0.1:5176',
    invitationResendLimit: positiveInt(process.env.PLATFORM_INVITATION_RESEND_LIMIT, 5),
    mfaResetTtlSeconds: positiveInt(process.env.PLATFORM_MFA_RESET_TTL_SECONDS, 86400),
  };
}
