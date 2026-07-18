import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { GetInvoiceQuery } from '../queries/get-invoice.query';
import { INVOICE_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { InvoiceRepository } from '../../domain/repositories/invoice.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { PrismaService } from '../../../../infrastructure/prisma.service';

@Injectable()
export class GetInvoiceHandler {
  constructor(
    @Inject(INVOICE_REPOSITORY) private readonly repo: InvoiceRepository,
    private readonly tenantContext: TenantContextService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(query: GetInvoiceQuery) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const invoice = await this.repo.findById(query.invoiceId, tenantCtx.tenantId);
    if (!invoice) throw new NotFoundException('Invoice not found');

    const payments = await this.prisma.invoicePayment.findMany({
      where: { invoiceId: query.invoiceId, tenantId: tenantCtx.tenantId },
      orderBy: { createdAt: 'desc' },
    });

    const row = await this.prisma.invoice.findFirst({
      where: { id: query.invoiceId, tenantId: tenantCtx.tenantId, deletedAt: null },
      select: {
        insuranceProvider: true,
        insurancePolicyNumber: true,
        insuranceAmount: true,
        patientResponsibility: true,
        insuranceClaimStatus: true,
      },
    });

    return {
      ...invoice.toJSON(),
      insuranceProvider: row?.insuranceProvider ?? null,
      insurancePolicyNumber: row?.insurancePolicyNumber ?? null,
      insuranceAmount: row?.insuranceAmount?.toNumber() ?? 0,
      patientResponsibility: row?.patientResponsibility?.toNumber() ?? 0,
      insuranceClaimStatus: row?.insuranceClaimStatus ?? null,
      payments: payments.map((payment) => ({
        paymentId: payment.id,
        amount: payment.amount.toNumber(),
        paymentMethod: payment.paymentMethod,
        paymentReference: payment.paymentReference,
        paymentDate: payment.paymentDate.toISOString(),
        recordedBy: payment.recordedBy,
        createdAt: payment.createdAt.toISOString(),
      })),
    };
  }
}
