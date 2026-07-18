import { Injectable } from '@nestjs/common';
import { CommissionStatus as PrismaCommissionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { CommissionCalculation } from '../domain/entities/commission-calculation.entity';
import { CommissionLineItem } from '../domain/entities/commission-line-item.entity';
import { CommissionRepository } from '../domain/repositories/commission.repository.interface';
import { CommissionStatus, CommissionStatusType } from '../domain/value-objects/commission-status.vo';
import { CommissionRate, CommissionRateType } from '../domain/value-objects/commission-rate.vo';

type PrismaCommissionRow = Prisma.CommissionCalculationGetPayload<{ include: { lineItems: true } }>;

const DOMAIN_TO_PRISMA: Record<CommissionStatusType, PrismaCommissionStatus> = {
  draft: 'DRAFT',
  calculated: 'CALCULATED',
  approved: 'APPROVED',
  paid: 'PAID',
  disputed: 'DISPUTED',
};

const PRISMA_TO_DOMAIN: Record<PrismaCommissionStatus, CommissionStatusType> = {
  DRAFT: 'draft',
  CALCULATED: 'calculated',
  APPROVED: 'approved',
  PAID: 'paid',
  DISPUTED: 'disputed',
};

@Injectable()
export class PrismaCommissionRepository implements CommissionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(commission: CommissionCalculation): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.commissionCalculation.upsert({
        where: { id: commission.commissionId },
        create: {
          id: commission.commissionId,
          tenantId: commission.tenantId,
          branchId: commission.branchId,
          providerId: commission.providerId,
          periodStart: commission.periodStart,
          periodEnd: commission.periodEnd,
          status: DOMAIN_TO_PRISMA[commission.status.status],
          totalRevenue: new Prisma.Decimal(commission.totalRevenue),
          commissionAmount: new Prisma.Decimal(commission.commissionAmount),
          currency: commission.currency,
          basisDocumentIds: commission.basisDocumentIds,
          paymentMethod: commission.paymentMethod ?? null,
          paymentReference: commission.paymentReference ?? null,
          paymentDate: commission.paymentDate ?? null,
          disputeReason: commission.status.reason ?? null,
          createdAt: commission.createdAt,
        },
        update: {
          status: DOMAIN_TO_PRISMA[commission.status.status],
          totalRevenue: new Prisma.Decimal(commission.totalRevenue),
          commissionAmount: new Prisma.Decimal(commission.commissionAmount),
          paymentMethod: commission.paymentMethod ?? null,
          paymentReference: commission.paymentReference ?? null,
          paymentDate: commission.paymentDate ?? null,
          disputeReason: commission.status.reason ?? null,
          updatedAt: commission.updatedAt,
        },
      });

      await tx.commissionLineItem.deleteMany({
        where: { commissionId: commission.commissionId },
      });

      for (const li of commission.lineItems) {
        await tx.commissionLineItem.create({
          data: {
            id: li.itemId,
            commissionId: commission.commissionId,
            tenantId: commission.tenantId,
            appointmentId: li.appointmentId,
            serviceDescription: li.serviceDescription,
            serviceType: li.serviceType,
            amount: new Prisma.Decimal(li.amount),
            commissionAmount: new Prisma.Decimal(li.commissionAmount),
            commissionRateType: li.commissionRate.type === 'percentage' ? 'PERCENTAGE' : 'FIXED_AMOUNT',
            commissionRateValue: new Prisma.Decimal(li.commissionRate.value),
            minimumThreshold: li.commissionRate.minimumThreshold !== null
              ? new Prisma.Decimal(li.commissionRate.minimumThreshold)
              : null,
            maximumCap: li.commissionRate.maximumCap !== null
              ? new Prisma.Decimal(li.commissionRate.maximumCap)
              : null,
            date: li.date,
          },
        });
      }
    });
  }

  async findById(commissionId: string, tenantId: string): Promise<CommissionCalculation | null> {
    const row = await this.prisma.commissionCalculation.findFirst({
      where: { id: commissionId, tenantId },
      include: { lineItems: true },
    });
    return row ? this.toDomain(row) : null;
  }

  async list(filters: {
    tenantId: string;
    providerId?: string | null;
    branchId?: string | null;
    status?: string | null;
  }): Promise<CommissionCalculation[]> {
    const rows = await this.prisma.commissionCalculation.findMany({
      where: {
        tenantId: filters.tenantId,
        ...(filters.providerId ? { providerId: filters.providerId } : {}),
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
        ...(filters.status ? { status: DOMAIN_TO_PRISMA[filters.status as CommissionStatusType] } : {}),
      },
      include: { lineItems: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  private toDomain(row: PrismaCommissionRow): CommissionCalculation {
    const lineItems = row.lineItems.map((li) =>
      CommissionLineItem.restore({
        itemId: li.id,
        commissionId: li.commissionId,
        appointmentId: li.appointmentId,
        serviceDescription: li.serviceDescription,
        serviceType: li.serviceType,
        amount: li.amount.toNumber(),
        commissionRate: new CommissionRate(
          li.commissionRateType === 'PERCENTAGE' ? 'percentage' : 'fixed_amount' as CommissionRateType,
          li.commissionRateValue.toNumber(),
          li.minimumThreshold?.toNumber() ?? null,
          li.maximumCap?.toNumber() ?? null,
        ),
        commissionAmount: li.commissionAmount.toNumber(),
        date: li.date,
      }),
    );

    const statusType = PRISMA_TO_DOMAIN[row.status];
    return CommissionCalculation.restore({
      commissionId: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      providerId: row.providerId,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      status: new CommissionStatus(statusType, row.disputeReason),
      totalRevenue: row.totalRevenue.toNumber(),
      commissionAmount: row.commissionAmount.toNumber(),
      currency: row.currency,
      basisDocumentIds: row.basisDocumentIds as string[],
      lineItems,
      paymentMethod: row.paymentMethod,
      paymentReference: row.paymentReference,
      paymentDate: row.paymentDate,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
