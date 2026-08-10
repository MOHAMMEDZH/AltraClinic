/**
 * Phase 46b — Patient portal identity orchestration.
 * Reuses Auth/Identity engines; issues patient sessionClass tokens only.
 */
import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { PortalAccount } from '../../domain/entities/portal-account.entity';
import { PortalAccountRepository } from '../../domain/repositories/portal-account.repository.interface';
import { PortalAuditLog } from '../ports/portal-audit-log.port';
import {
  PORTAL_ACCOUNT_REPOSITORY,
  PORTAL_AUDIT_LOG,
  USER_REPOSITORY,
  REFRESH_TOKEN_REPOSITORY,
  LOGIN_ATTEMPT_REPOSITORY,
  PASSWORD_RESET_TOKEN_REPOSITORY,
  EVENT_PUBLISHER,
} from '../../../../infrastructure/provider.tokens';
import { UserRepository } from '../../../identity/domain/user.repository.interface';
import { User } from '../../../identity/domain/user.entity';
import { PasswordHasher } from '../../../identity/infrastructure/password-hasher';
import { JwtTokenService } from '../../../auth/infrastructure/services/jwt-token.service';
import { LoginCompletionService } from '../../../auth/application/services/login-completion.service';
import { TotpService } from '../../../auth/infrastructure/services/totp.service';
import { MfaBackupCodeService } from '../../../auth/infrastructure/services/mfa-backup-code.service';
import { RefreshTokenRepository } from '../../../auth/domain/repositories/refresh-token.repository.interface';
import { LoginAttemptRepository } from '../../../auth/domain/repositories/login-attempt.repository.interface';
import { PasswordResetTokenRepository } from '../../../auth/domain/repositories/password-reset-token.repository.interface';
import { PasswordResetToken } from '../../../auth/domain/entities/password-reset-token.entity';
import { RefreshToken } from '../../../auth/domain/entities/refresh-token.entity';
import { LoginAttempt } from '../../../auth/domain/entities/login-attempt.entity';
import { DeviceInfoVO } from '../../../auth/domain/value-objects/device-info.vo';
import { TokenPairVO } from '../../../auth/domain/value-objects/token-pair.vo';
import {
  AccountInactiveException,
  AccountLockedException,
  InvalidCredentialsException,
  RateLimitExceededException,
  TokenInvalidException,
} from '../../../auth/domain/exceptions/auth.exceptions';
import { InvalidMfaCodeException } from '../../../auth/domain/exceptions/mfa.exceptions';
import {
  RATE_LIMITER,
  type RateLimiterPort,
} from '../../../auth/infrastructure/services/rate-limiter.port';
import { TenantPolicyService } from '../../../settings/application/services/tenant-policy.service';
import { isPatientPortalCenterEnabled } from '../../config/patient-portal-config';
import { PATIENT_PORTAL_ERROR_CODES } from '../../patient-portal.constants';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { PatientPortalActivityEmitter } from './patient-portal-activity.emitter';

const RATE_LIMIT_WINDOW_MINUTES = 15;
const IP_RATE_LIMIT = 30;
const FORGOT_PW_LIMIT = 3;
const FORGOT_PW_WINDOW_SECS = 900;

export type PortalLoginResult =
  | { kind: 'tokens'; tokens: TokenPairVO; portalAccountId: string }
  | { kind: 'mfa_required'; mfaChallengeToken: string; mfaExpiresIn: number };

@Injectable()
export class PatientPortalIdentityService {
  private readonly logger = new Logger(PatientPortalIdentityService.name);

  constructor(
    @Inject(PORTAL_ACCOUNT_REPOSITORY) private readonly portalRepo: PortalAccountRepository,
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshRepo: RefreshTokenRepository,
    @Inject(LOGIN_ATTEMPT_REPOSITORY) private readonly attemptRepo: LoginAttemptRepository,
    @Inject(PASSWORD_RESET_TOKEN_REPOSITORY)
    private readonly resetTokenRepo: PasswordResetTokenRepository,
    @Inject(RATE_LIMITER) private readonly rateLimiter: RateLimiterPort,
    @Inject(PORTAL_AUDIT_LOG) private readonly auditLog: PortalAuditLog,
    @Inject(EVENT_PUBLISHER) private readonly _events: EventPublisherInterface,
    private readonly jwt: JwtTokenService,
    private readonly loginCompletion: LoginCompletionService,
    private readonly totp: TotpService,
    private readonly backupCodes: MfaBackupCodeService,
    private readonly tenantPolicy: TenantPolicyService,
    private readonly activity: PatientPortalActivityEmitter,
  ) {}

