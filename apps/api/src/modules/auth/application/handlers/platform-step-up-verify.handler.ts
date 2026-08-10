import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PlatformUserRepository } from '../../domain/repositories/platform-user.repository.interface';
import { PlatformRefreshTokenRepository } from '../../domain/repositories/platform-refresh-token.repository.interface';
import { PlatformMfaRecoveryCodeRepository } from '../../domain/repositories/platform-mfa-recovery-code.repository.interface';
import { PlatformMfaRecoveryCode } from '../../domain/entities/platform-mfa-recovery-code.entity';
import {
  PLATFORM_MFA_RECOVERY_CODE_REPOSITORY,
  PLATFORM_REFRESH_TOKEN_REPOSITORY,
  PLATFORM_USER_REPOSITORY,
} from '../../platform-auth.tokens';
import { JwtClaimsVO } from '../../domain/value-objects/jwt-claims.vo';
import { MfaNotConfiguredException, InvalidMfaCodeException } from '../../domain/exceptions/mfa.exceptions';
import { TokenInvalidException } from '../../domain/exceptions/auth.exceptions';
import { PlatformMfaService } from '../../infrastructure/services/platform-mfa.service';
import { PlatformAssuranceService } from '../services/platform-assurance.service';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { PlatformStepUpFailedEvent, PlatformStepUpVerifiedEvent } from '../../domain/events/auth.events';

export interface PlatformStepUpVerifyResult {
  stepUpVerifiedUntil: Date;
}

/** TOTP preferred; recovery code accepted as fallback. Binds freshness to the CURRENT session only. */
@Injectable()
export class PlatformStepUpVerifyHandler {
  constructor(
    @Inject(PLATFORM_USER_REPOSITORY) private readonly platformUsers: PlatformUserRepository,
    @Inject(PLATFORM_REFRESH_TOKEN_REPOSITORY)
    private readonly refreshRepo: PlatformRefreshTokenRepository,
    @Inject(PLATFORM_MFA_RECOVERY_CODE_REPOSITORY)
    private readonly recoveryCodes: PlatformMfaRecoveryCodeRepository,
    private readonly mfa: PlatformMfaService,
    private readonly assurance: PlatformAssuranceService,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherInterface,
  ) {}

  async execute(claims: JwtClaimsVO, code: string): Promise<PlatformStepUpVerifyResult> {
    if (!claims.isPlatformSession()) {
      throw new UnauthorizedException('Platform authentication required.');
    }
    const user = await this.platformUsers.findById(claims.sub);
    if (!user || !user.mfaEnabled || !user.mfaSecretEncrypted) {
      throw new MfaNotConfiguredException();
    }

    const session = await this.refreshRepo.findBySessionId(claims.sessionId);
    if (!session) {
      throw new TokenInvalidException('Session');
    }

    let valid = false;
    if (PlatformMfaRecoveryCode.looksLikeRecoveryCode(code)) {
      const hash = PlatformMfaRecoveryCode.hashRaw(code);
      const stored = await this.recoveryCodes.findByCodeHash(hash, user.id);
      if (stored) {
        await this.recoveryCodes.markUsed(stored.id);
        valid = true;
      }
    } else {
      const secret = this.mfa.decrypt(user.mfaSecretEncrypted);
      const stepId = this.mfa.currentStepId();
      if (!user.wasTotpStepAlreadyUsed(stepId) && this.mfa.verify(secret, code)) {
        valid = true;
        await this.platformUsers.updateMfaState(user.recordTotpStep(stepId));
      }
    }

    if (!valid) {
      await this.events.publish(new PlatformStepUpFailedEvent(user.id, session.sessionId));
      throw new InvalidMfaCodeException();
    }

    await this.refreshRepo.markStepUpVerified(session.sessionId, new Date());
    await this.events.publish(new PlatformStepUpVerifiedEvent(user.id, session.sessionId));

    return {
      stepUpVerifiedUntil: new Date(Date.now() + this.assurance.stepUpValiditySeconds() * 1000),
    };
  }
}
