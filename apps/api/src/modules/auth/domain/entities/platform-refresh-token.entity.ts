import { createHash, randomUUID } from 'crypto';

export type PlatformSessionAssuranceLevel = 'mfa' | 'step_up';
export type PlatformSessionAuthMethod = 'totp' | 'recovery';

export interface PlatformRefreshTokenProps {
  id: string;
  platformUserId: string;
  tokenHash: string;
  sessionId: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;

  /** Phase 47 Step 07 — idle/absolute lifetime + MFA/step-up assurance tracking. */
  lastActivityAt: Date;
  absoluteExpiresAt: Date;
  mfaCompletedAt: Date | null;
  assuranceLevel: PlatformSessionAssuranceLevel;
  stepUpVerifiedAt: Date | null;
  deviceLabel: string | null;
  authMethod: PlatformSessionAuthMethod | null;
  revocationReason: string | null;
}

export class PlatformRefreshToken {
  public readonly id: string;
  public readonly platformUserId: string;
  public readonly tokenHash: string;
  public readonly sessionId: string;
  public readonly familyId: string;
  public readonly expiresAt: Date;
  public readonly revokedAt: Date | null;
  public readonly ipAddress: string | null;
  public readonly userAgent: string | null;
  public readonly createdAt: Date;

  public readonly lastActivityAt: Date;
  public readonly absoluteExpiresAt: Date;
  public readonly mfaCompletedAt: Date | null;
  public readonly assuranceLevel: PlatformSessionAssuranceLevel;
  public readonly stepUpVerifiedAt: Date | null;
  public readonly deviceLabel: string | null;
  public readonly authMethod: PlatformSessionAuthMethod | null;
  public readonly revocationReason: string | null;

  private constructor(props: PlatformRefreshTokenProps) {
    this.id = props.id;
    this.platformUserId = props.platformUserId;
    this.tokenHash = props.tokenHash;
    this.sessionId = props.sessionId;
    this.familyId = props.familyId;
    this.expiresAt = props.expiresAt;
    this.revokedAt = props.revokedAt;
    this.ipAddress = props.ipAddress;
    this.userAgent = props.userAgent;
    this.createdAt = props.createdAt;
    this.lastActivityAt = props.lastActivityAt;
    this.absoluteExpiresAt = props.absoluteExpiresAt;
    this.mfaCompletedAt = props.mfaCompletedAt;
    this.assuranceLevel = props.assuranceLevel;
    this.stepUpVerifiedAt = props.stepUpVerifiedAt;
    this.deviceLabel = props.deviceLabel;
    this.authMethod = props.authMethod;
    this.revocationReason = props.revocationReason;
  }

  static create(input: {
    platformUserId: string;
    rawToken: string;
    sessionId: string;
    familyId: string;
    expiresAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
    absoluteExpiresAt: Date;
    /** Interactive idle clock — preserve across refresh rotation; do not reset to now. */
    lastActivityAt?: Date;
    mfaCompletedAt?: Date | null;
    assuranceLevel?: PlatformSessionAssuranceLevel;
    deviceLabel?: string | null;
    authMethod?: PlatformSessionAuthMethod | null;
    stepUpVerifiedAt?: Date | null;
  }): PlatformRefreshToken {
    const now = new Date();
    return new PlatformRefreshToken({
      id: randomUUID(),
      platformUserId: input.platformUserId,
      tokenHash: PlatformRefreshToken.hash(input.rawToken),
      sessionId: input.sessionId,
      familyId: input.familyId,
      expiresAt: input.expiresAt,
      revokedAt: null,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      createdAt: now,
      lastActivityAt: input.lastActivityAt ?? now,
      absoluteExpiresAt: input.absoluteExpiresAt,
      mfaCompletedAt: input.mfaCompletedAt ?? now,
      assuranceLevel: input.assuranceLevel ?? 'mfa',
      stepUpVerifiedAt: input.stepUpVerifiedAt ?? null,
      deviceLabel: input.deviceLabel ?? null,
      authMethod: input.authMethod ?? null,
      revocationReason: null,
    });
  }

  static restore(props: PlatformRefreshTokenProps): PlatformRefreshToken {
    return new PlatformRefreshToken(props);
  }

  static hash(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  isExpired(): boolean {
    return this.expiresAt < new Date();
  }

  isRevoked(): boolean {
    return this.revokedAt !== null;
  }

  isValid(): boolean {
    return !this.isExpired() && !this.isRevoked();
  }

  isAbsoluteExpired(): boolean {
    return this.absoluteExpiresAt.getTime() < Date.now();
  }

  isIdleExpired(idleSeconds: number): boolean {
    return this.lastActivityAt.getTime() + idleSeconds * 1000 < Date.now();
  }

  touchActivity(): PlatformRefreshToken {
    return PlatformRefreshToken.restore({ ...this.toProps(), lastActivityAt: new Date() });
  }

  isStepUpFresh(stepUpSeconds: number): boolean {
    return (
      this.stepUpVerifiedAt != null &&
      this.stepUpVerifiedAt.getTime() + stepUpSeconds * 1000 > Date.now()
    );
  }

  markStepUpVerified(): PlatformRefreshToken {
    return PlatformRefreshToken.restore({ ...this.toProps(), stepUpVerifiedAt: new Date() });
  }

  revoke(reason: string): PlatformRefreshToken {
    return PlatformRefreshToken.restore({
      ...this.toProps(),
      revokedAt: new Date(),
      revocationReason: reason,
    });
  }

  private toProps(): PlatformRefreshTokenProps {
    return {
      id: this.id,
      platformUserId: this.platformUserId,
      tokenHash: this.tokenHash,
      sessionId: this.sessionId,
      familyId: this.familyId,
      expiresAt: this.expiresAt,
      revokedAt: this.revokedAt,
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
      createdAt: this.createdAt,
      lastActivityAt: this.lastActivityAt,
      absoluteExpiresAt: this.absoluteExpiresAt,
      mfaCompletedAt: this.mfaCompletedAt,
      assuranceLevel: this.assuranceLevel,
      stepUpVerifiedAt: this.stepUpVerifiedAt,
      deviceLabel: this.deviceLabel,
      authMethod: this.authMethod,
      revocationReason: this.revocationReason,
    };
  }
}