  assertCenterEnabled(): void {
    if (!isPatientPortalCenterEnabled()) {
      throw new ServiceUnavailableException({
        statusCode: 503,
        code: PATIENT_PORTAL_ERROR_CODES.DISABLED,
        message: 'Patient Portal is not available',
      });
    }
  }

  async assertTenantLicensed(tenantId: string): Promise<void> {
    const policy = await this.tenantPolicy.getAdvancedPolicy(tenantId);
    if (!policy.allowPatientPortal) {
      throw new ForbiddenException({
        code: PATIENT_PORTAL_ERROR_CODES.LICENSE_DENIED,
        message: 'Patient Portal is not licensed',
      });
    }
  }

  /**
   * Issues (or re-issues) an enrollment token for an invited account.
   * Returns the raw token once for staff delivery / Notification intent.
   */
  async issueEnrollmentToken(input: {
    account: PortalAccount;
    actorId: string;
    actorRoles: string[];
    correlationId?: string | null;
  }): Promise<string> {
    const raw = input.account.issueEnrollmentToken();
    await this.portalRepo.save(input.account);
    await this.auditLog.record({
      tenantId: input.account.tenantId,
      branchId: input.account.branchId,
      action: 'patient_portal.enrollment.token_issued',
      resourceId: input.account.id,
      actorId: input.actorId,
      actorRoles: input.actorRoles,
      locale: null,
      reason: null,
      details: {
        expiresAt: input.account.enrollmentTokenExpiresAt?.toISOString() ?? '',
      },
      correlationId: input.correlationId ?? null,
    });
    this.activity.emit({
      event: 'enrollment_token_issued',
      tenantId: input.account.tenantId,
      correlationId: input.correlationId,
    });
    return raw;
  }

  async completeEnrollment(input: {
    tenantId: string;
    enrollmentToken: string;
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    consentAccepted: boolean;
    ipAddress: string;
    userAgent: string;
    correlationId?: string | null;
  }): Promise<{ portalAccountId: string; userId: string; tokens: TokenPairVO }> {
    this.assertCenterEnabled();
    await this.assertTenantLicensed(input.tenantId);

    if (!input.consentAccepted) {
      throw new ForbiddenException({
        code: 'PATIENT_PORTAL_CONSENT_REQUIRED',
        message: 'Enrollment consent is required',
      });
    }

    const email = input.email.toLowerCase().trim();
    const tokenHash = PortalAccount.hashEnrollmentToken(input.enrollmentToken);
    const account = await this.portalRepo.findByEnrollmentTokenHash(tokenHash, input.tenantId);

    // Enumeration-resistant: identical failure for bad token / wrong tenant
    if (!account) {
      await PasswordHasher.timingDummyCompare(input.password);
      throw new UnauthorizedException({
        code: 'PATIENT_PORTAL_ENROLLMENT_INVALID',
        message: 'Enrollment could not be completed',
      });
    }

    try {
      account.assertEnrollmentTokenValid(input.enrollmentToken);
    } catch {
      await PasswordHasher.timingDummyCompare(input.password);
      throw new UnauthorizedException({
        code: 'PATIENT_PORTAL_ENROLLMENT_INVALID',
        message: 'Enrollment could not be completed',
      });
    }

    const existing = await this.userRepo.findByEmail(email, input.tenantId);
    if (existing) {
      throw new ForbiddenException({
        code: 'PATIENT_PORTAL_ENROLLMENT_CONFLICT',
        message: 'Enrollment could not be completed',
      });
    }

    const passwordHash = await PasswordHasher.hash(input.password);
    const user = User.create({
      email,
      passwordHash,
      roles: ['patient'],
      tenantId: input.tenantId,
      branchId: account.branchId,
      firstName: input.firstName?.trim() || 'Patient',
      lastName: input.lastName?.trim() || 'User',
    });
    // Mark email verified via enrollment token possession
    const verified = user.verifyEmail();
    await this.userRepo.save(verified);

    account.completeEnrollment({ userId: verified.id });
    await this.portalRepo.save(account);

    await this.auditLog.record({
      tenantId: account.tenantId,
      branchId: account.branchId,
      action: 'patient_portal.enrollment.completed',
      resourceId: account.id,
      actorId: verified.id,
      actorRoles: ['patient'],
      locale: null,
      reason: null,
      details: { userId: verified.id },
      correlationId: input.correlationId ?? null,
    });
    this.activity.emit({
      event: 'enrollment_completed',
      tenantId: account.tenantId,
      correlationId: input.correlationId,
    });

    const device = new DeviceInfoVO({
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      deviceName: null,
    });
    const sessionId = this.jwt.generateSessionId();
    const tokens = await this.loginCompletion.complete({
      user: verified,
      email,
      tenantId: input.tenantId,
      sessionId,
      device,
      sessionClass: 'patient',
    });

    return { portalAccountId: account.id, userId: verified.id, tokens };
  }

