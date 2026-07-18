import { Inject, Injectable } from '@nestjs/common';
import { UserRepository } from '../../../identity/domain/user.repository.interface';
import { PasswordResetTokenRepository } from '../../domain/repositories/password-reset-token.repository.interface';
import { RefreshTokenRepository } from '../../domain/repositories/refresh-token.repository.interface';
import { TrustedDeviceRepository } from '../../domain/repositories/trusted-device.repository.interface';
import { PasswordResetToken } from '../../domain/entities/password-reset-token.entity';
import { PasswordHasher } from '../../../identity/infrastructure/password-hasher';
import { TenantPolicyService } from '../../../settings/application/services/tenant-policy.service';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { PasswordChangedEvent } from '../../domain/events/auth.events';
import {
  TokenInvalidException, TokenExpiredException, PasswordPolicyViolationException,
} from '../../domain/exceptions/auth.exceptions';
import {
  USER_REPOSITORY, EVENT_PUBLISHER,
  PASSWORD_RESET_TOKEN_REPOSITORY, REFRESH_TOKEN_REPOSITORY,
  TRUSTED_DEVICE_REPOSITORY,
} from '../../../../infrastructure/provider.tokens';

@Injectable()
export class ResetPasswordHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(PASSWORD_RESET_TOKEN_REPOSITORY) private readonly tokenRepo: PasswordResetTokenRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshRepo: RefreshTokenRepository,
    @Inject(TRUSTED_DEVICE_REPOSITORY) private readonly trustedDeviceRepo: TrustedDeviceRepository,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherInterface,
    private readonly tenantPolicy: TenantPolicyService,
  ) {}

  async execute(input: {
    rawToken: string;
    newPassword: string;
    tenantId: string;
  }): Promise<void> {
    const hash = PasswordResetToken.hashRaw(input.rawToken);
    const token = await this.tokenRepo.findByTokenHash(hash);

    if (!token) throw new TokenInvalidException('Password reset');
    if (!token.isValid()) {
      if (token.isExpired()) throw new TokenExpiredException('Password reset');
      throw new TokenInvalidException('Password reset');
    }

    const policy = await this.tenantPolicy.getPasswordPolicy(token.tenantId);
    const violations = policy.validate(input.newPassword);
    if (violations.length > 0) throw new PasswordPolicyViolationException(violations);

    // Use tenantId from the token itself — not from user-supplied input (prevents cross-tenant manipulation)
    const user = await this.userRepo.findById(token.userId, token.tenantId);
    if (!user) throw new TokenInvalidException('Password reset');

    const newHash = await PasswordHasher.hash(input.newPassword);
    const updatedUser = user.changePassword(newHash);
    await this.userRepo.save(updatedUser);

    // Mark token as used
    await this.tokenRepo.save(token.markUsed());

    // Revoke ALL sessions — force re-login everywhere after password change
    await this.refreshRepo.revokeAllByUserId(user.id);
    await this.trustedDeviceRepo.deleteAllForUser(user.id, user.tenantId);

    await this.events.publish(new PasswordChangedEvent(user.tenantId, user.id));
  }
}
