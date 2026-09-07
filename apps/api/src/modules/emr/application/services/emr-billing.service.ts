import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import type { EncounterBillingSnapshot } from '../../domain/emr.types';

@Injectable()
export class EmrBillingService {
  constructor(private readonly prisma: PrismaService) {}

  async getEncounterBilling(tenantId: string, encounterId: string): Promise<EncounterBillingSnapshot> {
    const encounter = await this.prisma.encounter.findFirst({
      where: { id: encounterId, tenantId, deletedAt: null },
      select: { id: true, patientId: true },
    });
    if (!encounter) throw new NotFoundException('Encounter not found');

    const [invoices, consumptions, lineItems] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { tenantId, patientId: encounter.patientId, deletedAt: null },
        orderBy: { invoiceDate: 'desc' },
        take: 10,
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          amountTotal: true,
          amountPaid: true,
          currency: true,
          invoiceDate: true,
        },
      }),
      this.prisma.inventoryUsageLedger.findMany({
        where: { tenantId, encounterId },
        orderBy: { consumedAt: 'desc' },
        take: 50,
        include: { inventoryItem: { select: { nameEn: true, sku: true } } },
      }),
      this.prisma.invoiceLineItem.findMany({
        where: { tenantId, encounterId },
        include: { invoice: { select: { invoiceNumber: true, status: true } } },
      }),
    ]);

    const unbilledConsumptions = consumptions.filter((c) => !c.invoiceLineItemId);

    return {
      encounterId,
      patientId: encounter.patientId,
      invoices: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        status: inv.status.toLowerCase(),
        amountTotal: Number(inv.amountTotal),
        amountPaid: Number(inv.amountPaid),
        balanceDue: Number(inv.amountTotal) - Number(inv.amountPaid),
        currency: inv.currency,
        invoiceDate: inv.invoiceDate.toISOString().slice(0, 10),
      })),
      encounterLineItems: lineItems.map((li) => ({
        id: li.id,
        description: li.description,
        lineTotal: Number(li.lineTotal),
        invoiceNumber: li.invoice.invoiceNumber,
        invoiceStatus: li.invoice.status.toLowerCase(),
      })),
      unbilledMaterials: unbilledConsumptions.map((c) => ({
        id: c.id,
        itemName: c.inventoryItem.nameEn,
        sku: c.inventoryItem.sku,
        quantityUsed: Number(c.quantityUsed),
        consumedAt: c.consumedAt.toISOString(),
      })),
      unbilledMaterialCount: unbilledConsumptions.length,
    };
  }
}
