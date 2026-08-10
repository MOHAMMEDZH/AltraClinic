export interface PlatformUserProps {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string | null;
  isActive: boolean;
  status?: string;
  suspendedAt?: Date | null;
  suspendedReason?: string | null;
  suspendedById?: string | null;
  authzRevision?: number;
  lockedUntil: Date | null;
  failedLoginCount: number;
  passwordChangedAt: Date;
  lastLoginAt: Date | null;
  lastLoginIp: string | null;
  createdAt: Date;
  updatedAt: Date;

  /** Phase 47 Step 07 — platform MFA state. Secrets are envelope-encrypted, never plaintext. */
  mfaEnabled: boolean;
  mfaSecretEncrypted: string | null;
  mfaKeyVersion: string | null;
  mfaPendingSecretEncrypted: string | null;
  mfaPendingExpiresAt: Date | null;
  mfaConfirmedAt: Date | null;
  lastTotpStep: string | null;
  failedMfaCount: number;
}

export class PlatformUser {
  public readonly id: string;
  public readonly email: string;
  public readonly passwordHash: string;
  public readonly displayName: string | null;
  public readonly isActive: boolean;
  public readonly status: string;
  public readonly suspendedAt: Date | null;
  public readonly suspendedReason: string | null;
  public readonly suspendedById: string | null;
  public readonly authzRevision: number;
  public readonly lockedUntil: Date | null;
  public readonly failedLoginCount: number;
  public readonly passwordChangedAt: Date;
  public readonly lastLoginAt: Date | null;
  public readonly lastLoginIp: string | null;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  public readonly mfaEnabled: boolean;
  public readonly mfaSecretEncrypted: string | null;
  public readonly mfaKeyVersion: string | null;
  public readonly mfaPendingSecretEncrypted: string | null;
  public readonly mfaPendingExpiresAt: Date | null;
  public readonly mfaConfirmedAt: Date | null;
  public readonly lastTotpStep: string | null;
  public readonly failedMfaCount: number;

  private constructor(props: PlatformUserProps) {
    this.id = props.id;
    this.email = props.email;
    this.passwordHash = props.passwordHash;
    this.displayName = props.displayName;
    this.isActive = props.isActive;
    this.status = props.status ?? 'active';
    this.suspendedAt = props.suspendedAt ?? null;
    this.suspendedReason = props.suspendedReason ?? null;
    this.suspendedById = props.suspendedById ?? null;
    this.authzRevision = props.authzRevision ?? 0;
    this.lockedUntil = props.lockedUntil;
    this.failedLoginCount = props.failedLoginCount;
    this.passwordChangedAt = props.passwordChangedAt;
    this.lastLoginAt = props.lastLoginAt;
    this.lastLoginIp = props.lastLoginIp;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.mfaEnabled = props.mfaEnabled;
    this.mfaSecretEncrypted = props.mfaSecretEncrypted;
    this.mfaKeyVersion = props.mfaKeyVersion;
    this.mfaPendingSecretEncrypted = props.mfaPendingSecretEncrypted;
    this.mfaPendingExpiresAt = props.mfaPendingExpiresAt;
    this.mfaConfirmedAt = props.mfaConfirmedAt;
    this.lastTotpStep = props.lastTotpStep;
    this.failedMfaCount = props.failedMfaCount;
  }

  static restore(props: PlatformUserProps): PlatformUser {
    return new PlatformUser(props);
  }

  isLocked(): boolean {
    return this.lockedUntil != null && this.lockedUntil.getTime() > Date.now();
  }

  isSuspended(): boolean {
    return this.status === 'suspended' || this.suspendedAt != null;
  }

  canAuthenticate(): boolean {
    return this.status === 'active' && this.isActive && !this.isLocked() && !this.isSuspended();
  }

