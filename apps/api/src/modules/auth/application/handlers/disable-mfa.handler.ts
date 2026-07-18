import { Inject, Injectable } from '@nestjs/common';

import { UserRepository } from '../../../identity/domain/user.repository.interface';

import { TrustedDeviceRepository } from '../../domain/repositories/trusted-device.repository.interface';

import { PasswordHasher } from '../../../identity/infrastructure/password-hasher';

import { TotpService } from '../../infrastructure/services/totp.service';

import { MfaBackupCodeService } from '../../infrastructure/services/mfa-backup-code.service';

import { InvalidCredentialsException } from '../../domain/exceptions/auth.exceptions';

import {

  InvalidMfaCodeException,

  MfaNotConfiguredException,

} from '../../domain/exceptions/mfa.exceptions';

import { USER_REPOSITORY, TRUSTED_DEVICE_REPOSITORY } from '../../../../infrastructure/provider.tokens';



@Injectable()

export class DisableMfaHandler {

  constructor(

    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,

    @Inject(TRUSTED_DEVICE_REPOSITORY) private readonly trustedDeviceRepo: TrustedDeviceRepository,

    private readonly totp: TotpService,

    private readonly backupCodes: MfaBackupCodeService,

  ) {}



  async execute(

    userId: string,

    tenantId: string,

    password: string,

    code: string,

  ): Promise<{ enabled: boolean }> {

    const user = await this.userRepo.findById(userId, tenantId);

    if (!user) throw new InvalidCredentialsException();

    if (!user.mfaEnabled || !user.mfaSecret) throw new MfaNotConfiguredException();



    const passwordValid = await PasswordHasher.compare(password, user.passwordHash);

    if (!passwordValid) throw new InvalidCredentialsException();



    const codeValid = this.backupCodes.looksLikeBackupCode(code)

      ? await this.backupCodes.consumeIfValid(code, userId, tenantId)

      : this.totp.verify(user.mfaSecret, code);

    if (!codeValid) {

      throw new InvalidMfaCodeException();

    }



    const updated = user.disableMfa();

    await this.userRepo.save(updated);

    await this.backupCodes.clearForUser(userId, tenantId);

    await this.trustedDeviceRepo.deleteAllForUser(userId, tenantId);

    return { enabled: false };

  }

}

