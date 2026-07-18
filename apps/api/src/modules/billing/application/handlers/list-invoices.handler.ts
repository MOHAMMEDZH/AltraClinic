import { Inject, Injectable } from '@nestjs/common';
import { ListInvoicesQuery } from '../queries/list-invoices.query';
import { INVOICE_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { InvoiceRepository } from '../../domain/repositories/invoice.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';

@Injectable()
export class ListInvoicesHandler {
  constructor(
    @Inject(INVOICE_REPOSITORY) private readonly repo: InvoiceRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(query: ListInvoicesQuery) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const invoices = await this.repo.list({
      tenantId: tenantCtx.tenantId,
      branchId: query.branchId ?? null,
      patientId: query.patientId ?? null,
      status: query.status ?? null,
    });
    return invoices.map((invoice) => invoice.toJSON());
  }
}
