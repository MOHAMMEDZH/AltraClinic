import { Inject, Injectable } from '@nestjs/common';
import { PlatformUserRepository } from '../../domain/repositories/platform-user.repository.interface';
import { PLATFORM_USER_REPOSITORY } from '../../platform-auth.tokens';
import { JwtTokenService } from '../../infrastructure/services/jwt-token.service';
import { PlatformMfaService } from '../../infrastructure/services/platform-mfa.service';
import { AccountInactiveException, TokenInvalidException } from '../../domain/exceptions/auth.exceptions';
import { MfaAlreadyEnabledException } from '../../domain/exceptions/mfa.exceptions';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { PlatformMfaEnrollmentStartedEvent } from '../../domain/events/auth.events';

export interface PlatformMfaBeginEnrollmentResult {
  secret: string;
  otpauthUrl: string;
  expiresIn: number;
}

/**
 * First-time platform MFA enrollment. Requires a preauth token issued by
 * login (purpose='mfa_enrollment') — never a plain access token. The
 * plaintext secret is returned to the caller exactly once; only the
 * envelope-encrypted pending secret is persisted.
 */
@Injectable()
export class PlatformMfaBeginEnrollmentHandler {
  constructor(
    @Inject(PLATFORM_USER_REPOSITORY) private readonly platformUsers: PlatformUserRepository,
    private readonly jwtTokenService: JwtTokenService,
    private readonly mfa: PlatformMfaService,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherInterface,
  ) {}

  async execute(preauthToken: string): Promise<PlatformMfaBeginEnrollmentResult> {
    const claims = this.jwtTokenService.verifyPlatformPreauthToken(preauthToken, 'mfa_enrollment');
    if (!claims) {
      throw new TokenInvalidException('Preauth');
    }

    const user = await this.platformUsers.findById(claims.platformUserId);
    if (!user || !user.isActive) {
      throw new AccountInactiveException();
    }
    if (user.mfaEnabled) {
      throw new MfaAlreadyEnabledException();
    }

    const secret = this.mfa.generateSecret();
    const encrypted = this.mfa.encrypt(secret);
    const expiresAt = new Date(Date.now() + this.mfa.enrollmentTtlSeconds * 1000);
    const updated = user.beginMfaEnrollment(encrypted, expiresAt);
    await this.platformUsers.updateMfaState(updated);
    await this.events.publish(new PlatformMfaEnrollmentStartedEvent(user.id));

    return {
      secret,
      otpauthUrl: this.mfa.buildOtpauthUrl(user.email, secret),
      expiresIn: this.mfa.enrollmentTtlSeconds,
    };
  }
}
