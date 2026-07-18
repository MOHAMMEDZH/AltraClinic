import { Inject, Injectable } from '@nestjs/common';
import { MfaBackupCode } from '../../domain/entities/mfa-backup-code.entity';
import { MfaBackupCodeRepository } from '../../domain/repositories/mfa-backup-code.repository.interface';
import { MFA_BACKUP_CODE_REPOSITORY } from '../../../../infrastructure/provider.tokens';

@Injectable()
export class MfaBackupCodeService {
  constructor(
    @Inject(MFA_BACKUP_CODE_REPOSITORY) private readonly backupRepo: MfaBackupCodeRepository,
  ) {}

  async issueNewSet(userId: string, tenantId: string): Promise<string[]> {
    await this.backupRepo.deleteAllForUser(userId, tenantId);
    const [entities, rawCodes] = MfaBackupCode.generateBatch({ userId, tenantId });
    await this.backupRepo.saveMany(entities);
    return rawCodes;
  }

  async consumeIfValid(rawCode: string, userId: string, tenantId: string): Promise<boolean> {
    const hash = MfaBackupCode.hashRaw(rawCode);
    const stored = await this.backupRepo.findByCodeHash(hash, userId, tenantId);
    if (!stored) return false;
    await this.backupRepo.save(stored.markUsed());
    return true;
  }

  looksLikeBackupCode(code: string): boolean {
    const normalized = MfaBackupCode.normalize(code);
    return normalized.length === 8 && !/^\d{6}$/.test(code);
  }

  async countRemaining(userId: string, tenantId: string): Promise<number> {
    return this.backupRepo.countUnused(userId, tenantId);
  }

  async clearForUser(userId: string, tenantId: string): Promise<void> {
    await this.backupRepo.deleteAllForUser(userId, tenantId);
  }
}
