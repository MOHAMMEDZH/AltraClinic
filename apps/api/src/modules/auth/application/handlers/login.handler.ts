import { Inject, Injectable, Logger } from '@nestjs/common';
import { LoginCommand } from '../commands/login.command';
import { UserRepository } from '../../../identity/domain/user.repository.interface';
import { LoginAttemptRepository } from '../../domain/repositories/login-attempt.repository.interface';
import { TrustedDeviceRepository } from '../../domain/repositories/trusted-device.repository.interface';
import { TrustedDevice } from '../../domain/entities/trusted-device.entity';
import { JwtTokenService } from '../../infrastructure/services/jwt-token.service';
import { PasswordHasher } from '../../../identity/infrastructure/password-hasher';
import { LoginAttempt } from '../../domain/entities/login-attempt.entity';
import { LoginResult } from '../../domain/value-objects/login-result.vo';
import { DeviceInfoVO } from '../../domain/value-objects/device-info.vo';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import {
  LoginFailedEvent, SuspiciousLoginEvent,
} from '../../domain/events/auth.events';
import {
  InvalidCredentialsException, AccountLockedException,
  AccountInactiveException, RateLimitExceededException,
  MaintenanceModeException, MfaEnrollmentRequiredException,
} from '../../domain/exceptions/auth.exceptions';
import {
  USER_REPOSITORY, EVENT_PUBLISHER,
  LOGIN_ATTEMPT_REPOSITORY, TRUSTED_DEVICE_REPOSITORY,
} from '../../../../infrastructure/provider.tokens';
import { LoginCompletionService } from '../services/login-completion.service';
import { TenantPolicyService } from '../../../settings/application/services/tenant-policy.service';

const RATE_LIMIT_WINDOW_MINUTES = 15;
const IP_RATE_LIMIT = 30;
const ADMIN_ROLES = new Set(['owner', 'super_admin', 'general_manager']);

@Injectable()
export class LoginHandler {
  private readonly logger = new Logger(LoginHandler.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(LOGIN_ATTEMPT_REPOSITORY) private readonly attemptRepo: LoginAttemptRepository,
    @Inject(TRUSTED_DEVICE_REPOSITORY) private readonly trustedDeviceRepo: TrustedDeviceRepository,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherInterface,
    private readonly jwtTokenService: JwtTokenService,
    private readonly loginCompletion: LoginCompletionService,
    private readonly tenantPolicy: TenantPolicyService,
  ) {}

