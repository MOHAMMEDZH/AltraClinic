import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { UserRepository } from '../../../identity/domain/user.repository.interface';
import { RefreshTokenRepository } from '../../domain/repositories/refresh-token.repository.interface';
import { TrustedDeviceRepository } from '../../domain/repositories/trusted-device.repository.interface';
import { PasswordHasher } from '../../../identity/infrastructure/password-hasher';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { PasswordChangedEvent } from '../../domain/events/auth.events';
import {
  InvalidCredentialsException,
  PasswordPolicyViolationException,
} from '../../domain/exceptions/auth.exceptions';
import {
  USER_REPOSITORY,
  EVENT_PUBLISHER,
  REFRESH_TOKEN_REPOSITORY,
  TRUSTED_DEVICE_REPOSITORY,
} from '../../../../infrastructure/provider.tokens';
import { TenantPolicyService } from '../../../settings/application/services/tenant-policy.service';

@Injectable()
export class ChangePasswordHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshRepo: RefreshTokenRepository,
    @Inject(TRUSTED_DEVICE_REPOSITORY) private readonly trustedDeviceRepo: TrustedDeviceRepository,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherInterface,
    private readonly tenantPolicy: TenantPolicyService,
  ) {}

  async execute(input: {
    userId: string;
    tenantId: string;
    currentPassword: string;
    newPassword: string;
    currentSessionId: string;
  }): Promise<{ revokedOtherSessions: number }> {
    const policy = await this.tenantPolicy.getPasswordPolicy(input.tenantId);
    const violations = policy.validate(input.newPassword);
    if (violations.length > 0) throw new PasswordPolicyViolationException(violations);

    if (input.currentPassword === input.newPassword) {
      throw new BadRequestException('New password must be different from your current password.');
    }

    const user = await this.userRepo.findById(input.userId, input.tenantId);
    if (!user) throw new InvalidCredentialsException();

    const matches = await PasswordHasher.compare(input.currentPassword, user.passwordHash);
    if (!matches) throw new InvalidCredentialsException();

    const newHash = await PasswordHasher.hash(input.newPassword);
    await this.userRepo.save(user.changePassword(newHash));

    const active = await this.refreshRepo.findActiveByUserId(input.userId, input.tenantId);
    const others = active.filter((t) => t.sessionId !== input.currentSessionId);
    for (const token of others) {
      await this.refreshRepo.revokeBySessionId(token.sessionId);
    }

    await this.trustedDeviceRepo.deleteAllForUser(input.userId, input.tenantId);

    await this.events.publish(new PasswordChangedEvent(input.tenantId, input.userId));

    return { revokedOtherSessions: others.length };
  }
}
