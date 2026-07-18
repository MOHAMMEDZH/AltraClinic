export interface MfaChallengeClaims {
  type: 'mfa_challenge';
  sub: string;
  tenantId: string;
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  deviceName: string | null;
}