  async execute(cmd: LoginCommand): Promise<LoginResult> {
    const email = cmd.email.toLowerCase().trim();
    const device = new DeviceInfoVO({
      ipAddress: cmd.ipAddress,
      userAgent: cmd.userAgent,
      deviceName: cmd.deviceName,
    });

    const securityPolicy = cmd.tenantId
      ? await this.tenantPolicy.getSecurityPolicy(cmd.tenantId)
      : null;
    const lockoutThreshold = securityPolicy?.maxFailedLogins ?? 5;
    const lockoutMinutes = securityPolicy?.lockoutMinutes ?? 15;

    // ── IP-level rate limit ──────────────────────────────────────────────────
    const ipFailures = await this.attemptRepo.countRecentFailuresByIp(
      device.ipAddress, RATE_LIMIT_WINDOW_MINUTES,
    );
    if (ipFailures >= IP_RATE_LIMIT) {
      throw new RateLimitExceededException(RATE_LIMIT_WINDOW_MINUTES * 60);
    }

    // ── Email-level rate limit (brute-force guard) ───────────────────────────
    const emailFailures = await this.attemptRepo.countRecentFailures(email, RATE_LIMIT_WINDOW_MINUTES);
    if (emailFailures >= lockoutThreshold) {
      await this.attemptRepo.save(
        LoginAttempt.recordFailure({ email, tenantId: cmd.tenantId, ipAddress: device.ipAddress, userAgent: device.userAgent, reason: 'account_locked' }),
      );
      await this.events.publish(new LoginFailedEvent(cmd.tenantId, email, device.ipAddress, 'rate_limit', emailFailures));
      throw new RateLimitExceededException(RATE_LIMIT_WINDOW_MINUTES * 60);
    }

    const recordFailure = async (reason: 'invalid_credentials' | 'account_locked' | 'account_inactive' | 'email_not_verified' | 'tenant_not_found') => {
      await this.attemptRepo.save(
        LoginAttempt.recordFailure({ email, tenantId: cmd.tenantId, ipAddress: device.ipAddress, userAgent: device.userAgent, reason }),
      );
      await this.events.publish(new LoginFailedEvent(cmd.tenantId, email, device.ipAddress, reason, emailFailures + 1));
    };

    // ── User lookup ──────────────────────────────────────────────────────────
    const user = await this.userRepo.findByEmail(email, cmd.tenantId);

    if (!user) {
      await recordFailure('invalid_credentials');
      // Timing equalization: perform a full bcrypt compare against a dummy hash
      // so the response time for unknown vs wrong-password is indistinguishable.
      await PasswordHasher.timingDummyCompare(cmd.password);
      throw new InvalidCredentialsException();
    }

    // ── Account state guards ─────────────────────────────────────────────────
    if (user.isLocked()) {
      await recordFailure('account_locked');
      throw new AccountLockedException(user.lockedUntil!);
    }

    if (!user.isActive) {
      await recordFailure('account_inactive');
      throw new AccountInactiveException();
    }

    // ── Password verification ────────────────────────────────────────────────
    const passwordValid = await PasswordHasher.compare(cmd.password, user.passwordHash);
    if (!passwordValid) {
      const updated = user.recordFailedLogin(lockoutThreshold, lockoutMinutes);
      await this.userRepo.updateLoginState(updated);
      await recordFailure('invalid_credentials');

      if (updated.isLocked()) {
        throw new AccountLockedException(updated.lockedUntil!);
      }
      throw new InvalidCredentialsException();
    }

    // ── Suspicious login detection ───────────────────────────────────────────
    if (user.lastLoginIp && user.lastLoginIp !== device.ipAddress) {
      await this.events.publish(
        new SuspiciousLoginEvent(user.tenantId, user.id, device.ipAddress, 'new_ip_address'),
      );
    }

    // ── Tenant maintenance & MFA policy ─────────────────────────────────────
    if (cmd.tenantId) {
      const maintenance = await this.tenantPolicy.isMaintenanceMode(cmd.tenantId);
      const isAdmin = user.roles.some((role) => ADMIN_ROLES.has(role));
      if (maintenance && !isAdmin) {
        throw new MaintenanceModeException();
      }
      if (securityPolicy?.mfaRequired && !user.mfaEnabled) {
        throw new MfaEnrollmentRequiredException();
      }
    }

    // ── Issue tokens or MFA challenge ───────────────────────────────────────
    const sessionId = this.jwtTokenService.generateSessionId();

    const trustedDeviceValid = await this.isTrustedDevice(user, cmd.deviceTrustToken);
    if (user.mfaEnabled && user.mfaSecret && !trustedDeviceValid) {
      const challenge = this.jwtTokenService.issueMfaChallenge({
        userId: user.id,
        tenantId: user.tenantId,
        sessionId,
        ipAddress: device.ipAddress,
        userAgent: device.userAgent,
        deviceName: device.label,
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
      tenantId: user.tenantId,
      sessionId,
      device,
    });

    return { kind: 'tokens', tokens };
  }

  private async isTrustedDevice(
    user: { id: string; tenantId: string },
    rawToken?: string | null,
  ): Promise<boolean> {
    if (!rawToken?.trim()) return false;

    const stored = await this.trustedDeviceRepo.findValidByTokenHash(
      TrustedDevice.hashRaw(rawToken.trim()),
      user.id,
      user.tenantId,
    );
    if (!stored) return false;

    await this.trustedDeviceRepo.save(stored.touch());
    return true;
  }
}
