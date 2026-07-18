import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AddInvoiceLineItemCommand } from '../commands/add-invoice-line-item.command';
import { INVOICE_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { InvoiceRepository } from '../../domain/repositories/invoice.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { InvoiceLineItemAddedEvent } from '../../domain/events/invoice-line-item-added.event';

@Injectable()
export class AddInvoiceLineItemHandler {
  constructor(
    @Inject(INVOICE_REPOSITORY) private readonly repo: InvoiceRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
  ) {}

  async execute(command: AddInvoiceLineItemCommand): Promise<{ invoiceId: string }> {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const invoice = await this.repo.findById(command.invoiceId, tenantId);
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (!invoice.canAddLineItems()) {
      throw new BadRequestException('Cannot add line items to this invoice status');
    }

    invoice.addLineItem({
      description: command.description,
      quantity: command.quantity,
      unitPrice: command.unitPrice,
      discountPercent: command.discountPercent,
      taxPercent: command.taxPercent,
    });

    await this.repo.save(invoice);
    await this.eventPublisher.publish(new InvoiceLineItemAddedEvent(tenantId, invoice.invoiceId, command.description, command.quantity, command.unitPrice));

    return { invoiceId: invoice.invoiceId };
  }
}
