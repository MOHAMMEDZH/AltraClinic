import { Inject, Injectable } from '@nestjs/common';
import { generateSecret, generateURI, verifySync } from 'otplib';
import {
  decryptPlatformMfaSecret,
  encryptPlatformMfaSecret,
} from './platform-mfa-secret.crypto';
import {
  PLATFORM_SECURITY_CONFIG,
  PlatformSecurityConfig,
} from '../../config/platform-security.config';

export const CURRENT_PLATFORM_MFA_KEY_VERSION = '1';

/**
 * Phase 47 Step 07 — platform TOTP secret lifecycle: generation, envelope
 * encryption/decryption, verification and replay-protected step tracking.
 * Never returns/logs plaintext outside of one-time enrollment responses.
 */
@Injectable()
export class PlatformMfaService {
  constructor(
    @Inject(PLATFORM_SECURITY_CONFIG) private readonly config: PlatformSecurityConfig,
  ) {}

  generateSecret(): string {
    return generateSecret();
  }

  buildOtpauthUrl(email: string, secret: string): string {
    return generateURI({
      issuer: this.config.mfaIssuer,
      label: email,
      secret,
    });
  }

  encrypt(plaintextSecret: string): string {
    return encryptPlatformMfaSecret(plaintextSecret, this.config.mfaEncryptionKey);
  }

  decrypt(envelope: string): string {
    return decryptPlatformMfaSecret(envelope, this.config.mfaEncryptionKey);
  }

  /** Returns the TOTP step identifier used for a code, or null if malformed. */
  private normalizedCode(code: string): string | null {
    const normalized = code.replace(/\s/g, '');
    return /^\d{6}$/.test(normalized) ? normalized : null;
  }

  verify(secret: string, code: string): boolean {
    const normalized = this.normalizedCode(code);
    if (!normalized) return false;
    return verifySync({ secret, token: normalized }).valid;
  }

  /** Deterministic 30s TOTP step bucket, used only for replay protection (not a timestamp). */
  currentStepId(): string {
    return Math.floor(Date.now() / 30_000).toString(36);
  }

  get enrollmentTtlSeconds(): number {
    return this.config.mfaEnrollmentTtlSeconds;
  }

  get challengeTtlSeconds(): number {
    return this.config.mfaChallengeTtlSeconds;
  }

  get recoveryCodeCount(): number {
    return this.config.recoveryCodeCount;
  }

  get stepUpSeconds(): number {
    return this.config.stepUpSeconds;
  }

  get sessionIdleSeconds(): number {
    return this.config.sessionIdleSeconds;
  }

  get sessionAbsoluteSeconds(): number {
    return this.config.sessionAbsoluteSeconds;
  }

  get activityMinIntervalSeconds(): number {
    return this.config.activityMinIntervalSeconds;
  }
}
