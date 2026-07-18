import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateInvoiceCommand } from '../commands/create-invoice.command';
import { INVOICE_REPOSITORY, PATIENT_REPOSITORY, SUBSCRIPTION_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { InvoiceRepository } from '../../domain/repositories/invoice.repository.interface';
import { Invoice } from '../../domain/entities/invoice.entity';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { InvoiceCreatedEvent } from '../../domain/events/invoice-created.event';
import { PatientRepository } from '../../../patients/domain/patient.repository.interface';
import { SubscriptionRepository } from '../../../subscription/domain/repositories/subscription.repository.interface';

@Injectable()
export class CreateInvoiceHandler {
  constructor(
    @Inject(INVOICE_REPOSITORY) private readonly repo: InvoiceRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository,
    @Inject(SUBSCRIPTION_REPOSITORY) private readonly subscriptionRepository: SubscriptionRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
  ) {}

  async execute(command: CreateInvoiceCommand): Promise<{ invoiceId: string }> {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!command.patientId?.trim()) throw new BadRequestException('patientId is required');
    if (!command.invoiceNumber?.trim()) throw new BadRequestException('invoiceNumber is required');
    if (!command.invoiceDate?.trim() || Number.isNaN(new Date(command.invoiceDate).getTime())) {
      throw new BadRequestException('invoiceDate is required and must be valid ISO datetime');
    }

    const patient = await this.patientRepository.findById(command.patientId, tenantId);
    if (!patient) throw new NotFoundException('Patient not found');

    const hasActiveSubscription = await this.subscriptionRepository.existsByCustomerId(
      command.patientId,
      tenantId,
    );
    const requireSubscription = command.requireActiveSubscription !== false;
    if (requireSubscription && !hasActiveSubscription) {
      throw new ForbiddenException('Active subscription is required before invoice creation');
    }

    const lineItems = command.lineItems ?? [];
    if (!requireSubscription && lineItems.length === 0) {
      throw new BadRequestException('At least one line item is required for treatment invoices');
    }
    if (!requireSubscription) {
      for (const item of lineItems) {
        if (!item.description?.trim()) {
          throw new BadRequestException('Each line item requires a description');
        }
        if (item.quantity <= 0) {
          throw new BadRequestException('Line item quantity must be greater than zero');
        }
        if (item.unitPrice < 0) {
          throw new BadRequestException('Line item unit price cannot be negative');
        }
      }
    }

    const invoice = Invoice.create({
      invoiceId: randomUUID(),
      tenantId,
      branchId: command.branchId,
      patientId: command.patientId,
      invoiceNumber: command.invoiceNumber,
      invoiceDate: new Date(command.invoiceDate),
      dueDate: command.dueDate ? new Date(command.dueDate) : null,
      currency: command.currency,
      notes: command.notes,
      lineItems: command.lineItems,
    });

    await this.repo.save(invoice);
    await this.eventPublisher.publish(new InvoiceCreatedEvent(tenantId, invoice.invoiceId, invoice.patientId, invoice.branchId, invoice.status.status, invoice.amountTotal));
    return { invoiceId: invoice.invoiceId };
  }
}
