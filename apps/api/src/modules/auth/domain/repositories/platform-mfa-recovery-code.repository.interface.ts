import { PlatformMfaRecoveryCode } from '../entities/platform-mfa-recovery-code.entity';

export interface PlatformMfaRecoveryCodeRepository {
  saveMany(codes: PlatformMfaRecoveryCode[]): Promise<void>;
  findByCodeHash(codeHash: string, platformUserId: string): Promise<PlatformMfaRecoveryCode | null>;
  markUsed(id: string): Promise<void>;
  deleteAllForUser(platformUserId: string): Promise<void>;
  countUnused(platformUserId: string): Promise<number>;
}
