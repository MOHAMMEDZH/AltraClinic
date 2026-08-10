import { ForbiddenException, Injectable } from '@nestjs/common';
import { PlatformMfaService } from '../../infrastructure/services/platform-mfa.service';
import { PlatformRefreshToken } from '../../domain/entities/platform-refresh-token.entity';

/**
 * Phase 47 Step 07 — step-up assurance freshness. Sensitive operations
 * (recovery code regeneration, MFA factor replacement, revoke-others/all)
 * require a recent step-up verification on the CURRENT session, not merely
 * an active MFA session.
 */
@Injectable()
export class PlatformAssuranceService {
  constructor(private readonly mfa: PlatformMfaService) {}

  isStepUpFresh(session: PlatformRefreshToken): boolean {
    return session.isStepUpFresh(this.mfa.stepUpSeconds);
  }

  requireStepUp(session: PlatformRefreshToken): void {
    if (!this.isStepUpFresh(session)) {
      throw new ForbiddenException({
        code: 'PLATFORM_STEP_UP_REQUIRED',
        message: 'Step-up verification is required for this action.',
      });
    }
  }

  stepUpValiditySeconds(): number {
    return this.mfa.stepUpSeconds;
  }
}
