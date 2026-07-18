import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  INVENTORY_ITEM_REPOSITORY,
  INVOICE_REPOSITORY,
  PATIENT_REPOSITORY,
} from '../../../../infrastructure/provider.tokens';
import { InventoryItemRepository } from '../../../inventory/domain/repositories/inventory-item.repository.interface';
import type { ConsumptionLogRecord } from '../../../inventory/domain/repositories/inventory-list.filter';
import { InvoiceRepository } from '../../domain/repositories/invoice.repository.interface';
import { Invoice } from '../../domain/entities/invoice.entity';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { PatientRepository } from '../../../patients/domain/patient.repository.interface';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { InvoiceCreatedEvent } from '../../domain/events/invoice-created.event';
import { InvoiceLineItemAddedEvent } from '../../domain/events/invoice-line-item-added.event';

function billableQuantity(quantityUsed: number): number {
  if (!Number.isFinite(quantityUsed) || quantityUsed <= 0) return 1;
  return Number.isInteger(quantityUsed) ? quantityUsed : Math.ceil(quantityUsed);
}

function lineDescription(row: ConsumptionLogRecord): string {
  const base = `${row.itemNameEn} (${row.sku})`;
  return row.procedureCode ? `${base} — ${row.procedureCode}` : base;
}

function uniqueInvoiceNumber(patientId: string): string {
  const suffix = patientId.replace(/-/g, '').slice(0, 8).toUpperCase();
  const time = Date.now().toString(36).toUpperCase();
  return `INV-M-${suffix}-${time}`;
}

@Injectable()
export class BillInventoryConsumptionsHandler {
  constructor(
    @Inject(INVOICE_REPOSITORY) private readonly invoiceRepo: InvoiceRepository,
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly inventoryRepo: InventoryItemRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
  ) {}

  async execute(command: {
    patientId: string;
    consumptionIds: string[];
    invoiceId?: string | null;
    currency?: string | null;
  }) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const patientId = command.patientId?.trim();
    if (!patientId) throw new BadRequestException('patientId is required');

    const consumptionIds = [...new Set((command.consumptionIds ?? []).map((id) => id.trim()).filter(Boolean))];
    if (consumptionIds.length === 0) {
      throw new BadRequestException('At least one consumptionId is required');
    }

    const patient = await this.patientRepository.findById(patientId, tenantId);
    if (!patient) throw new NotFoundException('Patient not found');

    const rows = await this.inventoryRepo.findConsumptionsByIds(tenantId, consumptionIds);
    if (rows.length !== consumptionIds.length) {
      throw new BadRequestException('One or more consumption records were not found');
    }

    for (const row of rows) {
      if (!row.patientId) {
        throw new BadRequestException('All consumptions must be linked to a patient before billing');
      }
      if (row.patientId !== patientId) {
        throw new BadRequestException('All consumptions must belong to the same patient');
      }
      if (row.invoiceId) {
        throw new BadRequestException('One or more consumptions are already billed');
      }
    }

    let invoice: Invoice;
    let created = false;

    if (command.invoiceId?.trim()) {
      const existing = await this.invoiceRepo.findById(command.invoiceId.trim(), tenantId);
      if (!existing) throw new NotFoundException('Invoice not found');
      if (existing.patientId !== patientId) {
        throw new BadRequestException('Invoice patient does not match consumption patient');
      }
      if (!existing.canAddLineItems()) {
        throw new BadRequestException('Cannot add material lines to this invoice status');
      }
      invoice = existing;
    } else {
      invoice = Invoice.create({
        invoiceId: randomUUID(),
        tenantId,
        branchId: null,
        patientId,
        invoiceNumber: uniqueInvoiceNumber(patientId),
        invoiceDate: new Date(),
        currency: command.currency?.trim() || 'SYP',
        notes: 'Inventory material consumption',
        lineItems: [],
      });
      created = true;
    }

    const consumptionLinks: Array<{ consumptionId: string; lineItemId: string }> = [];

    for (const row of rows) {
      const beforeCount = invoice.lineItems.length;
      invoice.addLineItem({
        description: lineDescription(row),
        quantity: billableQuantity(row.quantityUsed),
        unitPrice: row.unitPrice ?? 0,
        discountPercent: 0,
        taxPercent: 0,
      });
      const added = invoice.lineItems[invoice.lineItems.length - 1];
      if (!added || invoice.lineItems.length !== beforeCount + 1) {
        throw new BadRequestException('Failed to build invoice line for consumption');
      }
      consumptionLinks.push({ consumptionId: row.id, lineItemId: added.itemId });
    }

    try {
      await this.invoiceRepo.save(invoice, consumptionLinks);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Billing link failed';
      throw new BadRequestException(message);
    }

    if (created) {
      await this.eventPublisher.publish(
        new InvoiceCreatedEvent(
          tenantId,
          invoice.invoiceId,
          invoice.patientId,
          invoice.branchId,
          invoice.status.status,
          invoice.amountTotal,
        ),
      );
    } else {
      for (const row of rows) {
        await this.eventPublisher.publish(
          new InvoiceLineItemAddedEvent(
            tenantId,
            invoice.invoiceId,
            lineDescription(row),
            billableQuantity(row.quantityUsed),
            row.unitPrice ?? 0,
          ),
        );
      }
    }

    return {
      invoiceId: invoice.invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      amountTotal: invoice.amountTotal,
      linkedConsumptionCount: consumptionLinks.length,
      created,
    };
  }
}
