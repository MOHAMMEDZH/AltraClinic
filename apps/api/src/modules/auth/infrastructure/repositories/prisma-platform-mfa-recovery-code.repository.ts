import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { PlatformMfaRecoveryCode } from '../../domain/entities/platform-mfa-recovery-code.entity';
import { PlatformMfaRecoveryCodeRepository } from '../../domain/repositories/platform-mfa-recovery-code.repository.interface';

@Injectable()
export class PrismaPlatformMfaRecoveryCodeRepository implements PlatformMfaRecoveryCodeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async saveMany(codes: PlatformMfaRecoveryCode[]): Promise<void> {
    if (codes.length === 0) return;
    await this.prisma.platformMfaRecoveryCode.createMany({
      data: codes.map((code) => ({
        id: code.id,
        platformUserId: code.platformUserId,
        codeHash: code.codeHash,
        usedAt: code.usedAt,
        createdAt: code.createdAt,
      })),
    });
  }

  async findByCodeHash(
    codeHash: string,
    platformUserId: string,
  ): Promise<PlatformMfaRecoveryCode | null> {
    const row = await this.prisma.platformMfaRecoveryCode.findFirst({
      where: { codeHash, platformUserId, usedAt: null },
    });
    return row ? this.toDomain(row) : null;
  }

  async markUsed(id: string): Promise<void> {
    await this.prisma.platformMfaRecoveryCode.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  async deleteAllForUser(platformUserId: string): Promise<void> {
    await this.prisma.platformMfaRecoveryCode.deleteMany({ where: { platformUserId } });
  }

  async countUnused(platformUserId: string): Promise<number> {
    return this.prisma.platformMfaRecoveryCode.count({
      where: { platformUserId, usedAt: null },
    });
  }

  private toDomain(row: {
    id: string;
    platformUserId: string;
    codeHash: string;
    usedAt: Date | null;
    createdAt: Date;
  }): PlatformMfaRecoveryCode {
    return PlatformMfaRecoveryCode.restore(row);
  }
}
