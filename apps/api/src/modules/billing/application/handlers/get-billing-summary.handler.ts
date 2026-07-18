import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';

const OUTSTANDING_STATUSES = ['ISSUED', 'PARTIAL_PAID', 'OVERDUE'] as const;

@Injectable()
export class GetBillingSummaryHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(branchId?: string | null) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const branchFilter = branchId ? { branchId } : {};
    const baseWhere = { tenantId, deletedAt: null, ...branchFilter };

    const [
      draftCount,
      issuedCount,
      partialPaidCount,
      paidCount,
      overdueCount,
      cancelledCount,
      outstandingAgg,
      revenueTodayAgg,
      revenueMonthAgg,
      collectionsTodayAgg,
      recentPayments,
      outstandingInvoices,
    ] = await Promise.all([
      this.prisma.invoice.count({ where: { ...baseWhere, status: 'DRAFT' } }),
      this.prisma.invoice.count({ where: { ...baseWhere, status: 'ISSUED' } }),
      this.prisma.invoice.count({ where: { ...baseWhere, status: 'PARTIAL_PAID' } }),
      this.prisma.invoice.count({ where: { ...baseWhere, status: 'PAID' } }),
      this.prisma.invoice.count({ where: { ...baseWhere, status: 'OVERDUE' } }),
      this.prisma.invoice.count({ where: { ...baseWhere, status: 'CANCELLED' } }),
      this.prisma.invoice.aggregate({
        where: { ...baseWhere, status: { in: [...OUTSTANDING_STATUSES] } },
        _sum: { amountTotal: true, amountPaid: true },
        _count: true,
      }),
      this.prisma.invoicePayment.aggregate({
        where: {
          tenantId,
          paymentDate: { gte: startOfDay },
          invoice: { deletedAt: null, status: { notIn: ['CANCELLED', 'DRAFT'] }, ...branchFilter },
        },
        _sum: { amount: true },
      }),
      this.prisma.invoicePayment.aggregate({
        where: {
          tenantId,
          paymentDate: { gte: startOfMonth },
          invoice: { deletedAt: null, status: { notIn: ['CANCELLED', 'DRAFT'] }, ...branchFilter },
        },
        _sum: { amount: true },
      }),
      this.prisma.invoicePayment.aggregate({
        where: {
          tenantId,
          paymentDate: { gte: startOfDay },
          invoice: { deletedAt: null, ...branchFilter },
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.invoicePayment.findMany({
        where: {
          tenantId,
          invoice: { deletedAt: null, ...branchFilter },
        },
        orderBy: { paymentDate: 'desc' },
        take: 8,
        select: {
          id: true,
          amount: true,
          paymentMethod: true,
          paymentDate: true,
          invoice: { select: { id: true, invoiceNumber: true, currency: true } },
        },
      }),
      this.prisma.invoice.findMany({
        where: { ...baseWhere, status: { in: [...OUTSTANDING_STATUSES] } },
        select: {
          id: true,
          invoiceNumber: true,
          amountTotal: true,
          amountPaid: true,
          dueDate: true,
          invoiceDate: true,
          currency: true,
          status: true,
        },
      }),
    ]);

    const outstandingTotal = Number(outstandingAgg._sum.amountTotal ?? 0);
    const outstandingPaid = Number(outstandingAgg._sum.amountPaid ?? 0);
    const outstandingAmount = Math.max(0, outstandingTotal - outstandingPaid);

    const aging = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, over90: 0 };
    for (const inv of outstandingInvoices) {
      const due = inv.dueDate ?? inv.invoiceDate;
      const dueMs = due.getTime();
      const daysPastDue = Math.floor((startOfDay.getTime() - dueMs) / 86_400_000);
      const dueAmount = Math.max(0, inv.amountTotal.toNumber() - inv.amountPaid.toNumber());
      if (daysPastDue <= 0) aging.current += dueAmount;
      else if (daysPastDue <= 30) aging.days1to30 += dueAmount;
      else if (daysPastDue <= 60) aging.days31to60 += dueAmount;
      else if (daysPastDue <= 90) aging.days61to90 += dueAmount;
      else aging.over90 += dueAmount;
    }

    return {
      draftCount,
      issuedCount,
      partialPaidCount,
      paidCount,
      overdueCount,
      cancelledCount,
      outstandingCount: outstandingAgg._count,
      outstandingAmount,
      revenueToday: Number(revenueTodayAgg._sum.amount ?? 0),
      revenueMonth: Number(revenueMonthAgg._sum.amount ?? 0),
      collectionsToday: Number(collectionsTodayAgg._sum.amount ?? 0),
      paymentsTodayCount: collectionsTodayAgg._count,
      aging,
      recentPayments: recentPayments.map((p) => ({
        paymentId: p.id,
        invoiceId: p.invoice.id,
        invoiceNumber: p.invoice.invoiceNumber,
        amount: p.amount.toNumber(),
        paymentMethod: p.paymentMethod,
        paymentDate: p.paymentDate.toISOString(),
        currency: p.invoice.currency,
      })),
    };
  }
}
