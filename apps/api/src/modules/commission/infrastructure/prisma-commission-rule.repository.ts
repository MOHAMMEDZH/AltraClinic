import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { CommissionRule } from '../domain/entities/commission-rule.entity';
import { CommissionRuleRepository } from '../domain/repositories/commission-rule.repository.interface';
import { CommissionRate, CommissionRateType } from '../domain/value-objects/commission-rate.vo';

@Injectable()
export class PrismaCommissionRuleRepository implements CommissionRuleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(rule: CommissionRule): Promise<void> {
    await this.prisma.commissionRule.upsert({
      where: { id: rule.ruleId },
      create: {
        id: rule.ruleId,
        tenantId: rule.tenantId,
        providerId: rule.providerId ?? null,
        serviceType: rule.serviceType ?? null,
        rateType: rule.commissionRate.type === 'percentage' ? 'PERCENTAGE' : 'FIXED_AMOUNT',
        rateValue: new Prisma.Decimal(rule.commissionRate.value),
        minimumThreshold: rule.commissionRate.minimumThreshold !== null
          ? new Prisma.Decimal(rule.commissionRate.minimumThreshold)
          : null,
        maximumCap: rule.commissionRate.maximumCap !== null
          ? new Prisma.Decimal(rule.commissionRate.maximumCap)
          : null,
        effectiveDate: rule.effectiveDate,
        expiryDate: rule.expiryDate ?? null,
        createdAt: rule.createdAt,
      },
      update: {
        rateType: rule.commissionRate.type === 'percentage' ? 'PERCENTAGE' : 'FIXED_AMOUNT',
        rateValue: new Prisma.Decimal(rule.commissionRate.value),
        minimumThreshold: rule.commissionRate.minimumThreshold !== null
          ? new Prisma.Decimal(rule.commissionRate.minimumThreshold)
          : null,
        maximumCap: rule.commissionRate.maximumCap !== null
          ? new Prisma.Decimal(rule.commissionRate.maximumCap)
          : null,
        effectiveDate: rule.effectiveDate,
        expiryDate: rule.expiryDate ?? null,
        updatedAt: rule.updatedAt,
      },
    });
  }

  async findById(ruleId: string, tenantId: string): Promise<CommissionRule | null> {
    const row = await this.prisma.commissionRule.findFirst({
      where: { id: ruleId, tenantId, deletedAt: null },
    });
    return row ? this.toDomain(row) : null;
  }

  async list(filters: {
    tenantId: string;
    providerId?: string | null;
    serviceType?: string | null;
    effectiveDate?: Date;
  }): Promise<CommissionRule[]> {
    const rows = await this.prisma.commissionRule.findMany({
      where: {
        tenantId: filters.tenantId,
        deletedAt: null,
        ...(filters.providerId !== undefined
          ? filters.providerId
            ? { providerId: filters.providerId }
            : { providerId: null }
          : {}),
        ...(filters.serviceType !== undefined
          ? filters.serviceType
            ? { serviceType: filters.serviceType }
            : { serviceType: null }
          : {}),
        ...(filters.effectiveDate
          ? {
              effectiveDate: { lte: filters.effectiveDate },
              OR: [{ expiryDate: null }, { expiryDate: { gte: filters.effectiveDate } }],
            }
          : {}),
      },
      orderBy: { effectiveDate: 'desc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  private toDomain(row: {
    id: string;
    tenantId: string;
    providerId: string | null;
    serviceType: string | null;
    rateType: string;
    rateValue: Prisma.Decimal;
    minimumThreshold: Prisma.Decimal | null;
    maximumCap: Prisma.Decimal | null;
    effectiveDate: Date;
    expiryDate: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): CommissionRule {
    return CommissionRule.restore({
      ruleId: row.id,
      tenantId: row.tenantId,
      providerId: row.providerId,
      serviceType: row.serviceType,
      commissionRate: new CommissionRate(
        row.rateType === 'PERCENTAGE' ? 'percentage' : 'fixed_amount' as CommissionRateType,
        row.rateValue.toNumber(),
        row.minimumThreshold?.toNumber() ?? null,
        row.maximumCap?.toNumber() ?? null,
      ),
      effectiveDate: row.effectiveDate,
      expiryDate: row.expiryDate,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
