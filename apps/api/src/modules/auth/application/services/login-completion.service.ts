import { Inject, Injectable } from '@nestjs/common';
import { User } from '../../../identity/domain/user.entity';
import { UserRepository } from '../../../identity/domain/user.repository.interface';
import { RefreshTokenRepository } from '../../domain/repositories/refresh-token.repository.interface';
import { LoginAttemptRepository } from '../../domain/repositories/login-attempt.repository.interface';
import { JwtTokenService } from '../../infrastructure/services/jwt-token.service';
import { RefreshToken } from '../../domain/entities/refresh-token.entity';
import { LoginAttempt } from '../../domain/entities/login-attempt.entity';
import { TokenPairVO } from '../../domain/value-objects/token-pair.vo';
import { DeviceInfoVO } from '../../domain/value-objects/device-info.vo';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { UserLoggedInEvent } from '../../domain/events/auth.events';
import {
  USER_REPOSITORY,
  EVENT_PUBLISHER,
  REFRESH_TOKEN_REPOSITORY,
  LOGIN_ATTEMPT_REPOSITORY,
} from '../../../../infrastructure/provider.tokens';

@Injectable()
export class LoginCompletionService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshRepo: RefreshTokenRepository,
    @Inject(LOGIN_ATTEMPT_REPOSITORY) private readonly attemptRepo: LoginAttemptRepository,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherInterface,
    private readonly jwtTokenService: JwtTokenService,
  ) {}

  async complete(input: {
    user: User;
    email: string;
    tenantId: string;
    sessionId: string;
    device: DeviceInfoVO;
  }): Promise<TokenPairVO> {
    const { user, email, tenantId, sessionId, device } = input;

    const tokenPair = this.jwtTokenService.issueTokenPair({
      userId: user.id,
      tenantId: user.tenantId,
      branchId: user.branchId,
      roles: user.roles,
      sessionId,
    });

    const refreshToken = RefreshToken.create({
      userId: user.id,
      tenantId: user.tenantId,
      rawToken: tokenPair.refreshToken,
      sessionId,
      deviceName: device.label,
      expiresAt: this.jwtTokenService.getRefreshExpiresAt(),
      ipAddress: device.ipAddress,
      userAgent: device.userAgent,
    });

    await this.refreshRepo.save(refreshToken);

    const updatedUser = user.recordSuccessfulLogin(device.ipAddress);
    await this.userRepo.updateLoginState(updatedUser);
    await this.attemptRepo.save(
      LoginAttempt.recordSuccess({
        email,
        tenantId,
        ipAddress: device.ipAddress,
        userAgent: device.userAgent,
      }),
    );
    await this.events.publish(
      new UserLoggedInEvent(user.tenantId, user.id, sessionId, device.ipAddress, device.label),
    );

    return tokenPair;
  }
}
