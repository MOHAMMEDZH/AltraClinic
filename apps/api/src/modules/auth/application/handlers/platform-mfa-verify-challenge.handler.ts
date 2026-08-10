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
import { PlatformMfaService } from '../../infrastructure/services/platform-mfa.service';
import { PlatformSessionCompletionService } from '../services/platform-session-completion.service';
import {
  AccountInactiveException,
  RateLimitExceededException,
  TokenInvalidException,
} from '../../domain/exceptions/auth.exceptions';
import { InvalidMfaCodeException, MfaNotConfiguredException } from '../../domain/exceptions/mfa.exceptions';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import {
  PlatformLoginSucceededEvent,
  PlatformMfaChallengeFailedEvent,
  PlatformMfaChallengeSucceededEvent,
  PlatformMfaRecoveryCodeUsedEvent,
} from '../../domain/events/auth.events';
import { TokenPairVO } from '../../domain/value-objects/token-pair.vo';
import {
  PLATFORM_MFA_FAILURE_RATE_LIMIT,
  PLATFORM_MFA_RATE_LIMIT_WINDOW_MINUTES,
} from '../../platform-mfa.constants';

/**
 * Completes a platform login by verifying a TOTP code or a one-time
 * recovery code against a preauth challenge. This is the ONLY path (besides
 * enrollment confirmation) that issues platform access/refresh tokens.
 */
@Injectable()
export class PlatformMfaVerifyChallengeHandler {
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
  }): Promise<TokenPairVO> {
    const claims = this.jwtTokenService.verifyPlatformPreauthToken(
      input.preauthToken,
      'mfa_challenge',
    );
    if (!claims) {
      throw new TokenInvalidException('Preauth');
    }

    const user = await this.platformUsers.findById(claims.platformUserId);
    if (!user || !user.isActive) {
      throw new AccountInactiveException();
    }
    if (!user.mfaEnabled || !user.mfaSecretEncrypted) {
      throw new MfaNotConfiguredException();
    }

    if (user.failedMfaCount >= PLATFORM_MFA_FAILURE_RATE_LIMIT) {
      throw new RateLimitExceededException(PLATFORM_MFA_RATE_LIMIT_WINDOW_MINUTES * 60);
    }

    const isRecoveryCode = PlatformMfaRecoveryCode.looksLikeRecoveryCode(input.code);
    let authMethod: 'totp' | 'recovery' | null = null;
    let recoveryCodesRemaining = 0;

    if (isRecoveryCode) {
      const hash = PlatformMfaRecoveryCode.hashRaw(input.code);
      const stored = await this.recoveryCodes.findByCodeHash(hash, user.id);
      if (stored) {
        await this.recoveryCodes.markUsed(stored.id);
        authMethod = 'recovery';
        recoveryCodesRemaining = await this.recoveryCodes.countUnused(user.id);
      }
    } else {
      const secret = this.mfa.decrypt(user.mfaSecretEncrypted);
      const stepId = this.mfa.currentStepId();
      if (!user.wasTotpStepAlreadyUsed(stepId) && this.mfa.verify(secret, input.code)) {
        authMethod = 'totp';
        await this.platformUsers.updateMfaState(user.recordTotpStep(stepId));
      }
    }

    if (!authMethod) {
      const failed = user.recordFailedMfa();
      await this.platformUsers.updateMfaState(failed);
      await this.events.publish(
        new PlatformMfaChallengeFailedEvent(user.id, 'invalid_code', failed.failedMfaCount),
      );
      throw new InvalidMfaCodeException();
    }

    if (authMethod === 'recovery') {
      await this.platformUsers.updateMfaState(user.resetMfaFailures());
      await this.events.publish(
        new PlatformMfaRecoveryCodeUsedEvent(user.id, recoveryCodesRemaining),
      );
    }

    const tokens = await this.sessionCompletion.complete({
      platformUserId: user.id,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      deviceLabel: input.deviceLabel ?? null,
      authMethod,
    });

    const succeeded = user.recordSuccessfulLogin(input.ipAddress);
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
      new PlatformMfaChallengeSucceededEvent(user.id, tokens.sessionId, authMethod),
    );
    await this.events.publish(
      new PlatformLoginSucceededEvent(user.id, tokens.sessionId, input.ipAddress),
    );

    return tokens;
  }
}
