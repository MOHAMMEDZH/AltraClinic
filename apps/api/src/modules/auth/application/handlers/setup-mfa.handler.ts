import { Inject, Injectable } from '@nestjs/common';
import { UserRepository } from '../../../identity/domain/user.repository.interface';
import { TotpService } from '../../infrastructure/services/totp.service';
import { MfaAlreadyEnabledException } from '../../domain/exceptions/mfa.exceptions';
import { USER_REPOSITORY } from '../../../../infrastructure/provider.tokens';

@Injectable()
export class SetupMfaHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    private readonly totp: TotpService,
  ) {}

  async execute(userId: string, tenantId: string): Promise<{
    secret: string;
    otpauthUrl: string;
    pending: boolean;
  }> {
    const user = await this.userRepo.findById(userId, tenantId);
    if (!user) throw new Error('User not found');
    if (user.mfaEnabled) throw new MfaAlreadyEnabledException();

    const secret = this.totp.generateSecret();
    const updated = user.beginMfaEnrollment(secret);
    await this.userRepo.save(updated);

    return {
      secret,
      otpauthUrl: this.totp.buildOtpauthUrl(user.email, secret),
      pending: true,
    };
  }
}
