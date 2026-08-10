import { Inject, Injectable } from '@nestjs/common';

import { UserRepository } from '../../../identity/domain/user.repository.interface';

import { TrustedDeviceRepository } from '../../domain/repositories/trusted-device.repository.interface';

import { TrustedDevice, TRUSTED_DEVICE_TTL_DAYS } from '../../domain/entities/trusted-device.entity';

import { JwtTokenService } from '../../infrastructure/services/jwt-token.service';

import { TotpService } from '../../infrastructure/services/totp.service';

import { MfaBackupCodeService } from '../../infrastructure/services/mfa-backup-code.service';

import { LoginCompletionService } from '../services/login-completion.service';

import { DeviceInfoVO } from '../../domain/value-objects/device-info.vo';

import { InvalidMfaCodeException } from '../../domain/exceptions/mfa.exceptions';

import { TokenInvalidException } from '../../domain/exceptions/auth.exceptions';

import { USER_REPOSITORY, TRUSTED_DEVICE_REPOSITORY } from '../../../../infrastructure/provider.tokens';



export interface VerifyMfaResult {

  accessToken: string;

  refreshToken: string;

  accessExpiresIn: number;

  sessionId: string;

  deviceTrustToken?: string;

  deviceTrustExpiresIn?: number;

}



@Injectable()

export class VerifyMfaHandler {

  constructor(

    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,

    @Inject(TRUSTED_DEVICE_REPOSITORY) private readonly trustedDeviceRepo: TrustedDeviceRepository,

    private readonly jwtTokenService: JwtTokenService,

    private readonly totp: TotpService,

    private readonly backupCodes: MfaBackupCodeService,

    private readonly loginCompletion: LoginCompletionService,

  ) {}



  async execute(input: {

    mfaChallengeToken: string;

    code: string;

    ipAddress: string;

    userAgent: string;

    trustDevice?: boolean;

  }): Promise<VerifyMfaResult> {

    const claims = this.jwtTokenService.verifyMfaChallenge(input.mfaChallengeToken);

    if (!claims) {

      throw new TokenInvalidException('MFA challenge');

    }



    const user = await this.userRepo.findById(claims.sub, claims.tenantId);

    if (!user || !user.mfaEnabled || !user.mfaSecret) {

      throw new TokenInvalidException('MFA challenge');

    }



    const codeValid = this.backupCodes.looksLikeBackupCode(input.code)

      ? await this.backupCodes.consumeIfValid(input.code, user.id, user.tenantId)

      : this.totp.verify(user.mfaSecret, input.code);



    if (!codeValid) {

      throw new InvalidMfaCodeException();

    }



    const device = new DeviceInfoVO({

      ipAddress: claims.ipAddress || input.ipAddress,

      userAgent: claims.userAgent || input.userAgent,

      deviceName: claims.deviceName,

    });



    const pair = await this.loginCompletion.complete({
      user,
      email: user.email,
      tenantId: user.tenantId,
      sessionId: claims.sessionId,
      device,
      // Clinic MFA path only — never forward platform session class.
      sessionClass: claims.sessionClass === 'patient' ? 'patient' : 'staff',
    });



    let deviceTrustToken: string | undefined;

    let deviceTrustExpiresIn: number | undefined;



    if (input.trustDevice) {

      const [trusted, raw] = TrustedDevice.generate({

        userId: user.id,

        tenantId: user.tenantId,

        deviceName: claims.deviceName,

        ttlDays: TRUSTED_DEVICE_TTL_DAYS,

      });

      await this.trustedDeviceRepo.save(trusted);

      deviceTrustToken = raw;

      deviceTrustExpiresIn = TRUSTED_DEVICE_TTL_DAYS * 86_400;

    }



    return {

      accessToken: pair.accessToken,

      refreshToken: pair.refreshToken,

      accessExpiresIn: pair.accessExpiresIn,

      sessionId: pair.sessionId,

      deviceTrustToken,

      deviceTrustExpiresIn,

    };

  }

}