  async login(input: {
    tenantId: string;
    email: string;
    password: string;
    ipAddress: string;
    userAgent: string;
    deviceName?: string | null;
    correlationId?: string | null;
  }): Promise<PortalLoginResult> {
    this.assertCenterEnabled();
    await this.assertTenantLicensed(input.tenantId);

    const email = input.email.toLowerCase().trim();
    const device = new DeviceInfoVO({
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      deviceName: input.deviceName ?? null,
    });

    const securityPolicy = await this.tenantPolicy.getSecurityPolicy(input.tenantId);
    const lockoutThreshold = securityPolicy.maxFailedLogins ?? 5;

    const ipFailures = await this.attemptRepo.countRecentFailuresByIp(
      device.ipAddress,
      RATE_LIMIT_WINDOW_MINUTES,
    );
    if (ipFailures >= IP_RATE_LIMIT) {
      throw new RateLimitExceededException(RATE_LIMIT_WINDOW_MINUTES * 60);
    }

    const emailFailures = await this.attemptRepo.countRecentFailures(
      email,
      RATE_LIMIT_WINDOW_MINUTES,
    );
    if (emailFailures >= lockoutThreshold) {
      throw new RateLimitExceededException(RATE_LIMIT_WINDOW_MINUTES * 60);
    }

    const fail = async (reason: 'invalid_credentials' | 'account_locked' | 'account_inactive') => {
      await this.attemptRepo.save(
        LoginAttempt.recordFailure({
          email,
          tenantId: input.tenantId,
          ipAddress: device.ipAddress,
          userAgent: device.userAgent,
          reason,
        }),
      );
    };

    const user = await this.userRepo.findByEmail(email, input.tenantId);
    if (!user || !user.roles.includes('patient')) {
      await fail('invalid_credentials');
      await PasswordHasher.timingDummyCompare(input.password);
      throw new InvalidCredentialsException();
    }

    if (user.isLocked()) {
      await fail('account_locked');
      throw new AccountLockedException(user.lockedUntil!);
    }
    if (!user.isActive) {
      await fail('account_inactive');
      throw new AccountInactiveException();
    }

    const passwordOk = await PasswordHasher.compare(input.password, user.passwordHash);
    if (!passwordOk) {
      await fail('invalid_credentials');
      throw new InvalidCredentialsException();
    }

    const account = await this.portalRepo.findByUserId(user.id, input.tenantId);
    if (!account || account.status.value !== 'active' || !account.isEnrollmentComplete) {
      await fail('invalid_credentials');
      throw new InvalidCredentialsException();
    }

    const sessionId = this.jwt.generateSessionId();

    if (user.mfaEnabled || securityPolicy.mfaRequired) {
      if (!user.mfaEnabled) {
        throw new ForbiddenException({
          code: 'PATIENT_PORTAL_MFA_REQUIRED',
          message: 'Multi-factor authentication enrollment is required',
        });
      }
      const challenge = this.jwt.issueMfaChallenge({
        userId: user.id,
        tenantId: user.tenantId,
        sessionId,
        ipAddress: device.ipAddress,
        userAgent: device.userAgent,
        deviceName: device.deviceName,
        sessionClass: 'patient',
      });
      this.activity.emit({
        event: 'login_mfa_challenge',
        tenantId: input.tenantId,
        correlationId: input.correlationId,
      });
      return {
        kind: 'mfa_required',
        mfaChallengeToken: challenge.token,
        mfaExpiresIn: challenge.expiresIn,
      };
    }

    const tokens = await this.loginCompletion.complete({
      user,
      email,
      tenantId: input.tenantId,
      sessionId,
      device,
      sessionClass: 'patient',
    });

    await this.auditLog.record({
      tenantId: input.tenantId,
      branchId: account.branchId,
      action: 'patient_portal.session.created',
      resourceId: account.id,
      actorId: user.id,
      actorRoles: user.roles,
      locale: null,
      reason: null,
      details: { sessionId },
      correlationId: input.correlationId ?? null,
    });
    this.activity.emit({
      event: 'session_created',
      tenantId: input.tenantId,
      correlationId: input.correlationId,
    });

    return { kind: 'tokens', tokens, portalAccountId: account.id };
  }

