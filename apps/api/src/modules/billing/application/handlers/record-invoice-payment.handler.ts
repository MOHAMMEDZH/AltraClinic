import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { RecordInvoicePaymentCommand } from '../commands/record-invoice-payment.command';
import { INVOICE_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { InvoiceRepository } from '../../domain/repositories/invoice.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { InvoicePaymentRecordedEvent } from '../../domain/events/invoice-payment-recorded.event';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { BillingFinancialService } from '../services/billing-financial.service';

@Injectable()
export class RecordInvoicePaymentHandler {
  constructor(
    @Inject(INVOICE_REPOSITORY) private readonly repo: InvoiceRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
    private readonly prisma: PrismaService,
    private readonly financial: BillingFinancialService,
  ) {}

  async execute(command: RecordInvoicePaymentCommand & { recordedBy?: string }) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!command.recordedBy?.trim()) throw new BadRequestException('User context is required');

    const invoice = await this.repo.findById(command.invoiceId, tenantId);
    if (!invoice) throw new NotFoundException('Invoice not found');

    const paymentDate = command.paymentDate ? new Date(command.paymentDate) : new Date();
    const paymentId = randomUUID();
    invoice.recordPayment({
      amount: command.amount,
      paymentMethod: command.paymentMethod,
      paymentReference: command.paymentReference,
      paymentDate,
    });

    await this.repo.save(invoice);
    await this.prisma.invoicePayment.create({
      data: {
        id: paymentId,
        invoiceId: invoice.invoiceId,
        tenantId,
        amount: new Prisma.Decimal(command.amount),
        paymentMethod: command.paymentMethod,
        paymentReference: command.paymentReference,
        paymentDate,
        recordedBy: command.recordedBy,
      },
    });

    const receiptNumber = await this.financial.createPaymentReceipt({
      invoiceId: invoice.invoiceId,
      amount: command.amount,
      currency: invoice.currency,
      paymentId,
      issuedBy: command.recordedBy,
    });

    await this.eventPublisher.publish(
      new InvoicePaymentRecordedEvent(
        tenantId,
        invoice.invoiceId,
        command.amount,
        command.paymentMethod,
        command.paymentReference,
        invoice.status.status,
      ),
    );

    return {
      invoiceId: invoice.invoiceId,
      status: invoice.status.status,
      amountPaid: invoice.amountPaid,
      amountDue: invoice.amountDue,
      receiptNumber,
    };
  }
}
