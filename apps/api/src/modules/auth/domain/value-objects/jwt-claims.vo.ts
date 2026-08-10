import { randomUUID } from 'crypto';
import { UserRole } from '../../../identity/domain/user.entity';

/** Session class separates staff, patient portal, and platform control-plane sessions. */
export type AuthSessionClass = 'staff' | 'patient' | 'platform';

/** Verified principal type — must not be inferred from role names alone. */
export type AuthPrincipalType = 'staff' | 'patient' | 'platform';

export const PLATFORM_TOKEN_AUDIENCE = 'platform';
export const CLINIC_TOKEN_AUDIENCE = 'clinic';
export const PATIENT_PORTAL_TOKEN_AUDIENCE = 'patient-portal';
/** Phase 47 Step 07 — pre-session platform tokens (MFA challenge/enrollment). Never valid on /me or any @PlatformAuthRoute. */
export const PLATFORM_PREAUTH_TOKEN_AUDIENCE = 'platform-preauth';

/**
 * Strongly-typed payload embedded in access JWTs.
 * Keep surface area minimal — no PII beyond what authorization requires.
 *
 * Platform tokens omit tenant/patient identity and commercial entitlements.
 */
export class JwtClaimsVO {
  readonly sub: string;
  /** Null only for platform principals — never invent a tenant from headers. */
  readonly tenantId: string | null;
  readonly branchId: string | null;
  readonly roles: UserRole[];
  readonly sessionId: string;
  readonly jti: string;
  readonly type: 'access';
  readonly sessionClass: AuthSessionClass;
  readonly principalType: AuthPrincipalType;
  readonly aud: string;
  readonly iss: string | null;

  constructor(props: {
    sub: string;
    tenantId: string | null;
    branchId: string | null;
    roles: UserRole[];
    sessionId: string;
    jti?: string;
    sessionClass?: AuthSessionClass;
    principalType?: AuthPrincipalType;
    aud?: string;
    iss?: string | null;
  }) {
    this.sub = props.sub;
    this.tenantId = props.tenantId;
    this.branchId = props.branchId;
    this.roles = props.roles;
    this.sessionId = props.sessionId;
    this.jti = props.jti ?? randomUUID();
    this.type = 'access';
    this.sessionClass = props.sessionClass ?? 'staff';
    this.principalType =
      props.principalType ??
      (this.sessionClass === 'patient'
        ? 'patient'
        : this.sessionClass === 'platform'
          ? 'platform'
          : 'staff');
    this.aud =
      props.aud ??
      (this.sessionClass === 'patient'
        ? PATIENT_PORTAL_TOKEN_AUDIENCE
        : this.sessionClass === 'platform'
          ? PLATFORM_TOKEN_AUDIENCE
          : CLINIC_TOKEN_AUDIENCE);
    this.iss = props.iss ?? null;
  }

  toPlain(): Record<string, unknown> {
    const plain: Record<string, unknown> = {
      sub: this.sub,
      branchId: this.branchId,
      roles: this.roles,
      sessionId: this.sessionId,
      jti: this.jti,
      type: this.type,
      sessionClass: this.sessionClass,
      principalType: this.principalType,
      aud: this.aud,
    };
    if (this.tenantId != null) {
      plain['tenantId'] = this.tenantId;
    }
    if (this.iss != null) {
      plain['iss'] = this.iss;
    }
    return plain;
  }

  isPatientSession(): boolean {
    return this.sessionClass === 'patient';
  }

  isStaffSession(): boolean {
    return this.sessionClass === 'staff';
  }

  isPlatformSession(): boolean {
    return this.sessionClass === 'platform' && this.principalType === 'platform';
  }
}

export class RefreshTokenClaimsVO {
  readonly sub: string;
  readonly sessionId: string;
  readonly type: 'refresh';
  readonly sessionClass: AuthSessionClass;
  readonly principalType: AuthPrincipalType;
  readonly aud: string;
  readonly iss: string | null;

  constructor(props: {
    sub: string;
    sessionId: string;
    sessionClass?: AuthSessionClass;
    principalType?: AuthPrincipalType;
    aud?: string;
    iss?: string | null;
  }) {
    this.sub = props.sub;
    this.sessionId = props.sessionId;
    this.type = 'refresh';
    this.sessionClass = props.sessionClass ?? 'staff';
    this.principalType =
      props.principalType ??
      (this.sessionClass === 'patient'
        ? 'patient'
        : this.sessionClass === 'platform'
          ? 'platform'
          : 'staff');
    this.aud =
      props.aud ??
      (this.sessionClass === 'patient'
        ? PATIENT_PORTAL_TOKEN_AUDIENCE
        : this.sessionClass === 'platform'
          ? PLATFORM_TOKEN_AUDIENCE
          : CLINIC_TOKEN_AUDIENCE);
    this.iss = props.iss ?? null;
  }
}