  async verifyMfa(input: {
    mfaChallengeToken: string;
    code: string;
    ipAddress: string;
    userAgent: string;
    correlationId?: string | null;
  }): Promise<{ tokens: TokenPairVO; portalAccountId: string }> {
    this.assertCenterEnabled();
    const claims = this.jwt.verifyMfaChallenge(input.mfaChallengeToken);
    if (!claims || claims.sessionClass !== 'patient') {
      throw new TokenInvalidException('MFA challenge');
    }
    await this.assertTenantLicensed(claims.tenantId);

    const user = await this.userRepo.findById(claims.sub, claims.tenantId);
    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      throw new TokenInvalidException('MFA challenge');
    }

    const codeValid = this.backupCodes.looksLikeBackupCode(input.code)
      ? await this.backupCodes.consumeIfValid(input.code, user.id, user.tenantId)
      : this.totp.verify(user.mfaSecret, input.code);
    if (!codeValid) {
      throw new InvalidMfaCodeException();
    }

    const account = await this.portalRepo.findByUserId(user.id, claims.tenantId);
    if (!account || !account.isEnrollmentComplete) {
      throw new UnauthorizedException('Patient portal enrollment is incomplete');
    }

    const device = new DeviceInfoVO({
      ipAddress: claims.ipAddress || input.ipAddress,
      userAgent: claims.userAgent || input.userAgent,
      deviceName: claims.deviceName,
    });
    const tokens = await this.loginCompletion.complete({
      user,
      email: user.email,
      tenantId: user.tenantId,
      sessionId: claims.sessionId,
      device,
      sessionClass: 'patient',
    });

    await this.auditLog.record({
      tenantId: claims.tenantId,
      branchId: account.branchId,
      action: 'patient_portal.session.created',
      resourceId: account.id,
      actorId: user.id,
      actorRoles: user.roles,
      locale: null,
      reason: null,
      details: { sessionId: claims.sessionId, mfa: true },
      correlationId: input.correlationId ?? null,
    });

