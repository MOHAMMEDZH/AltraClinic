import { Inject, Injectable } from '@nestjs/common';
import { PlatformUserRepository } from '../../domain/repositories/platform-user.repository.interface';
import { PlatformMfaRecoveryCodeRepository } from '../../domain/repositories/platform-mfa-recovery-code.repository.interface';
import { LoginAttemptRepository } from '../../domain/repositories/login-attempt.repository.interface';
import { LoginAttempt } from '../../domain/entities/login-attempt.entity';
import { PlatformMfaRecoveryCode } from '../../domain/entities/platform-mfa-recovery-code.entity';
import {
  PLATFORM_MFA_RECOVERY_CODE_REPOSITORY,
  PLATFORM_USER_REPOSITORY,
} from '../../platform-auth.tokens';
import { EVENT_PUBLISHER, LOGIN_ATTEMPT_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { JwtTokenService } from '../../infrastructure/services/jwt-token.service';
import { PlatformMfaService, CURRENT_PLATFORM_MFA_KEY_VERSION } from '../../infrastructure/services/platform-mfa.service';
import { PlatformSessionCompletionService } from '../services/platform-session-completion.service';
import {
  AccountInactiveException,
  TokenExpiredException,
  TokenInvalidException,
} from '../../domain/exceptions/auth.exceptions';
import { InvalidMfaCodeException } from '../../domain/exceptions/mfa.exceptions';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import {
  PlatformLoginSucceededEvent,
  PlatformMfaEnrollmentConfirmedEvent,
} from '../../domain/events/auth.events';
import { TokenPairVO } from '../../domain/value-objects/token-pair.vo';

export interface PlatformMfaConfirmEnrollmentResult {
  tokens: TokenPairVO;
  recoveryCodes: string[];
}

/**
 * Confirms a pending platform MFA enrollment and — only on success — issues
 * the platform session (access + refresh tokens). Recovery codes are
 * returned exactly once and never persisted in plaintext.
 */
@Injectable()
export class PlatformMfaConfirmEnrollmentHandler {
  constructor(
    @Inject(PLATFORM_USER_REPOSITORY) private readonly platformUsers: PlatformUserRepository,
    @Inject(PLATFORM_MFA_RECOVERY_CODE_REPOSITORY)
    private readonly recoveryCodes: PlatformMfaRecoveryCodeRepository,
    @Inject(LOGIN_ATTEMPT_REPOSITORY) private readonly attemptRepo: LoginAttemptRepository,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherInterface,
    private readonly jwtTokenService: JwtTokenService,
    private readonly mfa: PlatformMfaService,
    private readonly sessionCompletion: PlatformSessionCompletionService,
  ) {}

  async execute(input: {
    preauthToken: string;
    code: string;
    ipAddress: string;
    userAgent: string;
    deviceLabel?: string | null;
  }): Promise<PlatformMfaConfirmEnrollmentResult> {
    const claims = this.jwtTokenService.verifyPlatformPreauthToken(
      input.preauthToken,
      'mfa_enrollment',
    );
    if (!claims) {
      throw new TokenInvalidException('Preauth');
    }

    const user = await this.platformUsers.findById(claims.platformUserId);
    if (!user || !user.isActive) {
      throw new AccountInactiveException();
    }
    if (!user.mfaPendingSecretEncrypted) {
      throw new TokenInvalidException('Preauth');
    }
    if (user.isPendingEnrollmentExpired()) {
      await this.platformUsers.updateMfaState(user.clearPendingMfaEnrollment());
      throw new TokenExpiredException('MFA enrollment');
    }

    const pendingSecret = this.mfa.decrypt(user.mfaPendingSecretEncrypted);
    if (!this.mfa.verify(pendingSecret, input.code)) {
      throw new InvalidMfaCodeException();
    }

    const confirmed = user.confirmMfaEnrollment(CURRENT_PLATFORM_MFA_KEY_VERSION);
    await this.platformUsers.updateMfaState(confirmed);
    await this.events.publish(new PlatformMfaEnrollmentConfirmedEvent(user.id));

    const [entities, rawCodes] = PlatformMfaRecoveryCode.generateBatch({
      platformUserId: user.id,
      count: this.mfa.recoveryCodeCount,
    });
    await this.recoveryCodes.deleteAllForUser(user.id);
    await this.recoveryCodes.saveMany(entities);

    const tokens = await this.sessionCompletion.complete({
      platformUserId: user.id,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      deviceLabel: input.deviceLabel ?? null,
      authMethod: 'totp',
    });

    const succeeded = confirmed.recordSuccessfulLogin(input.ipAddress);
    await this.platformUsers.updateLoginState(succeeded);
    await this.attemptRepo.save(
      LoginAttempt.recordSuccess({
        email: user.email,
        tenantId: null,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      }),
    );
    await this.events.publish(
      new PlatformLoginSucceededEvent(user.id, tokens.sessionId, input.ipAddress),
    );

    return { tokens, recoveryCodes: rawCodes };
  }
}
