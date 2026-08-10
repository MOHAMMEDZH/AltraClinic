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
import { MfaNotConfiguredException, InvalidMfaCodeException } from '../../domain/exceptions/mfa.exceptions';
import { TokenExpiredException, TokenInvalidException } from '../../domain/exceptions/auth.exceptions';
import { PlatformMfaService, CURRENT_PLATFORM_MFA_KEY_VERSION } from '../../infrastructure/services/platform-mfa.service';
import { PlatformAssuranceService } from '../services/platform-assurance.service';
import { PlatformSessionRevocationService } from '../services/platform-session-revocation.service';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { PlatformMfaReplaceConfirmedEvent } from '../../domain/events/auth.events';

/** Requires an existing MFA factor + a fresh step-up verification. Revokes all other sessions. */
@Injectable()
export class PlatformMfaConfirmReplaceHandler {
  constructor(
    @Inject(PLATFORM_USER_REPOSITORY) private readonly platformUsers: PlatformUserRepository,
    @Inject(PLATFORM_MFA_RECOVERY_CODE_REPOSITORY)
    private readonly recoveryCodes: PlatformMfaRecoveryCodeRepository,
    @Inject(PLATFORM_REFRESH_TOKEN_REPOSITORY)
    private readonly refreshRepo: PlatformRefreshTokenRepository,
    private readonly mfa: PlatformMfaService,
    private readonly assurance: PlatformAssuranceService,
    private readonly sessionRevocation: PlatformSessionRevocationService,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherInterface,
  ) {}

  async execute(claims: JwtClaimsVO, code: string): Promise<{ recoveryCodes: string[] }> {
    if (!claims.isPlatformSession()) {
      throw new UnauthorizedException('Platform authentication required.');
    }
    const user = await this.platformUsers.findById(claims.sub);
    if (!user || !user.mfaEnabled) {
      throw new MfaNotConfiguredException();
    }
    if (!user.mfaPendingSecretEncrypted) {
      throw new TokenInvalidException('MFA replace');
    }

    const session = await this.refreshRepo.findBySessionId(claims.sessionId);
    if (!session) {
      throw new TokenInvalidException('Session');
    }
    this.assurance.requireStepUp(session);

    if (user.isPendingEnrollmentExpired()) {
      await this.platformUsers.updateMfaState(user.clearPendingMfaEnrollment());
      throw new TokenExpiredException('MFA replace');
    }

    const pendingSecret = this.mfa.decrypt(user.mfaPendingSecretEncrypted);
    if (!this.mfa.verify(pendingSecret, code)) {
      throw new InvalidMfaCodeException();
    }

    const confirmed = user.confirmMfaEnrollment(CURRENT_PLATFORM_MFA_KEY_VERSION);
    await this.platformUsers.updateMfaState(confirmed);

    const [entities, rawCodes] = PlatformMfaRecoveryCode.generateBatch({
      platformUserId: user.id,
      count: this.mfa.recoveryCodeCount,
    });
    await this.recoveryCodes.deleteAllForUser(user.id);
    await this.recoveryCodes.saveMany(entities);

    await this.sessionRevocation.revokeOthers(user.id, claims.sessionId, 'mfa_factor_replaced');
    await this.events.publish(new PlatformMfaReplaceConfirmedEvent(user.id));

    return { recoveryCodes: rawCodes };
  }
}
