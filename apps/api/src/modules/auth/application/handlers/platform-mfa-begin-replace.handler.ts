import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PlatformUserRepository } from '../../domain/repositories/platform-user.repository.interface';
import { PlatformRefreshTokenRepository } from '../../domain/repositories/platform-refresh-token.repository.interface';
import {
  PLATFORM_REFRESH_TOKEN_REPOSITORY,
  PLATFORM_USER_REPOSITORY,
} from '../../platform-auth.tokens';
import { JwtClaimsVO } from '../../domain/value-objects/jwt-claims.vo';
import { MfaNotConfiguredException } from '../../domain/exceptions/mfa.exceptions';
import { TokenInvalidException } from '../../domain/exceptions/auth.exceptions';
import { PlatformMfaService } from '../../infrastructure/services/platform-mfa.service';
import { PlatformAssuranceService } from '../services/platform-assurance.service';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { PlatformMfaReplaceStartedEvent } from '../../domain/events/auth.events';

export interface PlatformMfaBeginReplaceResult {
  secret: string;
  otpauthUrl: string;
  expiresIn: number;
}

/** Requires an existing MFA factor + a fresh step-up verification. */
@Injectable()
export class PlatformMfaBeginReplaceHandler {
  constructor(
    @Inject(PLATFORM_USER_REPOSITORY) private readonly platformUsers: PlatformUserRepository,
    @Inject(PLATFORM_REFRESH_TOKEN_REPOSITORY)
    private readonly refreshRepo: PlatformRefreshTokenRepository,
    private readonly mfa: PlatformMfaService,
    private readonly assurance: PlatformAssuranceService,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherInterface,
  ) {}

  async execute(claims: JwtClaimsVO): Promise<PlatformMfaBeginReplaceResult> {
    if (!claims.isPlatformSession()) {
      throw new UnauthorizedException('Platform authentication required.');
    }
    const user = await this.platformUsers.findById(claims.sub);
    if (!user || !user.mfaEnabled) {
      throw new MfaNotConfiguredException();
    }

    const session = await this.refreshRepo.findBySessionId(claims.sessionId);
    if (!session) {
      throw new TokenInvalidException('Session');
    }
    this.assurance.requireStepUp(session);

    const secret = this.mfa.generateSecret();
    const encrypted = this.mfa.encrypt(secret);
    const expiresAt = new Date(Date.now() + this.mfa.enrollmentTtlSeconds * 1000);
    const updated = user.beginMfaEnrollment(encrypted, expiresAt);
    await this.platformUsers.updateMfaState(updated);
    await this.events.publish(new PlatformMfaReplaceStartedEvent(user.id));

    return {
      secret,
      otpauthUrl: this.mfa.buildOtpauthUrl(user.email, secret),
      expiresIn: this.mfa.enrollmentTtlSeconds,
    };
  }
}
