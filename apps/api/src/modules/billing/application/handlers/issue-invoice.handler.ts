import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { INVOICE_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { InvoiceRepository } from '../../domain/repositories/invoice.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { InvoiceIssuedEvent } from '../../domain/events/invoice-issued.event';
import { InvoiceValidationException } from '../../domain/exceptions/invoice-validation.exception';

@Injectable()
export class IssueInvoiceHandler {
  constructor(
    @Inject(INVOICE_REPOSITORY) private readonly repo: InvoiceRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
  ) {}

  async execute(command: { invoiceId: string }) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const invoice = await this.repo.findById(command.invoiceId, tenantId);
    if (!invoice) throw new NotFoundException('Invoice not found');

    try {
      invoice.issue();
    } catch (err) {
      if (err instanceof InvoiceValidationException) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }

    await this.repo.save(invoice);
    await this.eventPublisher.publish(
      new InvoiceIssuedEvent(tenantId, invoice.invoiceId, invoice.patientId, invoice.amountTotal),
    );

    return {
      invoiceId: invoice.invoiceId,
      status: invoice.status.status,
      amountTotal: invoice.amountTotal,
    };
  }
}
