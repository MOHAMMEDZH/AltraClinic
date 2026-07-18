import { Inject, Injectable } from '@nestjs/common';
import { UserRepository } from '../../../identity/domain/user.repository.interface';
import { EmailVerificationTokenRepository } from '../../domain/repositories/email-verification-token.repository.interface';
import { EmailVerificationToken } from '../../domain/entities/email-verification-token.entity';
import {
  TokenInvalidException, TokenExpiredException,
} from '../../domain/exceptions/auth.exceptions';
import { USER_REPOSITORY, EMAIL_VERIFICATION_TOKEN_REPOSITORY } from '../../../../infrastructure/provider.tokens';

@Injectable()
export class VerifyEmailHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(EMAIL_VERIFICATION_TOKEN_REPOSITORY) private readonly tokenRepo: EmailVerificationTokenRepository,
  ) {}

  async execute(rawToken: string, tenantId: string): Promise<void> {
    const hash = EmailVerificationToken.hashRaw(rawToken);
    const token = await this.tokenRepo.findByTokenHash(hash);

    if (!token) throw new TokenInvalidException('Email verification');
    if (!token.isValid()) {
      if (token.isExpired()) throw new TokenExpiredException('Email verification');
      throw new TokenInvalidException('Email verification');
    }

    // Use tenantId from the token itself — prevents cross-tenant token replay
    const user = await this.userRepo.findById(token.userId, token.tenantId);
    if (!user) throw new TokenInvalidException('Email verification');

    await this.userRepo.save(user.verifyEmail());
    await this.tokenRepo.save(token.markUsed());
  }
}
