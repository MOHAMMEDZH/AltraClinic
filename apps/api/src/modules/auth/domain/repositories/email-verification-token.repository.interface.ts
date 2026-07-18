import { EmailVerificationToken } from '../entities/email-verification-token.entity';

export interface EmailVerificationTokenRepository {
  save(token: EmailVerificationToken): Promise<void>;
  findByTokenHash(hash: string): Promise<EmailVerificationToken | null>;
  invalidateAllForUser(userId: string): Promise<void>;
}
