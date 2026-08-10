import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import {
  PlatformRefreshToken,
  PlatformSessionAssuranceLevel,
  PlatformSessionAuthMethod,
} from '../../domain/entities/platform-refresh-token.entity';
import { PlatformRefreshTokenRepository } from '../../domain/repositories/platform-refresh-token.repository.interface';

type PlatformRefreshTokenRow = {
  id: string;
  platformUserId: string;
  tokenHash: string;
  sessionId: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  lastActivityAt: Date;
  absoluteExpiresAt: Date;
  mfaCompletedAt: Date | null;
  assuranceLevel: string;
  stepUpVerifiedAt: Date | null;
  deviceLabel: string | null;
  authMethod: string | null;
  revocationReason: string | null;
};

@Injectable()
export class PrismaPlatformRefreshTokenRepository implements PlatformRefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(token: PlatformRefreshToken): Promise<void> {
    await this.prisma.platformRefreshToken.upsert({
      where: { id: token.id },
      create: {
        id: token.id,
        platformUserId: token.platformUserId,
        tokenHash: token.tokenHash,
        sessionId: token.sessionId,
        familyId: token.familyId,
        expiresAt: token.expiresAt,
        revokedAt: token.revokedAt,
        ipAddress: token.ipAddress,
        userAgent: token.userAgent,
        createdAt: token.createdAt,
        lastActivityAt: token.lastActivityAt,
        absoluteExpiresAt: token.absoluteExpiresAt,
        mfaCompletedAt: token.mfaCompletedAt,
        assuranceLevel: token.assuranceLevel,
        stepUpVerifiedAt: token.stepUpVerifiedAt,
        deviceLabel: token.deviceLabel,
        authMethod: token.authMethod,
        revocationReason: token.revocationReason,
      },
      update: {
        tokenHash: token.tokenHash,
        revokedAt: token.revokedAt,
        lastActivityAt: token.lastActivityAt,
        stepUpVerifiedAt: token.stepUpVerifiedAt,
        revocationReason: token.revocationReason,
      },
    });
  }

  async findByTokenHash(hash: string): Promise<PlatformRefreshToken | null> {
    const row = await this.prisma.platformRefreshToken.findFirst({
      where: { tokenHash: hash },
    });
    return row ? this.map(row) : null;
  }

  async findById(id: string): Promise<PlatformRefreshToken | null> {
    const row = await this.prisma.platformRefreshToken.findUnique({ where: { id } });
    return row ? this.map(row) : null;
  }

  async findBySessionId(sessionId: string): Promise<PlatformRefreshToken | null> {
    const row = await this.prisma.platformRefreshToken.findUnique({ where: { sessionId } });
    return row ? this.map(row) : null;
  }

  async findActiveByUserId(platformUserId: string): Promise<PlatformRefreshToken[]> {
    const rows = await this.prisma.platformRefreshToken.findMany({
      where: { platformUserId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.map(row));
  }

  async revokeBySessionId(sessionId: string, reason?: string): Promise<void> {
    await this.prisma.platformRefreshToken.updateMany({
      where: { sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revocationReason: reason ?? null },
    });
  }

  /** Ownership-scoped revoke — prevents cross-user session IDOR at the persistence layer. */
  async revokeBySessionIdForUser(
    platformUserId: string,
    sessionId: string,
    reason?: string,
  ): Promise<number> {
    const result = await this.prisma.platformRefreshToken.updateMany({
      where: { sessionId, platformUserId, revokedAt: null },
      data: { revokedAt: new Date(), revocationReason: reason ?? null },
    });
    return result.count;
  }

  async revokeAllByUserId(platformUserId: string, reason?: string): Promise<number> {
    const result = await this.prisma.platformRefreshToken.updateMany({
      where: { platformUserId, revokedAt: null },
      data: { revokedAt: new Date(), revocationReason: reason ?? null },
    });
    return result.count;
  }

  async revokeOthersByUserId(
    platformUserId: string,
    exceptSessionId: string,
    reason?: string,
  ): Promise<number> {
    const result = await this.prisma.platformRefreshToken.updateMany({
      where: { platformUserId, revokedAt: null, sessionId: { not: exceptSessionId } },
      data: { revokedAt: new Date(), revocationReason: reason ?? null },
    });
    return result.count;
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.platformRefreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async touchActivity(sessionId: string, at: Date): Promise<void> {
    await this.prisma.platformRefreshToken.updateMany({
      where: { sessionId, revokedAt: null },
      data: { lastActivityAt: at },
    });
  }

  async markStepUpVerified(sessionId: string, at: Date): Promise<void> {
    await this.prisma.platformRefreshToken.updateMany({
      where: { sessionId, revokedAt: null },
      data: { stepUpVerifiedAt: at },
    });
  }

  private map(row: PlatformRefreshTokenRow): PlatformRefreshToken {
    return PlatformRefreshToken.restore({
      ...row,
      assuranceLevel: row.assuranceLevel as PlatformSessionAssuranceLevel,
      authMethod: row.authMethod as PlatformSessionAuthMethod | null,
    });
  }
}
