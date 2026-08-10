import { createHash, randomUUID } from 'crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { PasswordHasher } from '../../../identity/infrastructure/password-hasher';
import { JwtTokenService } from '../../infrastructure/services/jwt-token.service';
import { PlatformMfaService } from '../../infrastructure/services/platform-mfa.service';
import { LoginAttempt } from '../../domain/entities/login-attempt.entity';
import { LoginAttemptRepository } from '../../domain/repositories/login-attempt.repository.interface';
import { PlatformUserRepository } from '../../domain/repositories/platform-user.repository.interface';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import {
  InvalidCredentialsException,
  RateLimitExceededException,
} from '../../domain/exceptions/auth.exceptions';
import {
  PlatformAccountLockedEvent,
  PlatformLoginFailedEvent,
  PlatformPasswordVerifiedEvent,
} from '../../domain/events/auth.events';
import {
  EVENT_PUBLISHER,
  LOGIN_ATTEMPT_REPOSITORY,
} from '../../../../infrastructure/provider.tokens';
import { PLATFORM_USER_REPOSITORY } from '../../platform-auth.tokens';

const RATE_LIMIT_WINDOW_MINUTES = 15;
const IP_RATE_LIMIT = 30;
const EMAIL_RATE_LIMIT = 5;
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 15;

function emailAuditHint(email: string): string {
  return createHash('sha256').update(email).digest('hex').slice(0, 12);
}

/**
 * MFA is mandatory. Password verification alone NEVER issues access/refresh
 * tokens — only a short-lived preauth token that must be exchanged via the
 * MFA enrollment or challenge endpoints (Phase 47 Step 07).
 */
export type PlatformLoginResult =
  | {
      kind: 'mfa_enrollment_required';
      preauthToken: string;
      expiresIn: number;
      email: string;
    }
  | {
      kind: 'mfa_challenge_required';
      preauthToken: string;
      expiresIn: number;
    };

@Injectable()
export class PlatformLoginHandler {
  private readonly logger = new Logger(PlatformLoginHandler.name);

  constructor(
    @Inject(PLATFORM_USER_REPOSITORY) private readonly platformUsers: PlatformUserRepository,
    @Inject(LOGIN_ATTEMPT_REPOSITORY) private readonly attemptRepo: LoginAttemptRepository,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherInterface,
    private readonly jwtTokenService: JwtTokenService,
    private readonly mfa: PlatformMfaService,
  ) {}

  async execute(input: {
    email: string;
    password: string;
    ipAddress: string;
    userAgent: string;
  }): Promise<PlatformLoginResult> {
    const email = input.email.toLowerCase().trim();
    const hint = emailAuditHint(email);

    const ipFailures = await this.attemptRepo.countRecentFailuresByIp(
      input.ipAddress,
      RATE_LIMIT_WINDOW_MINUTES,
    );
    if (ipFailures >= IP_RATE_LIMIT) {
      throw new RateLimitExceededException(RATE_LIMIT_WINDOW_MINUTES * 60);
    }

    const emailFailures = await this.attemptRepo.countRecentFailures(
      email,
      RATE_LIMIT_WINDOW_MINUTES,
    );
    if (emailFailures >= EMAIL_RATE_LIMIT) {
      await this.recordFailure(email, input.ipAddress, input.userAgent, 'account_locked', emailFailures);
      throw new RateLimitExceededException(RATE_LIMIT_WINDOW_MINUTES * 60);
    }

    const user = await this.platformUsers.findByEmail(email);
    if (!user) {
      await PasswordHasher.timingDummyCompare(input.password);
      await this.recordFailure(
        email,
        input.ipAddress,
        input.userAgent,
        'invalid_credentials',
        emailFailures + 1,
      );
      throw new InvalidCredentialsException();
    }

    // Generic public error for locked / inactive — no enumeration.
    if (!user.canAuthenticate()) {
      await this.recordFailure(
        email,
        input.ipAddress,
        input.userAgent,
        user.isLocked() ? 'account_locked' : 'account_inactive',
        emailFailures + 1,
      );
      throw new InvalidCredentialsException();
    }

    const passwordValid = await PasswordHasher.compare(input.password, user.passwordHash);
    if (!passwordValid) {
      const updated = user.recordFailedLogin(LOCKOUT_THRESHOLD, LOCKOUT_MINUTES);
      await this.platformUsers.updateLoginState(updated);
      await this.recordFailure(
        email,
        input.ipAddress,
        input.userAgent,
        'invalid_credentials',
        emailFailures + 1,
      );
      if (updated.isLocked()) {
        await this.events.publish(
          new PlatformAccountLockedEvent(updated.id, input.ipAddress),
        );
        this.logger.warn(`Platform account lockout activated for principal ${updated.id}`);
      }
      throw new InvalidCredentialsException();
    }

    // Password OK. Tokens are NEVER issued here — only a preauth transaction
    // that must be completed via MFA enrollment or challenge.
    const transactionId = randomUUID();
    const requiresEnrollment = !user.mfaEnabled;
    await this.events.publish(
      new PlatformPasswordVerifiedEvent(user.id, requiresEnrollment),
    );

    if (requiresEnrollment) {
      const preauth = this.jwtTokenService.issuePlatformPreauthToken({
        platformUserId: user.id,
        purpose: 'mfa_enrollment',
        transactionId,
        expiresInSeconds: this.mfa.enrollmentTtlSeconds,
      });
      this.logger.log(`Platform login ${hint} requires MFA enrollment.`);
      return {
        kind: 'mfa_enrollment_required',
        preauthToken: preauth.token,
        expiresIn: preauth.expiresIn,
        email: user.email,
      };
    }

    const preauth = this.jwtTokenService.issuePlatformPreauthToken({
      platformUserId: user.id,
      purpose: 'mfa_challenge',
      transactionId,
      expiresInSeconds: this.mfa.challengeTtlSeconds,
    });
    return {
      kind: 'mfa_challenge_required',
      preauthToken: preauth.token,
      expiresIn: preauth.expiresIn,
    };
  }

  private async recordFailure(
    email: string,
    ipAddress: string,
    userAgent: string,
    reason: 'invalid_credentials' | 'account_locked' | 'account_inactive',
    failedCount: number,
  ): Promise<void> {
    await this.attemptRepo.save(
      LoginAttempt.recordFailure({
        email,
        tenantId: null,
        ipAddress,
        userAgent,
        reason,
      }),
    );
    await this.events.publish(
      new PlatformLoginFailedEvent(emailAuditHint(email), ipAddress, reason, failedCount),
    );
  }
}
