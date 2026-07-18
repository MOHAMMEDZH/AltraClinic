import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';

function clampDays(days?: number): number {
  const n = days ?? 30;
  return Math.min(365, Math.max(7, Math.floor(n)));
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class GetBillingAnalyticsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(days?: number, branchId?: string | null) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const periodDays = clampDays(days);
    const now = new Date();
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - periodDays + 1);
    start.setUTCHours(0, 0, 0, 0);
    const branchFilter = branchId ? { branchId } : {};

    const [payments, invoicesCreated, statusCounts] = await Promise.all([
      this.prisma.invoicePayment.findMany({
        where: {
          tenantId,
          paymentDate: { gte: start },
          invoice: { deletedAt: null, status: { notIn: ['CANCELLED'] }, ...branchFilter },
        },
        select: { amount: true, paymentDate: true, paymentMethod: true },
      }),
      this.prisma.invoice.findMany({
        where: {
          tenantId,
          deletedAt: null,
          invoiceDate: { gte: start },
          ...branchFilter,
        },
        select: { invoiceDate: true, amountTotal: true, status: true },
      }),
      this.prisma.invoice.groupBy({
        by: ['status'],
        where: { tenantId, deletedAt: null, ...branchFilter },
        _count: true,
        _sum: { amountTotal: true, amountPaid: true },
      }),
    ]);

    const collectionsByDay = new Map<string, { amount: number; count: number }>();
    const invoicedByDay = new Map<string, { amount: number; count: number }>();
    const methodTotals = new Map<string, number>();

    for (let i = 0; i < periodDays; i++) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      const key = dateKey(d);
      collectionsByDay.set(key, { amount: 0, count: 0 });
      invoicedByDay.set(key, { amount: 0, count: 0 });
    }

    for (const p of payments) {
      const key = dateKey(p.paymentDate);
      const row = collectionsByDay.get(key);
      const amt = p.amount.toNumber();
      if (row) {
        row.amount += amt;
        row.count += 1;
      }
      methodTotals.set(p.paymentMethod, (methodTotals.get(p.paymentMethod) ?? 0) + amt);
    }

    for (const inv of invoicesCreated) {
      if (inv.status === 'CANCELLED' || inv.status === 'DRAFT') continue;
      const key = dateKey(inv.invoiceDate);
      const row = invoicedByDay.get(key);
      const amt = inv.amountTotal.toNumber();
      if (row) {
        row.amount += amt;
        row.count += 1;
      }
    }

    const byDay = [...collectionsByDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, row]) => ({
        date,
        collections: row.amount,
        paymentCount: row.count,
        invoiced: invoicedByDay.get(date)?.amount ?? 0,
        invoiceCount: invoicedByDay.get(date)?.count ?? 0,
      }));

    const byStatus = statusCounts.map((row) => ({
      status: row.status,
      count: row._count,
      amountTotal: Number(row._sum.amountTotal ?? 0),
      amountPaid: Number(row._sum.amountPaid ?? 0),
    }));

    const byPaymentMethod = [...methodTotals.entries()]
      .map(([method, amount]) => ({ method, amount }))
      .sort((a, b) => b.amount - a.amount);

    return {
      generatedAt: now.toISOString(),
      periodDays,
      byDay,
      byStatus,
      byPaymentMethod,
      totals: {
        collections: payments.reduce((s, p) => s + p.amount.toNumber(), 0),
        paymentCount: payments.length,
        invoiced: invoicesCreated
          .filter((i) => i.status !== 'CANCELLED' && i.status !== 'DRAFT')
          .reduce((s, i) => s + i.amountTotal.toNumber(), 0),
        invoiceCount: invoicesCreated.filter((i) => i.status !== 'CANCELLED' && i.status !== 'DRAFT').length,
      },
    };
  }
}
