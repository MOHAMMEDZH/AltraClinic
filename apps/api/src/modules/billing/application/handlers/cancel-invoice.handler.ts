import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CancelInvoiceCommand } from '../commands/cancel-invoice.command';
import { INVOICE_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { InvoiceRepository } from '../../domain/repositories/invoice.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { InvoiceCancelledEvent } from '../../domain/events/invoice-cancelled.event';
import { PrismaService } from '../../../../infrastructure/prisma.service';

@Injectable()
export class CancelInvoiceHandler {
  constructor(
    @Inject(INVOICE_REPOSITORY) private readonly repo: InvoiceRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: CancelInvoiceCommand): Promise<{ invoiceId: string }> {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const invoice = await this.repo.findById(command.invoiceId, tenantId);
    if (!invoice) throw new NotFoundException('Invoice not found');
    invoice.cancel();

    await this.repo.save(invoice);
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.allow_inventory_usage_invoice_link', 'true', true)`;
      await tx.inventoryUsageLedger.updateMany({
        where: { tenantId, invoiceId: invoice.invoiceId },
        data: { invoiceId: null, invoiceLineItemId: null },
      });
    });

    await this.eventPublisher.publish(new InvoiceCancelledEvent(tenantId, invoice.invoiceId, invoice.status.status));
    return { invoiceId: invoice.invoiceId };
  }
}