  recordFailedLogin(threshold: number, lockoutMinutes: number): PlatformUser {
    const failedLoginCount = this.failedLoginCount + 1;
    const lockedUntil =
      failedLoginCount >= threshold
        ? new Date(Date.now() + lockoutMinutes * 60_000)
        : this.lockedUntil;
    return PlatformUser.restore({
      ...this.toProps(),
      failedLoginCount,
      lockedUntil: lockedUntil ?? null,
      updatedAt: new Date(),
    });
  }

  recordSuccessfulLogin(ipAddress: string): PlatformUser {
    return PlatformUser.restore({
      ...this.toProps(),
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: ipAddress,
      updatedAt: new Date(),
    });
  }

  /** Begins enrollment/replace — stores the new secret only in the pending, encrypted slot. */
  beginMfaEnrollment(pendingSecretEncrypted: string, expiresAt: Date): PlatformUser {
    return PlatformUser.restore({
      ...this.toProps(),
      mfaPendingSecretEncrypted: pendingSecretEncrypted,
      mfaPendingExpiresAt: expiresAt,
      updatedAt: new Date(),
    });
  }

  /** Activates the pending secret as the confirmed MFA secret and clears the pending slot. */
  confirmMfaEnrollment(keyVersion: string): PlatformUser {
    if (!this.mfaPendingSecretEncrypted) {
      throw new Error('No pending platform MFA enrollment to confirm.');
    }
    return PlatformUser.restore({
      ...this.toProps(),
      mfaEnabled: true,
      mfaSecretEncrypted: this.mfaPendingSecretEncrypted,
      mfaKeyVersion: keyVersion,
      mfaPendingSecretEncrypted: null,
      mfaPendingExpiresAt: null,
      mfaConfirmedAt: new Date(),
      failedMfaCount: 0,
      lastTotpStep: null,
      updatedAt: new Date(),
    });
  }

  clearPendingMfaEnrollment(): PlatformUser {
    return PlatformUser.restore({
      ...this.toProps(),
      mfaPendingSecretEncrypted: null,
      mfaPendingExpiresAt: null,
      updatedAt: new Date(),
    });
  }

  isPendingEnrollmentExpired(): boolean {
    return this.mfaPendingExpiresAt != null && this.mfaPendingExpiresAt.getTime() < Date.now();
  }

  recordTotpStep(stepId: string): PlatformUser {
    return PlatformUser.restore({
      ...this.toProps(),
      lastTotpStep: stepId,
      failedMfaCount: 0,
      updatedAt: new Date(),
    });
  }

  recordFailedMfa(): PlatformUser {
    return PlatformUser.restore({
      ...this.toProps(),
      failedMfaCount: this.failedMfaCount + 1,
      updatedAt: new Date(),
    });
  }

  resetMfaFailures(): PlatformUser {
    return PlatformUser.restore({
      ...this.toProps(),
      failedMfaCount: 0,
      updatedAt: new Date(),
    });
  }

  wasTotpStepAlreadyUsed(stepId: string): boolean {
    return this.lastTotpStep === stepId;
  }

  private toProps(): PlatformUserProps {
    return {
      id: this.id,
      email: this.email,
      passwordHash: this.passwordHash,
      displayName: this.displayName,
      isActive: this.isActive,
      status: this.status,
      suspendedAt: this.suspendedAt,
      suspendedReason: this.suspendedReason,
      suspendedById: this.suspendedById,
      authzRevision: this.authzRevision,
      lockedUntil: this.lockedUntil,
      failedLoginCount: this.failedLoginCount,
      passwordChangedAt: this.passwordChangedAt,
      lastLoginAt: this.lastLoginAt,
      lastLoginIp: this.lastLoginIp,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      mfaEnabled: this.mfaEnabled,
      mfaSecretEncrypted: this.mfaSecretEncrypted,
      mfaKeyVersion: this.mfaKeyVersion,
      mfaPendingSecretEncrypted: this.mfaPendingSecretEncrypted,
      mfaPendingExpiresAt: this.mfaPendingExpiresAt,
      mfaConfirmedAt: this.mfaConfirmedAt,
      lastTotpStep: this.lastTotpStep,
      failedMfaCount: this.failedMfaCount,
    };
  }
}
