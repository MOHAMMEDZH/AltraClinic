import { Inject, Injectable, Logger } from '@nestjs/common';
import { UserRepository } from '../../../identity/domain/user.repository.interface';
import { PasswordResetTokenRepository } from '../../domain/repositories/password-reset-token.repository.interface';
import { PasswordResetToken } from '../../domain/entities/password-reset-token.entity';
import { EmailSenderPort, EMAIL_SENDER } from '../../infrastructure/services/email-sender.port';
import { RateLimiterPort, RATE_LIMITER } from '../../infrastructure/services/rate-limiter.port';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { PasswordResetRequestedEvent } from '../../domain/events/auth.events';
import { RateLimitExceededException } from '../../domain/exceptions/auth.exceptions';
import {
  USER_REPOSITORY, EVENT_PUBLISHER, PASSWORD_RESET_TOKEN_REPOSITORY,
} from '../../../../infrastructure/provider.tokens';

// 3 requests per 15-minute window per email — prevents email spam & enumeration acceleration
const FORGOT_PW_LIMIT = 3;
const FORGOT_PW_WINDOW_SECS = 900;

@Injectable()
export class ForgotPasswordHandler {
  private readonly logger = new Logger(ForgotPasswordHandler.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(PASSWORD_RESET_TOKEN_REPOSITORY) private readonly tokenRepo: PasswordResetTokenRepository,
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSenderPort,
    @Inject(RATE_LIMITER) private readonly rateLimiter: RateLimiterPort,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherInterface,
  ) {}

  /**
   * Always returns success even if the email doesn't exist (prevents user enumeration).
   * Rate limited per email address to prevent email spam attacks.
   */
  async execute(input: { email: string; tenantId: string; ipAddress: string }): Promise<void> {
    const email = input.email.toLowerCase().trim();

    // Rate limit per email to prevent email-spam attacks (even for unknown addresses)
    const key = `forgot-pw:${input.tenantId}:${email}`;
    const count = await this.rateLimiter.increment(key, FORGOT_PW_WINDOW_SECS);
    if (count > FORGOT_PW_LIMIT) {
      // Still return success message — prevents enumeration of whether rate limit
      // is email-specific. The actual rejection is silent from the client's view.
      this.logger.warn(`Forgot-password rate limit exceeded for email: ${email}`);
      return;
    }
    const user = await this.userRepo.findByEmail(email, input.tenantId);

    // Silently exit — response is always 200 to prevent user enumeration
    if (!user || !user.isActive) return;

    // Invalidate any existing reset tokens for this user
    await this.tokenRepo.invalidateAllForUser(user.id);

    const [token, rawToken] = PasswordResetToken.generate({
      userId: user.id,
      tenantId: user.tenantId,
      ipAddress: input.ipAddress,
      ttlMinutes: 30,
    });

    await this.tokenRepo.save(token);

    try {
      await this.emailSender.sendPasswordReset(email, rawToken);
    } catch (err) {
      this.logger.error(`Failed to send password reset email to ${email}`, err);
    }

    await this.events.publish(new PasswordResetRequestedEvent(user.tenantId, user.id, email));
  }
}
