import { Injectable } from '@nestjs/common';
import { LoyaltyRewardStatus as PrismaRewardStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { LoyaltyReward, LoyaltyRewardStatus } from '../domain/entities/loyalty-reward.entity';
import { LoyaltyRewardRepository } from '../domain/repositories/loyalty-reward.repository.interface';

@Injectable()
export class PrismaLoyaltyRewardRepository implements LoyaltyRewardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(reward: LoyaltyReward): Promise<void> {
    await this.prisma.loyaltyReward.upsert({
      where: { id: reward.rewardId },
      create: {
        id: reward.rewardId,
        tenantId: reward.tenantId,
        accountId: reward.accountId,
        pointsRequired: reward.pointsRequired,
        description: reward.description,
        metadata: reward.metadata !== null && reward.metadata !== undefined
          ? (reward.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        expiryDate: reward.expiryDate,
        status: reward.status.toUpperCase() as 'AVAILABLE' | 'EXPIRED' | 'REDEEMED',
        redeemedDate: reward.redeemedDate,
        createdAt: reward.createdAt,
      },
      update: {
        status: reward.status.toUpperCase() as 'AVAILABLE' | 'EXPIRED' | 'REDEEMED',
        redeemedDate: reward.redeemedDate,
        updatedAt: reward.updatedAt,
      },
    });
  }

  async findById(rewardId: string, tenantId: string): Promise<LoyaltyReward | null> {
    const row = await this.prisma.loyaltyReward.findFirst({
      where: { id: rewardId, tenantId, deletedAt: null },
    });
    return row ? this.toDomain(row) : null;
  }

  async listByAccount(accountId: string, tenantId: string): Promise<LoyaltyReward[]> {
    const rows = await this.prisma.loyaltyReward.findMany({
      where: { accountId, tenantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async listByTenant(tenantId: string): Promise<LoyaltyReward[]> {
    const rows = await this.prisma.loyaltyReward.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  async listAvailableByTenant(tenantId: string): Promise<LoyaltyReward[]> {
    const now = new Date();
    const rows = await this.prisma.loyaltyReward.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: PrismaRewardStatus.AVAILABLE,
        OR: [{ expiryDate: null }, { expiryDate: { gt: now } }],
      },
      orderBy: { pointsRequired: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  private toDomain(row: {
    id: string;
    tenantId: string;
    accountId: string;
    pointsRequired: number;
    description: string;
    metadata: unknown;
    expiryDate: Date | null;
    status: PrismaRewardStatus;
    redeemedDate: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): LoyaltyReward {
    return LoyaltyReward.restore({
      rewardId: row.id,
      tenantId: row.tenantId,
      accountId: row.accountId,
      pointsRequired: row.pointsRequired,
      description: row.description,
      metadata: row.metadata as Record<string, unknown> | null,
      expiryDate: row.expiryDate,
      status: row.status.toLowerCase() as LoyaltyRewardStatus, // AVAILABLE → available, EXPIRED → expired, REDEEMED → redeemed
      redeemedDate: row.redeemedDate,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
