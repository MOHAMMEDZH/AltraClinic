import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { EmailVerificationToken } from '../../domain/entities/email-verification-token.entity';
import { EmailVerificationTokenRepository } from '../../domain/repositories/email-verification-token.repository.interface';

@Injectable()
export class PrismaEmailVerificationTokenRepository implements EmailVerificationTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(token: EmailVerificationToken): Promise<void> {
    await this.prisma.emailVerificationToken.upsert({
      where: { id: token.id },
      create: {
        id: token.id,
        userId: token.userId,
        tenantId: token.tenantId,
        tokenHash: token.tokenHash,
        expiresAt: token.expiresAt,
        usedAt: token.usedAt,
        createdAt: token.createdAt,
      },
      update: { usedAt: token.usedAt },
    });
  }

  async findByTokenHash(hash: string): Promise<EmailVerificationToken | null> {
    const row = await this.prisma.emailVerificationToken.findFirst({ where: { tokenHash: hash } });
    return row ? EmailVerificationToken.restore(row) : null;
  }

  async invalidateAllForUser(userId: string): Promise<void> {
    await this.prisma.emailVerificationToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  }
}
