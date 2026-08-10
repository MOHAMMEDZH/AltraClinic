import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PlatformUserRepository } from '../../domain/repositories/platform-user.repository.interface';
import { PlatformMfaRecoveryCodeRepository } from '../../domain/repositories/platform-mfa-recovery-code.repository.interface';
import { PlatformRefreshTokenRepository } from '../../domain/repositories/platform-refresh-token.repository.interface';
import { PlatformMfaRecoveryCode } from '../../domain/entities/platform-mfa-recovery-code.entity';
import {
  PLATFORM_MFA_RECOVERY_CODE_REPOSITORY,
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
import { PlatformMfaRecoveryCodesRegeneratedEvent } from '../../domain/events/auth.events';

/** Requires a fresh step-up verification on the current session. */
@Injectable()
export class PlatformMfaRegenerateRecoveryCodesHandler {
  constructor(
    @Inject(PLATFORM_USER_REPOSITORY) private readonly platformUsers: PlatformUserRepository,
    @Inject(PLATFORM_MFA_RECOVERY_CODE_REPOSITORY)
    private readonly recoveryCodes: PlatformMfaRecoveryCodeRepository,
    @Inject(PLATFORM_REFRESH_TOKEN_REPOSITORY)
    private readonly refreshRepo: PlatformRefreshTokenRepository,
    private readonly mfa: PlatformMfaService,
    private readonly assurance: PlatformAssuranceService,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherInterface,
  ) {}

  async execute(claims: JwtClaimsVO): Promise<{ recoveryCodes: string[] }> {
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

    const [entities, rawCodes] = PlatformMfaRecoveryCode.generateBatch({
      platformUserId: user.id,
      count: this.mfa.recoveryCodeCount,
    });
    await this.recoveryCodes.deleteAllForUser(user.id);
    await this.recoveryCodes.saveMany(entities);
    await this.events.publish(new PlatformMfaRecoveryCodesRegeneratedEvent(user.id));

    return { recoveryCodes: rawCodes };
  }
}
