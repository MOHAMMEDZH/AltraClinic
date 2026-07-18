import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { MfaBackupCode } from '../../domain/entities/mfa-backup-code.entity';
import { MfaBackupCodeRepository } from '../../domain/repositories/mfa-backup-code.repository.interface';

@Injectable()
export class PrismaMfaBackupCodeRepository implements MfaBackupCodeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async saveMany(codes: MfaBackupCode[]): Promise<void> {
    if (codes.length === 0) return;
    await this.prisma.mfaBackupCode.createMany({
      data: codes.map((code) => ({
        id: code.id,
        userId: code.userId,
        tenantId: code.tenantId,
        codeHash: code.codeHash,
        usedAt: code.usedAt,
        createdAt: code.createdAt,
      })),
    });
  }

  async findUnusedByUserId(userId: string, tenantId: string): Promise<MfaBackupCode[]> {
    const rows = await this.prisma.mfaBackupCode.findMany({
      where: { userId, tenantId, usedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async findByCodeHash(hash: string, userId: string, tenantId: string): Promise<MfaBackupCode | null> {
    const row = await this.prisma.mfaBackupCode.findFirst({
      where: { codeHash: hash, userId, tenantId, usedAt: null },
    });
    return row ? this.toDomain(row) : null;
  }

  async save(code: MfaBackupCode): Promise<void> {
    await this.prisma.mfaBackupCode.update({
      where: { id: code.id },
      data: { usedAt: code.usedAt },
    });
  }

  async deleteAllForUser(userId: string, tenantId: string): Promise<void> {
    await this.prisma.mfaBackupCode.deleteMany({ where: { userId, tenantId } });
  }

  async countUnused(userId: string, tenantId: string): Promise<number> {
    return this.prisma.mfaBackupCode.count({ where: { userId, tenantId, usedAt: null } });
  }

  private toDomain(row: {
    id: string;
    userId: string;
    tenantId: string;
    codeHash: string;
    usedAt: Date | null;
    createdAt: Date;
  }): MfaBackupCode {
    return MfaBackupCode.restore({
      id: row.id,
      userId: row.userId,
      tenantId: row.tenantId,
      codeHash: row.codeHash,
      usedAt: row.usedAt,
      createdAt: row.createdAt,
    });
  }
}
