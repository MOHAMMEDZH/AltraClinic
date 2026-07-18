import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { LoyaltyAccount } from '../domain/entities/loyalty-account.entity';
import { LoyaltyTransaction } from '../domain/entities/loyalty-transaction.entity';
import { LoyaltyAccountRepository } from '../domain/repositories/loyalty-account.repository.interface';
import { LoyaltyPoints } from '../domain/value-objects/loyalty-points.vo';
import { LoyaltyTier, LoyaltyTierName } from '../domain/value-objects/tier.vo';
import { LoyaltyTierService } from '../domain/services/loyalty-tier.service';

type PrismaAccountRow = Prisma.LoyaltyAccountGetPayload<{ include: { transactions: true } }>;

@Injectable()
export class PrismaLoyaltyAccountRepository implements LoyaltyAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(account: LoyaltyAccount): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.loyaltyAccount.upsert({
        where: { id: account.accountId },
        create: {
          id: account.accountId,
          tenantId: account.tenantId,
          patientId: account.patientId,
          clinicId: account.clinicId,
          pointsBalance: account.points.balance,
          tier: account.tier.name.toUpperCase() as 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM',
          enrollmentDate: account.enrollmentDate,
          lastActivityDate: account.lastActivityDate,
          isActive: account.isActive,
          createdAt: account.createdAt,
        },
        update: {
          pointsBalance: account.points.balance,
          tier: account.tier.name.toUpperCase() as 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM',
          lastActivityDate: account.lastActivityDate,
          isActive: account.isActive,
          updatedAt: account.updatedAt,
        },
      });

      // Persist only new transactions (loyalty transactions are append-only)
      const existingTxIds = new Set(
        (
          await tx.loyaltyTransaction.findMany({
            where: { accountId: account.accountId },
            select: { id: true },
          })
        ).map((r) => r.id),
      );

      const newTransactions = account.transactions.filter((t) => !existingTxIds.has(t.transactionId));
      for (const txn of newTransactions) {
        await tx.loyaltyTransaction.create({
          data: {
            id: txn.transactionId,
            accountId: txn.accountId,
            tenantId: account.tenantId,
            type: txn.type.toUpperCase() as 'EARN' | 'REDEEM' | 'EXPIRE' | 'ADJUST',
            pointsAmount: txn.pointsAmount,
            reference: txn.reference,
            description: txn.description,
            transactionDate: txn.transactionDate,
            createdAt: txn.createdAt,
          },
        });
      }
    });
  }

  async findById(accountId: string, tenantId: string): Promise<LoyaltyAccount | null> {
    const row = await this.prisma.loyaltyAccount.findFirst({
      where: { id: accountId, tenantId },
      include: { transactions: { orderBy: { transactionDate: 'asc' } } },
    });
    return row ? this.toDomain(row) : null;
  }

  async findByPatient(patientId: string, tenantId: string): Promise<LoyaltyAccount | null> {
    const row = await this.prisma.loyaltyAccount.findFirst({
      where: { patientId, tenantId },
      include: { transactions: { orderBy: { transactionDate: 'asc' } } },
    });
    return row ? this.toDomain(row) : null;
  }

  async listByTenant(tenantId: string): Promise<LoyaltyAccount[]> {
    const rows = await this.prisma.loyaltyAccount.findMany({
      where: { tenantId },
      include: { transactions: { orderBy: { transactionDate: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  private toDomain(row: PrismaAccountRow): LoyaltyAccount {
    const transactions = row.transactions.map((t) =>
      Object.assign(Object.create(LoyaltyTransaction.prototype), {
        transactionId: t.id,
        accountId: t.accountId,
        type: t.type.toLowerCase() as 'earn' | 'redeem' | 'expire' | 'adjust',
        pointsAmount: t.pointsAmount,
        reference: t.reference,
        description: t.description,
        transactionDate: t.transactionDate ?? t.createdAt,
        createdAt: t.createdAt,
      }) as LoyaltyTransaction,
    );

    const tier = LoyaltyTierService.resolveTier(row.pointsBalance);

    return LoyaltyAccount.restore({
      accountId: row.id,
      tenantId: row.tenantId,
      patientId: row.patientId,
      clinicId: row.clinicId,
      points: new LoyaltyPoints(row.pointsBalance),
      tier,
      enrollmentDate: row.enrollmentDate,
      lastActivityDate: row.lastActivityDate,
      isActive: row.isActive,
      transactions,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
