import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PlatformRefreshTokenRepository } from '../../domain/repositories/platform-refresh-token.repository.interface';
import { PLATFORM_REFRESH_TOKEN_REPOSITORY } from '../../platform-auth.tokens';
import { JwtClaimsVO } from '../../domain/value-objects/jwt-claims.vo';
import { PlatformAssuranceService } from '../services/platform-assurance.service';
import { summarizeUserAgent } from '../platform-device-summary';
import { PlatformSessionPolicyService } from '../services/platform-session-policy.service';

export interface PlatformSessionDto {
  sessionId: string;
  createdAt: Date;
  lastInteractiveActivityAt: Date;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  /** Privacy-minimized summary — never the raw user-agent. */
  deviceSummary: string;
  deviceCategory: string;
  deviceLabel: string | null;
  assuranceLevel: string;
  authMethod: string | null;
  isCurrent: boolean;
  isStepUpFresh: boolean;
}

/** Returns ONLY the caller's own sessions — no cross-user data, no hashes/tokens/raw UA. */
@Injectable()
export class PlatformListSessionsHandler {
  constructor(
    @Inject(PLATFORM_REFRESH_TOKEN_REPOSITORY)
    private readonly refreshRepo: PlatformRefreshTokenRepository,
    private readonly assurance: PlatformAssuranceService,
    private readonly sessionPolicy: PlatformSessionPolicyService,
  ) {}

  async execute(claims: JwtClaimsVO): Promise<PlatformSessionDto[]> {
    if (!claims.isPlatformSession()) {
      throw new UnauthorizedException('Platform authentication required.');
    }

    const sessions = await this.refreshRepo.findActiveByUserId(claims.sub);
    // Passive listing must not extend interactive activity.
    return sessions.map((session) => {
      const device = summarizeUserAgent(session.userAgent);
      return {
        sessionId: session.sessionId,
        createdAt: session.createdAt,
        lastInteractiveActivityAt: session.lastActivityAt,
        idleExpiresAt: new Date(
          session.lastActivityAt.getTime() + this.sessionPolicy.idleSeconds * 1000,
        ),
        absoluteExpiresAt: session.absoluteExpiresAt,
        deviceSummary: device.summary,
        deviceCategory: device.category,
        deviceLabel: session.deviceLabel,
        assuranceLevel: session.assuranceLevel,
        authMethod: session.authMethod,
        isCurrent: session.sessionId === claims.sessionId,
        isStepUpFresh: this.assurance.isStepUpFresh(session),
      };
    });
  }
}
