import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';

const EXPIRY_ALERT_DAYS = 7;
const MAX_PERIOD_DAYS = 90;

@Injectable()
export class GetInventoryAnalyticsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(days = 30) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const periodDays = Math.min(Math.max(days, 7), MAX_PERIOD_DAYS);
    const since = new Date();
    since.setDate(since.getDate() - periodDays);
    since.setHours(0, 0, 0, 0);

    const now = new Date();
    const expiringBefore = new Date(now);
    expiringBefore.setDate(expiringBefore.getDate() + EXPIRY_ALERT_DAYS);
    const baseWhere = { tenantId, deletedAt: null };

    const [
      items,
      consumptions,
      movementGroups,
      poStatusGroups,
      activeSuppliers,
      supplierOrderGroups,
    ] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where: baseWhere,
        select: {
          id: true,
          sku: true,
          nameEn: true,
          quantityOnHand: true,
          costPerUnit: true,
          reorderThreshold: true,
          expiryDate: true,
          categoryId: true,
          category: { select: { key: true, nameEn: true } },
        },
      }),
      this.prisma.inventoryConsumptionLog.findMany({
        where: { tenantId, consumedAt: { gte: since } },
        select: {
          quantityUsed: true,
          consumedAt: true,
          procedureCode: true,
          inventoryItemId: true,
          inventoryItem: {
            select: {
              sku: true,
              nameEn: true,
              unit: true,
              category: { select: { key: true, nameEn: true } },
            },
          },
        },
      }),
      this.prisma.inventoryStockMovement.groupBy({
        by: ['movementType'],
        where: { tenantId, createdAt: { gte: since } },
        _count: { _all: true },
        _sum: { quantity: true },
      }),
      this.prisma.purchaseOrder.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { _all: true },
      }),
      this.prisma.inventorySupplier.count({ where: { tenantId, isActive: true } }),
      this.prisma.purchaseOrder.groupBy({
        by: ['supplierId'],
        where: { tenantId, supplierId: { not: null }, createdAt: { gte: since } },
        _count: { _all: true },
      }),
    ]);

    let lowStock = 0;
    let outOfStock = 0;
    let expiringSoon = 0;
    let expired = 0;
    let totalStockValue = 0;
    const valuationByCategory = new Map<
      string,
      { categoryKey: string; categoryName: string; stockValue: number; itemCount: number }
    >();

    for (const item of items) {
      const qty = item.quantityOnHand.toNumber();
      const cost = item.costPerUnit?.toNumber() ?? 0;
      totalStockValue += qty * cost;
      if (qty <= 0) outOfStock += 1;
      else if (qty <= item.reorderThreshold.toNumber()) lowStock += 1;
      if (item.expiryDate) {
        if (item.expiryDate.getTime() < now.getTime()) expired += 1;
        else if (item.expiryDate.getTime() <= expiringBefore.getTime()) expiringSoon += 1;
      }
      const catKey = item.category?.key ?? 'uncategorized';
      const catName = item.category?.nameEn ?? 'Uncategorized';
      const row = valuationByCategory.get(catKey) ?? {
        categoryKey: catKey,
        categoryName: catName,
        stockValue: 0,
        itemCount: 0,
      };
      row.stockValue += qty * cost;
      row.itemCount += 1;
      valuationByCategory.set(catKey, row);
    }

    const consumptionByDay = new Map<string, { date: string; quantity: number; events: number }>();
    const topItemsMap = new Map<
      string,
      { itemId: string; sku: string; name: string; unit: string; quantity: number }
    >();
    const consumptionByCategory = new Map<string, { categoryKey: string; categoryName: string; quantity: number }>();
    const consumptionByProcedure = new Map<string, number>();
    let totalConsumedQty = 0;

    for (const row of consumptions) {
      const qty = row.quantityUsed.toNumber();
      totalConsumedQty += qty;
      const day = row.consumedAt.toISOString().slice(0, 10);
      const dayRow = consumptionByDay.get(day) ?? { date: day, quantity: 0, events: 0 };
      dayRow.quantity += qty;
      dayRow.events += 1;
      consumptionByDay.set(day, dayRow);

      const itemId = row.inventoryItemId;
      const itemRow = topItemsMap.get(itemId) ?? {
        itemId,
        sku: row.inventoryItem.sku,
        name: row.inventoryItem.nameEn,
        unit: row.inventoryItem.unit,
        quantity: 0,
      };
      itemRow.quantity += qty;
      topItemsMap.set(itemId, itemRow);

      const catKey = row.inventoryItem.category?.key ?? 'uncategorized';
      const catName = row.inventoryItem.category?.nameEn ?? 'Uncategorized';
      const catRow = consumptionByCategory.get(catKey) ?? { categoryKey: catKey, categoryName: catName, quantity: 0 };
      catRow.quantity += qty;
      consumptionByCategory.set(catKey, catRow);

      if (row.procedureCode) {
        consumptionByProcedure.set(row.procedureCode, (consumptionByProcedure.get(row.procedureCode) ?? 0) + qty);
      }
    }

    const supplierIds = supplierOrderGroups
      .map((g) => g.supplierId)
      .filter((id): id is string => id != null);
    const suppliers =
      supplierIds.length > 0
        ? await this.prisma.inventorySupplier.findMany({
            where: { tenantId, id: { in: supplierIds } },
            select: { id: true, nameEn: true },
          })
        : [];
    const supplierNameById = new Map(suppliers.map((s) => [s.id, s.nameEn]));

    const poLines = await this.prisma.purchaseOrderLine.findMany({
      where: {
        tenantId,
        purchaseOrder: { createdAt: { gte: since }, status: { not: 'CANCELLED' } },
      },
      select: {
        quantityOrdered: true,
        quantityReceived: true,
        unitCost: true,
        purchaseOrder: { select: { status: true } },
      },
    });

    let procurementOrderedValue = 0;
    let procurementReceivedValue = 0;
    for (const line of poLines) {
      const cost = line.unitCost?.toNumber() ?? 0;
      procurementOrderedValue += line.quantityOrdered.toNumber() * cost;
      procurementReceivedValue += line.quantityReceived.toNumber() * cost;
    }

    return {
      periodDays,
      generatedAt: new Date().toISOString(),
      valuation: {
        totalStockValue,
        itemCount: items.length,
        byCategory: [...valuationByCategory.values()].sort((a, b) => b.stockValue - a.stockValue),
      },
      stockHealth: {
        lowStock,
        outOfStock,
        expiringSoon,
        expired,
      },
      consumption: {
        totalQuantity: totalConsumedQty,
        eventCount: consumptions.length,
        byDay: [...consumptionByDay.values()].sort((a, b) => a.date.localeCompare(b.date)),
        topItems: [...topItemsMap.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 10),
        byCategory: [...consumptionByCategory.values()].sort((a, b) => b.quantity - a.quantity),
        byProcedure: [...consumptionByProcedure.entries()]
          .map(([procedureCode, quantity]) => ({ procedureCode, quantity }))
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 10),
      },
      procurement: {
        activeSupplierCount: activeSuppliers,
        orderedValue: procurementOrderedValue,
        receivedValue: procurementReceivedValue,
        byStatus: poStatusGroups.map((g) => ({ status: g.status, count: g._count._all })),
        topSuppliers: supplierOrderGroups
          .map((g) => ({
            supplierId: g.supplierId!,
            supplierName: supplierNameById.get(g.supplierId!) ?? 'Unknown',
            orderCount: g._count._all,
          }))
          .sort((a, b) => b.orderCount - a.orderCount)
          .slice(0, 8),
      },
      movements: {
        byType: movementGroups.map((g) => ({
          movementType: g.movementType,
          count: g._count._all,
          quantity: g._sum.quantity?.toNumber() ?? 0,
        })),
      },
    };
  }
}
