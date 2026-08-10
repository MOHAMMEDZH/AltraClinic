import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PlatformRefreshTokenRepository } from '../../domain/repositories/platform-refresh-token.repository.interface';
import { PLATFORM_REFRESH_TOKEN_REPOSITORY } from '../../platform-auth.tokens';
import { JwtClaimsVO } from '../../domain/value-objects/jwt-claims.vo';
import { PlatformAssuranceService } from '../services/platform-assurance.service';

export interface PlatformStepUpStatusDto {
  stepUpFresh: boolean;
  stepUpVerifiedAt: Date | null;
}

@Injectable()
export class PlatformStepUpStatusHandler {
  constructor(
    @Inject(PLATFORM_REFRESH_TOKEN_REPOSITORY)
    private readonly refreshRepo: PlatformRefreshTokenRepository,
    private readonly assurance: PlatformAssuranceService,
  ) {}

  async execute(claims: JwtClaimsVO): Promise<PlatformStepUpStatusDto> {
    if (!claims.isPlatformSession()) {
      throw new UnauthorizedException('Platform authentication required.');
    }
    const session = await this.refreshRepo.findBySessionId(claims.sessionId);
    if (!session) {
      return { stepUpFresh: false, stepUpVerifiedAt: null };
    }
    return {
      stepUpFresh: this.assurance.isStepUpFresh(session),
      stepUpVerifiedAt: session.stepUpVerifiedAt,
    };
  }
}
