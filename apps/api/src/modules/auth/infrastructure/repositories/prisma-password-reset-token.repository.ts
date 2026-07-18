import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { PasswordResetToken } from '../../domain/entities/password-reset-token.entity';
import { PasswordResetTokenRepository } from '../../domain/repositories/password-reset-token.repository.interface';

@Injectable()
export class PrismaPasswordResetTokenRepository implements PasswordResetTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(token: PasswordResetToken): Promise<void> {
    await this.prisma.passwordResetToken.upsert({
      where: { id: token.id },
      create: {
        id: token.id,
        userId: token.userId,
        tenantId: token.tenantId,
        tokenHash: token.tokenHash,
        expiresAt: token.expiresAt,
        usedAt: token.usedAt,
        ipAddress: token.ipAddress,
        createdAt: token.createdAt,
      },
      update: { usedAt: token.usedAt },
    });
  }

  async findByTokenHash(hash: string): Promise<PasswordResetToken | null> {
    const row = await this.prisma.passwordResetToken.findFirst({ where: { tokenHash: hash } });
    return row ? PasswordResetToken.restore(row) : null;
  }

  async invalidateAllForUser(userId: string): Promise<void> {
    await this.prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  }
}
