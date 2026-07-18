import { MfaBackupCode } from '../entities/mfa-backup-code.entity';

export interface MfaBackupCodeRepository {
  saveMany(codes: MfaBackupCode[]): Promise<void>;
  findUnusedByUserId(userId: string, tenantId: string): Promise<MfaBackupCode[]>;
  findByCodeHash(hash: string, userId: string, tenantId: string): Promise<MfaBackupCode | null>;
  save(code: MfaBackupCode): Promise<void>;
  deleteAllForUser(userId: string, tenantId: string): Promise<void>;
  countUnused(userId: string, tenantId: string): Promise<number>;
}
