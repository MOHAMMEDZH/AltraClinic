import { Inject, Injectable } from '@nestjs/common';

import { UserRepository } from '../../../identity/domain/user.repository.interface';

import { TotpService } from '../../infrastructure/services/totp.service';

import { MfaBackupCodeService } from '../../infrastructure/services/mfa-backup-code.service';

import {

  InvalidMfaCodeException,

  MfaNotConfiguredException,

} from '../../domain/exceptions/mfa.exceptions';

import { USER_REPOSITORY } from '../../../../infrastructure/provider.tokens';



@Injectable()

export class ConfirmMfaHandler {

  constructor(

    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,

    private readonly totp: TotpService,

    private readonly backupCodes: MfaBackupCodeService,

  ) {}



  async execute(

    userId: string,

    tenantId: string,

    code: string,

  ): Promise<{ enabled: boolean; backupCodes: string[] }> {

    const user = await this.userRepo.findById(userId, tenantId);

    if (!user || !user.mfaSecret) throw new MfaNotConfiguredException();

    if (user.mfaEnabled) {

      const remaining = await this.backupCodes.countRemaining(userId, tenantId);

      return { enabled: true, backupCodes: [] };

    }



    if (!this.totp.verify(user.mfaSecret, code)) {

      throw new InvalidMfaCodeException();

    }



    const updated = user.confirmMfaEnrollment();

    await this.userRepo.save(updated);

    const backupCodes = await this.backupCodes.issueNewSet(userId, tenantId);

    return { enabled: true, backupCodes };

  }

}

