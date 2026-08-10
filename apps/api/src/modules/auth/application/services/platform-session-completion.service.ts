import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { JwtTokenService } from '../../infrastructure/services/jwt-token.service';
import { PlatformMfaService } from '../../infrastructure/services/platform-mfa.service';
import {
  PlatformRefreshToken,
  PlatformSessionAuthMethod,
} from '../../domain/entities/platform-refresh-token.entity';
import { PlatformRefreshTokenRepository } from '../../domain/repositories/platform-refresh-token.repository.interface';
import { PLATFORM_REFRESH_TOKEN_REPOSITORY } from '../../platform-auth.tokens';
import { TokenPairVO } from '../../domain/value-objects/token-pair.vo';

/**
 * Phase 47 Step 07 — issues the platform access+refresh token pair and the
 * backing session row ONLY after MFA has been completed. Never called from
 * the password-only login path.
 */
@Injectable()
export class PlatformSessionCompletionService {
  constructor(
    @Inject(PLATFORM_REFRESH_TOKEN_REPOSITORY)
    private readonly refreshRepo: PlatformRefreshTokenRepository,
    private readonly jwtTokenService: JwtTokenService,
    private readonly mfa: PlatformMfaService,
  ) {}

  async complete(input: {
    platformUserId: string;
    ipAddress: string;
    userAgent: string;
    deviceLabel?: string | null;
    authMethod: PlatformSessionAuthMethod;
  }): Promise<TokenPairVO> {
    const sessionId = this.jwtTokenService.generateSessionId();
    const familyId = randomUUID();
    const tokens = this.jwtTokenService.issuePlatformTokenPair({
      platformUserId: input.platformUserId,
      sessionId,
    });
    const now = new Date();

    await this.refreshRepo.save(
      PlatformRefreshToken.create({
        platformUserId: input.platformUserId,
        rawToken: tokens.refreshToken,
        sessionId,
        familyId,
        expiresAt: this.jwtTokenService.getPlatformRefreshExpiresAt(),
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        absoluteExpiresAt: new Date(now.getTime() + this.mfa.sessionAbsoluteSeconds * 1000),
        mfaCompletedAt: now,
        assuranceLevel: 'mfa',
        deviceLabel: input.deviceLabel ?? null,
        authMethod: input.authMethod,
      }),
    );

    return tokens;
  }
}
