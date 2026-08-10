import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PlatformRefreshTokenRepository } from '../../domain/repositories/platform-refresh-token.repository.interface';
import { PLATFORM_REFRESH_TOKEN_REPOSITORY } from '../../platform-auth.tokens';
import { JwtClaimsVO } from '../../domain/value-objects/jwt-claims.vo';
import { PlatformSessionPolicyService } from '../services/platform-session-policy.service';

export interface PlatformActivityResult {
  sessionId: string;
  lastInteractiveActivityAt: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  updated: boolean;
}

/**
 * Records verified interactive activity for the *current* platform session only.
 * Does not accept client timestamps or arbitrary session IDs.
 * Server-throttled; never extends absolute expiry; never grants step-up.
 */
@Injectable()
export class PlatformActivityHandler {
  constructor(
    @Inject(PLATFORM_REFRESH_TOKEN_REPOSITORY)
    private readonly refreshRepo: PlatformRefreshTokenRepository,
    private readonly sessionPolicy: PlatformSessionPolicyService,
  ) {}

  async execute(claims: JwtClaimsVO): Promise<PlatformActivityResult> {
    if (!claims.isPlatformSession()) {
      throw new UnauthorizedException('Platform authentication required.');
    }

    const session = await this.refreshRepo.findBySessionId(claims.sessionId);
    if (!session || !session.isValid() || session.platformUserId !== claims.sub) {
      throw new UnauthorizedException('Platform session required.');
    }

    await this.sessionPolicy.assertSessionAlive(session);

    const now = new Date();
    const minIntervalMs = this.sessionPolicy.activityMinIntervalSeconds * 1000;
    const elapsed = now.getTime() - session.lastActivityAt.getTime();
    let updated = false;

    if (elapsed >= minIntervalMs) {
      await this.sessionPolicy.touchInteractive(session.sessionId, now);
      updated = true;
    }

    const lastInteractive = updated ? now : session.lastActivityAt;
    const idleExpiresAt = new Date(
      lastInteractive.getTime() + this.sessionPolicy.idleSeconds * 1000,
    );

    return {
      sessionId: session.sessionId,
      lastInteractiveActivityAt: lastInteractive.toISOString(),
      idleExpiresAt: idleExpiresAt.toISOString(),
      absoluteExpiresAt: session.absoluteExpiresAt.toISOString(),
      updated,
    };
  }
}
