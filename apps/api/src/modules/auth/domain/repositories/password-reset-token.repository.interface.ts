import { PasswordResetToken } from '../entities/password-reset-token.entity';

export interface PasswordResetTokenRepository {
  save(token: PasswordResetToken): Promise<void>;
  findByTokenHash(hash: string): Promise<PasswordResetToken | null>;
  invalidateAllForUser(userId: string): Promise<void>;
}
