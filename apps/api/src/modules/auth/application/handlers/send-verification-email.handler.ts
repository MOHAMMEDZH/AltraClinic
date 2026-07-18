import { Inject, Injectable, Logger } from '@nestjs/common';
import { UserRepository } from '../../../identity/domain/user.repository.interface';
import { EmailVerificationTokenRepository } from '../../domain/repositories/email-verification-token.repository.interface';
import { EmailVerificationToken } from '../../domain/entities/email-verification-token.entity';
import { EmailSenderPort, EMAIL_SENDER } from '../../infrastructure/services/email-sender.port';
import { USER_REPOSITORY, EMAIL_VERIFICATION_TOKEN_REPOSITORY } from '../../../../infrastructure/provider.tokens';

@Injectable()
export class SendVerificationEmailHandler {
  private readonly logger = new Logger(SendVerificationEmailHandler.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(EMAIL_VERIFICATION_TOKEN_REPOSITORY) private readonly tokenRepo: EmailVerificationTokenRepository,
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSenderPort,
  ) {}

  async execute(userId: string, tenantId: string): Promise<void> {
    const user = await this.userRepo.findById(userId, tenantId);
    if (!user || user.emailVerified) return;

    await this.tokenRepo.invalidateAllForUser(userId);
    const [token, rawToken] = EmailVerificationToken.generate({ userId, tenantId, ttlHours: 24 });
    await this.tokenRepo.save(token);

    try {
      await this.emailSender.sendEmailVerification(user.email, rawToken);
    } catch (err) {
      this.logger.error(`Failed to send verification email to ${user.email}`, err);
    }
  }
}
