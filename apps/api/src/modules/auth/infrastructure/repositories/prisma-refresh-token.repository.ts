import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { RefreshToken, RefreshTokenProps } from '../../domain/entities/refresh-token.entity';
import { RefreshTokenRepository } from '../../domain/repositories/refresh-token.repository.interface';

@Injectable()
export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(token: RefreshToken): Promise<void> {
    await this.prisma.refreshToken.upsert({
      where: { id: token.id },
      create: {
        id: token.id,
        userId: token.userId,
        tenantId: token.tenantId,
        tokenHash: token.tokenHash,
        sessionId: token.sessionId,
        deviceName: token.deviceName,
        expiresAt: token.expiresAt,
        revokedAt: token.revokedAt,
        ipAddress: token.ipAddress,
        userAgent: token.userAgent,
        createdAt: token.createdAt,
      },
      update: {
        revokedAt: token.revokedAt,
      },
    });
  }

  async findByTokenHash(hash: string): Promise<RefreshToken | null> {
    const row = await this.prisma.refreshToken.findFirst({ where: { tokenHash: hash } });
    return row ? this.toDomain(row) : null;
  }

  async findBySessionId(sessionId: string): Promise<RefreshToken | null> {
    const row = await this.prisma.refreshToken.findUnique({ where: { sessionId } });
    return row ? this.toDomain(row) : null;
  }

  async findActiveByUserId(userId: string, tenantId: string): Promise<RefreshToken[]> {
    const rows = await this.prisma.refreshToken.findMany({
      where: { userId, tenantId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async revokeBySessionId(sessionId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllByUserId(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async deleteExpired(): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  }

  private toDomain(row: {
    id: string; userId: string; tenantId: string; tokenHash: string; sessionId: string;
    deviceName: string | null; expiresAt: Date; revokedAt: Date | null;
    ipAddress: string | null; userAgent: string | null; createdAt: Date;
  }): RefreshToken {
    return RefreshToken.restore({
      id: row.id,
      userId: row.userId,
      tenantId: row.tenantId,
      tokenHash: row.tokenHash,
      sessionId: row.sessionId,
      deviceName: row.deviceName,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      createdAt: row.createdAt,
    });
  }
}
