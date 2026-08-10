import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PlatformUserRepository } from '../../domain/repositories/platform-user.repository.interface';
import { PlatformMfaRecoveryCodeRepository } from '../../domain/repositories/platform-mfa-recovery-code.repository.interface';
import {
  PLATFORM_MFA_RECOVERY_CODE_REPOSITORY,
  PLATFORM_USER_REPOSITORY,
} from '../../platform-auth.tokens';
import { JwtClaimsVO } from '../../domain/value-objects/jwt-claims.vo';

export interface PlatformMfaStatusDto {
  mfaEnabled: boolean;
  mfaConfirmedAt: Date | null;
  recoveryCodesRemaining: number;
}

@Injectable()
export class PlatformMfaStatusHandler {
  constructor(
    @Inject(PLATFORM_USER_REPOSITORY) private readonly platformUsers: PlatformUserRepository,
    @Inject(PLATFORM_MFA_RECOVERY_CODE_REPOSITORY)
    private readonly recoveryCodes: PlatformMfaRecoveryCodeRepository,
  ) {}

  async execute(claims: JwtClaimsVO): Promise<PlatformMfaStatusDto> {
    if (!claims.isPlatformSession()) {
      throw new UnauthorizedException('Platform authentication required.');
    }
    const user = await this.platformUsers.findById(claims.sub);
    if (!user) {
      throw new UnauthorizedException('Platform authentication required.');
    }

    const recoveryCodesRemaining = user.mfaEnabled
      ? await this.recoveryCodes.countUnused(user.id)
      : 0;

    return {
      mfaEnabled: user.mfaEnabled,
      mfaConfirmedAt: user.mfaConfirmedAt,
      recoveryCodesRemaining,
    };
  }
}
