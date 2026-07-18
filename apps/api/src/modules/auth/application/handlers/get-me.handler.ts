import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UserRepository } from '../../../identity/domain/user.repository.interface';
import { MfaBackupCodeService } from '../../infrastructure/services/mfa-backup-code.service';
import { USER_REPOSITORY } from '../../../../infrastructure/provider.tokens';

@Injectable()
export class GetMeHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    private readonly backupCodes: MfaBackupCodeService,
  ) {}

  async execute(userId: string, tenantId: string, sessionId: string) {
    const user = await this.userRepo.findById(userId, tenantId);
    if (!user) throw new NotFoundException('User not found');

    const mfaBackupCodesRemaining = user.mfaEnabled
      ? await this.backupCodes.countRemaining(userId, tenantId)
      : 0;

    return {
      userId: user.id,
      tenantId: user.tenantId,
      branchId: user.branchId,
      roles: user.roles,
      sessionId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      emailVerified: user.emailVerified,
      mfaEnabled: user.mfaEnabled,
      mfaPending: Boolean(user.mfaSecret) && !user.mfaEnabled,
      mfaBackupCodesRemaining,
    };
  }
}
