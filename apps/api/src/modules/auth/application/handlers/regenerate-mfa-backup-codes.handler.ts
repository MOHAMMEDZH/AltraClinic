import { Inject, Injectable } from '@nestjs/common';
import { UserRepository } from '../../../identity/domain/user.repository.interface';
import { PasswordHasher } from '../../../identity/infrastructure/password-hasher';
import { TotpService } from '../../infrastructure/services/totp.service';
import { MfaBackupCodeService } from '../../infrastructure/services/mfa-backup-code.service';
import { InvalidCredentialsException } from '../../domain/exceptions/auth.exceptions';
import {
  InvalidMfaCodeException,
  MfaNotConfiguredException,
} from '../../domain/exceptions/mfa.exceptions';
import { USER_REPOSITORY } from '../../../../infrastructure/provider.tokens';

@Injectable()
export class RegenerateMfaBackupCodesHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    private readonly totp: TotpService,
    private readonly backupCodes: MfaBackupCodeService,
  ) {}

  async execute(
    userId: string,
    tenantId: string,
    password: string,
    code: string,
  ): Promise<{ backupCodes: string[]; remaining: number }> {
    const user = await this.userRepo.findById(userId, tenantId);
    if (!user) throw new InvalidCredentialsException();
    if (!user.mfaEnabled || !user.mfaSecret) throw new MfaNotConfiguredException();

    const passwordValid = await PasswordHasher.compare(password, user.passwordHash);
    if (!passwordValid) throw new InvalidCredentialsException();

    if (!this.totp.verify(user.mfaSecret, code)) {
      throw new InvalidMfaCodeException();
    }

    const backupCodes = await this.backupCodes.issueNewSet(userId, tenantId);
    return { backupCodes, remaining: backupCodes.length };
  }
}