    return { tokens, portalAccountId: account.id };
  }

  async refresh(input: {
    refreshToken: string;
    ipAddress: string;
    userAgent: string;
  }): Promise<TokenPairVO> {
    this.assertCenterEnabled();
    const claims = this.jwt.verifyRefreshToken(input.refreshToken);
    if (!claims || claims.sessionClass !== 'patient') {
      throw new TokenInvalidException('Refresh');
    }

    const hash = RefreshToken.hash(input.refreshToken);
    const stored = await this.refreshRepo.findByTokenHash(hash);
    if (!stored || stored.isRevoked() || stored.isExpired()) {
      if (stored) await this.refreshRepo.revokeAllByUserId(stored.userId);
      throw new TokenInvalidException('Refresh');
    }

    const user = await this.userRepo.findById(stored.userId, stored.tenantId);
    if (!user || !user.isActive) throw new AccountInactiveException();

    const account = await this.portalRepo.findByUserId(user.id, stored.tenantId);
    if (!account || !account.isEnrollmentComplete) {
      throw new UnauthorizedException('Patient portal enrollment is incomplete');
    }

    await this.refreshRepo.revokeBySessionId(stored.sessionId);
    const newSessionId = this.jwt.generateSessionId();
    const tokenPair = this.jwt.issueTokenPair({
      userId: user.id,
      tenantId: user.tenantId,
      branchId: user.branchId,
      roles: user.roles,
      sessionId: newSessionId,
      sessionClass: 'patient',
    });
    await this.refreshRepo.save(
      RefreshToken.create({
        userId: user.id,
        tenantId: user.tenantId,
        rawToken: tokenPair.refreshToken,
        sessionId: newSessionId,
        deviceName: stored.deviceName,
        expiresAt: this.jwt.getRefreshExpiresAt(),
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      }),
    );
    return tokenPair;
  }

  async logout(input: {
    userId: string;
    tenantId: string;
    sessionId: string;
    correlationId?: string | null;
  }): Promise<void> {
    this.assertCenterEnabled();
    await this.refreshRepo.revokeBySessionId(input.sessionId);
    await this.auditLog.record({
      tenantId: input.tenantId,
      branchId: null,
      action: 'patient_portal.session.revoked',
      resourceId: input.sessionId,
      actorId: input.userId,
      actorRoles: ['patient'],
      locale: null,
      reason: 'logout',
      details: {},
      correlationId: input.correlationId ?? null,
    });
    this.activity.emit({
      event: 'session_revoked',
      tenantId: input.tenantId,
      correlationId: input.correlationId,
    });
  }

  async logoutAll(input: {
    userId: string;
    tenantId: string;
    correlationId?: string | null;
  }): Promise<void> {
    this.assertCenterEnabled();
    await this.refreshRepo.revokeAllByUserId(input.userId);
    await this.auditLog.record({
      tenantId: input.tenantId,
      branchId: null,
      action: 'patient_portal.session.revoked_all',
      resourceId: input.userId,
      actorId: input.userId,
      actorRoles: ['patient'],
      locale: null,
      reason: 'logout_all',
      details: {},
      correlationId: input.correlationId ?? null,
    });
  }

  async forgotPassword(input: {
    tenantId: string;
    email: string;
    ipAddress: string;
  }): Promise<{ resetToken?: string }> {
    this.assertCenterEnabled();
    await this.assertTenantLicensed(input.tenantId);
    const email = input.email.toLowerCase().trim();
    const key = `portal-forgot-pw:${input.tenantId}:${email}`;
    const count = await this.rateLimiter.increment(key, FORGOT_PW_WINDOW_SECS);
    if (count > FORGOT_PW_LIMIT) {
      this.logger.warn(`Portal forgot-password rate limit exceeded`);
      return {};
    }

    const user = await this.userRepo.findByEmail(email, input.tenantId);
    if (!user || !user.isActive || !user.roles.includes('patient')) {
      return {};
    }
    const account = await this.portalRepo.findByUserId(user.id, input.tenantId);
    if (!account || !account.isEnrollmentComplete) {
      return {};
    }

    await this.resetTokenRepo.invalidateAllForUser(user.id);
    const [token, rawToken] = PasswordResetToken.generate({
      userId: user.id,
      tenantId: user.tenantId,
      ipAddress: input.ipAddress,
      ttlMinutes: 30,
    });
    await this.resetTokenRepo.save(token);
    await this.auditLog.record({
      tenantId: input.tenantId,
      branchId: account.branchId,
      action: 'patient_portal.password.reset_requested',
      resourceId: account.id,
      actorId: user.id,
      actorRoles: ['patient'],
      locale: null,
      reason: null,
      details: {},
      correlationId: null,
    });
    // Return raw token for test/dev delivery; production uses Notification intents.
    return { resetToken: rawToken };
  }

  async resetPassword(input: {
    tenantId: string;
    token: string;
    newPassword: string;
  }): Promise<void> {
    this.assertCenterEnabled();
    const hash = PasswordResetToken.hashRaw(input.token);
    const stored = await this.resetTokenRepo.findByTokenHash(hash);
    if (!stored || stored.tenantId !== input.tenantId || !stored.isValid()) {
      throw new UnauthorizedException({
        code: 'PATIENT_PORTAL_RESET_INVALID',
        message: 'Password reset could not be completed',
      });
    }
    const user = await this.userRepo.findById(stored.userId, stored.tenantId);
    if (!user || !user.roles.includes('patient')) {
      throw new UnauthorizedException({
        code: 'PATIENT_PORTAL_RESET_INVALID',
        message: 'Password reset could not be completed',
      });
    }
    const passwordHash = await PasswordHasher.hash(input.newPassword);
    const updated = user.changePassword(passwordHash);
    await this.userRepo.save(updated);
    await this.resetTokenRepo.save(stored.markUsed());
    await this.refreshRepo.revokeAllByUserId(user.id);
    await this.auditLog.record({
      tenantId: input.tenantId,
      branchId: null,
      action: 'patient_portal.password.reset_completed',
      resourceId: user.id,
      actorId: user.id,
      actorRoles: ['patient'],
      locale: null,
      reason: null,
      details: {},
      correlationId: null,
    });
  }

  async changePassword(input: {
    userId: string;
    tenantId: string;
    currentPassword: string;
    newPassword: string;
  }): Promise<void> {
    this.assertCenterEnabled();
    const user = await this.userRepo.findById(input.userId, input.tenantId);
    if (!user || !user.roles.includes('patient')) {
      throw new UnauthorizedException();
    }
    const ok = await PasswordHasher.compare(input.currentPassword, user.passwordHash);
    if (!ok) throw new InvalidCredentialsException();
    const passwordHash = await PasswordHasher.hash(input.newPassword);
    await this.userRepo.save(user.changePassword(passwordHash));
    await this.auditLog.record({
      tenantId: input.tenantId,
      branchId: null,
      action: 'patient_portal.password.changed',
      resourceId: user.id,
      actorId: user.id,
      actorRoles: ['patient'],
      locale: null,
      reason: null,
      details: {},
      correlationId: null,
    });
  }

  async setupMfa(input: {
    userId: string;
    tenantId: string;
  }): Promise<{ secret: string; otpauthUrl: string }> {
    this.assertCenterEnabled();
    const user = await this.userRepo.findById(input.userId, input.tenantId);
    if (!user || !user.roles.includes('patient')) throw new UnauthorizedException();
    const secret = this.totp.generateSecret();
    const updated = user.beginMfaEnrollment(secret);
    await this.userRepo.save(updated);
    await this.auditLog.record({
      tenantId: input.tenantId,
      branchId: null,
      action: 'patient_portal.mfa.setup_started',
      resourceId: user.id,
      actorId: user.id,
      actorRoles: ['patient'],
      locale: null,
      reason: null,
      details: {},
      correlationId: null,
    });
    return {
      secret,
      otpauthUrl: this.totp.buildOtpauthUrl(user.email, secret),
    };
  }

  async confirmMfa(input: {
    userId: string;
    tenantId: string;
    code: string;
  }): Promise<{ backupCodes: string[] }> {
    this.assertCenterEnabled();
    const user = await this.userRepo.findById(input.userId, input.tenantId);
    if (!user || !user.mfaSecret) throw new UnauthorizedException();
    if (!this.totp.verify(user.mfaSecret, input.code)) {
      throw new InvalidMfaCodeException();
    }
    const confirmed = user.confirmMfaEnrollment();
    await this.userRepo.save(confirmed);
    const backupCodes = await this.backupCodes.issueNewSet(user.id, user.tenantId);
    await this.auditLog.record({
      tenantId: input.tenantId,
      branchId: null,
      action: 'patient_portal.mfa.enabled',
      resourceId: user.id,
      actorId: user.id,
      actorRoles: ['patient'],
      locale: null,
      reason: null,
      details: {},
      correlationId: null,
    });
    return { backupCodes };
  }

  async getMe(input: {
    userId: string;
    tenantId: string;
  }): Promise<{
    userId: string;
    portalAccountId: string;
    status: string;
    enrollmentComplete: boolean;
    mfaEnabled: boolean;
    sessionClass: 'patient';
  }> {
    this.assertCenterEnabled();
    const account = await this.portalRepo.findByUserId(input.userId, input.tenantId);
    if (!account) {
      throw new UnauthorizedException('Patient portal account not found');
    }
    const user = await this.userRepo.findById(input.userId, input.tenantId);
    return {
      userId: input.userId,
      portalAccountId: account.id,
      status: account.status.value,
      enrollmentComplete: account.isEnrollmentComplete,
      mfaEnabled: user?.mfaEnabled ?? false,
      sessionClass: 'patient',
    };
  }

  async getEnrollmentStatus(input: {
    tenantId: string;
    enrollmentToken: string;
  }): Promise<{ status: string; expired: boolean }> {
    this.assertCenterEnabled();
    const hash = PortalAccount.hashEnrollmentToken(input.enrollmentToken);
    const account = await this.portalRepo.findByEnrollmentTokenHash(hash, input.tenantId);
    if (!account) {
      return { status: 'unknown', expired: true };
    }
    const expired =
      !account.enrollmentTokenExpiresAt ||
      account.enrollmentTokenExpiresAt.getTime() <= Date.now();
    return { status: account.status.value, expired };
  }
}
