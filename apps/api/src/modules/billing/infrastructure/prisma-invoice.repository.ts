import { Injectable } from '@nestjs/common';
import { InvoiceStatus as PrismaInvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { Invoice } from '../domain/entities/invoice.entity';
import { InvoiceRepository } from '../domain/repositories/invoice.repository.interface';
import { InvoiceStatus, InvoiceStatusType } from '../domain/value-objects/invoice-status.vo';
import { InvoiceLineItem } from '../domain/entities/invoice-line-item.entity';

type PrismaInvoiceRow = Prisma.InvoiceGetPayload<{ include: { lineItems: true } }>;

const DOMAIN_STATUS_TO_PRISMA: Record<InvoiceStatusType, PrismaInvoiceStatus> = {
  draft: 'DRAFT',
  issued: 'ISSUED',
  partial_paid: 'PARTIAL_PAID',
  paid: 'PAID',
  overdue: 'OVERDUE',
  cancelled: 'CANCELLED',
  written_off: 'WRITTEN_OFF',
};

const PRISMA_STATUS_TO_DOMAIN: Record<PrismaInvoiceStatus, InvoiceStatusType> = {
  DRAFT: 'draft',
  ISSUED: 'issued',
  PARTIAL_PAID: 'partial_paid',
  PAID: 'paid',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
  WRITTEN_OFF: 'written_off',
};

@Injectable()
export class PrismaInvoiceRepository implements InvoiceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(invoice: Invoice, consumptionLinks?: Array<{ consumptionId: string; lineItemId: string }>): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.invoice.upsert({
        where: { id: invoice.invoiceId },
        create: {
          id: invoice.invoiceId,
          tenantId: invoice.tenantId,
          branchId: invoice.branchId,
          patientId: invoice.patientId,
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: invoice.invoiceDate,
          dueDate: invoice.dueDate,
          currency: invoice.currency,
          status: DOMAIN_STATUS_TO_PRISMA[invoice.status.status],
          amountSubtotal: new Prisma.Decimal(invoice.amountSubtotal),
          amountDiscount: new Prisma.Decimal(invoice.amountDiscount),
          amountTax: new Prisma.Decimal(invoice.amountTax),
          amountTotal: new Prisma.Decimal(invoice.amountTotal),
          amountPaid: new Prisma.Decimal(invoice.amountPaid),
          notes: invoice.notes,
          createdAt: invoice.createdAt,
        },
        update: {
          status: DOMAIN_STATUS_TO_PRISMA[invoice.status.status],
          amountSubtotal: new Prisma.Decimal(invoice.amountSubtotal),
          amountDiscount: new Prisma.Decimal(invoice.amountDiscount),
          amountTax: new Prisma.Decimal(invoice.amountTax),
          amountTotal: new Prisma.Decimal(invoice.amountTotal),
          amountPaid: new Prisma.Decimal(invoice.amountPaid),
          notes: invoice.notes,
          dueDate: invoice.dueDate,
          updatedAt: invoice.updatedAt,
        },
      });

      // Sync line items: delete removed, upsert existing/new
      const existingItems = await tx.invoiceLineItem.findMany({
        where: { invoiceId: invoice.invoiceId },
        select: { id: true },
      });
      const existingIds = new Set(existingItems.map((i) => i.id));
      const incomingIds = new Set(invoice.lineItems.map((li) => li.itemId));

      const toDelete = [...existingIds].filter((id) => !incomingIds.has(id));
      if (toDelete.length > 0) {
        await tx.invoiceLineItem.deleteMany({ where: { id: { in: toDelete } } });
      }

      for (const li of invoice.lineItems) {
        await tx.invoiceLineItem.upsert({
          where: { id: li.itemId },
          create: {
            id: li.itemId,
            invoiceId: invoice.invoiceId,
            tenantId: invoice.tenantId,
            description: li.description,
            quantity: new Prisma.Decimal(li.quantity),
            unitPrice: new Prisma.Decimal(li.unitPrice),
            discountPercent: new Prisma.Decimal(li.discountPercent),
            taxPercent: new Prisma.Decimal(li.taxPercent),
            subtotal: new Prisma.Decimal(li.subtotal),
            discountAmount: new Prisma.Decimal(li.discountAmount),
            taxAmount: new Prisma.Decimal(li.taxAmount),
            lineTotal: new Prisma.Decimal(li.subtotal - li.discountAmount + li.taxAmount),
          },
          update: {
            description: li.description,
            quantity: new Prisma.Decimal(li.quantity),
            unitPrice: new Prisma.Decimal(li.unitPrice),
            discountPercent: new Prisma.Decimal(li.discountPercent),
            taxPercent: new Prisma.Decimal(li.taxPercent),
            subtotal: new Prisma.Decimal(li.subtotal),
            discountAmount: new Prisma.Decimal(li.discountAmount),
            taxAmount: new Prisma.Decimal(li.taxAmount),
            lineTotal: new Prisma.Decimal(li.subtotal - li.discountAmount + li.taxAmount),
          },
        });
      }

      if (consumptionLinks?.length) {
        await tx.$executeRaw`SELECT set_config('app.allow_inventory_usage_invoice_link', 'true', true)`;
        for (const link of consumptionLinks) {
          const updated = await tx.inventoryUsageLedger.updateMany({
            where: {
              id: link.consumptionId,
              tenantId: invoice.tenantId,
              invoiceId: null,
            },
            data: {
              invoiceId: invoice.invoiceId,
              invoiceLineItemId: link.lineItemId,
            },
          });
          if (updated.count !== 1) {
            throw new Error(`Consumption ${link.consumptionId} is not available for billing`);
          }
        }
      }
    });
  }

  async findById(invoiceId: string, tenantId: string): Promise<Invoice | null> {
    const row = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId, deletedAt: null },
      include: { lineItems: true },
    });
    return row ? this.toDomain(row) : null;
  }

  async list(filters: {
    tenantId: string;
    branchId?: string | null;
    patientId?: string | null;
    status?: string | null;
  }): Promise<Invoice[]> {
    const rows = await this.prisma.invoice.findMany({
      where: {
        tenantId: filters.tenantId,
        deletedAt: null,
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
        ...(filters.patientId ? { patientId: filters.patientId } : {}),
        ...(filters.status ? { status: DOMAIN_STATUS_TO_PRISMA[filters.status as InvoiceStatusType] } : {}),
      },
      include: { lineItems: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toDomain(r));
  }

  private toDomain(row: PrismaInvoiceRow): Invoice {
    const lineItems = row.lineItems.map((li) =>
      InvoiceLineItem.restore({
        itemId: li.id,
        description: li.description,
        quantity: li.quantity.toNumber(),
        unitPrice: li.unitPrice.toNumber(),
        discountPercent: li.discountPercent.toNumber(),
        discountAmount: li.discountAmount.toNumber(),
        taxPercent: li.taxPercent.toNumber(),
        taxAmount: li.taxAmount.toNumber(),
        subtotal: li.subtotal.toNumber(),
      }),
    );

    return Invoice.restore({
      invoiceId: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      patientId: row.patientId,
      invoiceNumber: row.invoiceNumber,
      invoiceDate: row.invoiceDate,
      dueDate: row.dueDate,
      currency: row.currency,
      notes: row.notes,
      lineItems,
      status: new InvoiceStatus(PRISMA_STATUS_TO_DOMAIN[row.status]),
      amountSubtotal: row.amountSubtotal.toNumber(),
      amountDiscount: row.amountDiscount.toNumber(),
      amountTax: row.amountTax.toNumber(),
      amountTotal: row.amountTotal.toNumber(),
      amountPaid: row.amountPaid.toNumber(),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
