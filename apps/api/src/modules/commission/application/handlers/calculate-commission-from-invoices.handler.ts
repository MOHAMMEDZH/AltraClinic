import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { CalculateCommissionHandler } from './calculate-commission.handler';

@Injectable()
export class CalculateCommissionFromInvoicesHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly calculateCommission: CalculateCommissionHandler,
  ) {}

  async execute(input: {
    providerId: string;
    branchId?: string | null;
    periodStart: string;
    periodEnd: string;
    currency?: string;
  }): Promise<{ commissionId: string; lineItemCount: number }> {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const periodStart = new Date(input.periodStart);
    const periodEnd = new Date(input.periodEnd);
    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
      throw new BadRequestException('Invalid period dates');
    }

    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['PAID', 'PARTIAL_PAID', 'ISSUED'] },
        ...(input.branchId ? { branchId: input.branchId } : {}),
        OR: [
          { invoiceDate: { gte: periodStart, lte: periodEnd } },
          { payments: { some: { paymentDate: { gte: periodStart, lte: periodEnd } } } },
        ],
      },
      include: { lineItems: true },
    });

    const lineItems = invoices.flatMap((inv) =>
      inv.lineItems.map((li) => ({
        appointmentId: null as string | null,
        serviceDescription: li.description,
        serviceType: li.serviceCode,
        amount: li.lineTotal.toNumber(),
        date: inv.invoiceDate.toISOString(),
      })),
    );

    if (lineItems.length === 0) {
      throw new BadRequestException('No billable invoice line items found for the selected period');
    }

    const result = await this.calculateCommission.execute({
      providerId: input.providerId,
      branchId: input.branchId ?? null,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      currency: input.currency ?? 'SYP',
      basisDocumentIds: invoices.map((inv) => inv.id),
      lineItems,
    });

    return { ...result, lineItemCount: lineItems.length };
  }
}
