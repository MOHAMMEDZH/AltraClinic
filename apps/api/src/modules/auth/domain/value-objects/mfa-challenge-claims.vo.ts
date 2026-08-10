export interface MfaChallengeClaims {
  type: 'mfa_challenge';
  sub: string;
  tenantId: string;
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  deviceName: string | null;
  /** When set to patient, MFA completion must issue a patient session class. Platform MFA is Step 07. */
  sessionClass?: 'staff' | 'patient' | 'platform';
}
