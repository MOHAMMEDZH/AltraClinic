import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { INVENTORY_ITEM_REPOSITORY, INVENTORY_SUPPLIER_REPOSITORY, PURCHASE_ORDER_REPOSITORY, INVENTORY_WAREHOUSE_REPOSITORY, STOCK_TRANSFER_REPOSITORY, STOCK_COUNT_REPOSITORY, STOCK_REQUEST_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { InventoryItemRepository } from '../../domain/repositories/inventory-item.repository.interface';
import { InventorySupplierRepository } from '../../domain/repositories/inventory-supplier.repository.interface';
import { PurchaseOrderRepository } from '../../domain/repositories/purchase-order.repository.interface';
import { InventoryWarehouseRepository } from '../../domain/repositories/inventory-warehouse.repository.interface';
import { StockTransferRepository } from '../../domain/repositories/stock-transfer.repository.interface';
import { StockCountRepository } from '../../domain/repositories/stock-count.repository.interface';
import { StockRequestRepository } from '../../domain/repositories/stock-request.repository.interface';

const EXPIRY_ALERT_DAYS = 7;

@Injectable()
export class GetInventorySummaryHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly repo: InventoryItemRepository,
    @Inject(INVENTORY_SUPPLIER_REPOSITORY) private readonly supplierRepo: InventorySupplierRepository,
    @Inject(PURCHASE_ORDER_REPOSITORY) private readonly poRepo: PurchaseOrderRepository,
    @Inject(INVENTORY_WAREHOUSE_REPOSITORY) private readonly warehouseRepo: InventoryWarehouseRepository,
    @Inject(STOCK_TRANSFER_REPOSITORY) private readonly transferRepo: StockTransferRepository,
    @Inject(STOCK_COUNT_REPOSITORY) private readonly countRepo: StockCountRepository,
    @Inject(STOCK_REQUEST_REPOSITORY) private readonly requestRepo: StockRequestRepository,
  ) {}

  async execute() {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const now = new Date();
    const expiringBefore = new Date(now);
    expiringBefore.setDate(expiringBefore.getDate() + EXPIRY_ALERT_DAYS);

    const baseWhere = { tenantId, deletedAt: null };

    const [totalItems, outOfStock, valuationRows, recentMovements, batchCount, expirySummary, activeSupplierCount, poCounts, activeWarehouseCount, openTransferCount, countSummary, requestSummary] =
      await Promise.all([
        this.prisma.inventoryItem.count({ where: baseWhere }),
        this.prisma.inventoryItem.count({
          where: { ...baseWhere, quantityOnHand: { lte: new Prisma.Decimal(0) } },
        }),
        this.prisma.inventoryItem.findMany({
          where: baseWhere,
          select: { quantityOnHand: true, costPerUnit: true, reorderThreshold: true },
        }),
        this.repo.listRecentStockMovements(tenantId, 10),
        this.prisma.inventoryBatch.count({ where: { tenantId } }),
        this.repo.getExpirySummary(tenantId),
        this.supplierRepo.countActive(tenantId),
        this.poRepo.getSummaryCounts(tenantId),
        this.warehouseRepo.countActive(tenantId),
        this.transferRepo.getOpenCount(tenantId),
        this.countRepo.getSummaryCounts(tenantId),
        this.requestRepo.getSummaryCounts(tenantId),
      ]);

    let expiringSoon: number;
    let expired: number;
    if (batchCount > 0) {
      expiringSoon = expirySummary.expiringSoonCount;
      expired = expirySummary.expiredCount;
    } else {
      [expiringSoon, expired] = await Promise.all([
        this.prisma.inventoryItem.count({
          where: { ...baseWhere, expiryDate: { gte: now, lte: expiringBefore } },
        }),
        this.prisma.inventoryItem.count({
          where: { ...baseWhere, expiryDate: { lt: now } },
        }),
      ]);
    }

    let lowStock = 0;
    let stockValue = 0;
    for (const row of valuationRows) {
      const qty = row.quantityOnHand.toNumber();
      const cost = row.costPerUnit?.toNumber() ?? 0;
      stockValue += qty * cost;
      if (qty > 0 && qty <= row.reorderThreshold.toNumber()) lowStock += 1;
    }

    return {
      totalItems,
      lowStockCount: lowStock,
      outOfStockCount: outOfStock,
      expiringSoonCount: expiringSoon,
      expiredCount: expired,
      stockValue,
      activeSupplierCount,
      pendingPoApprovalCount: poCounts.pendingApprovalCount,
      openPoCount: poCounts.openPoCount,
      activeWarehouseCount,
      openTransferCount,
      pendingCountApprovalCount: countSummary.pendingApprovalCount,
      openCountSessions: countSummary.inProgressCount,
      pendingRequestApprovalCount: requestSummary.pendingApprovalCount,
      openRequestFulfillmentCount: requestSummary.openFulfillmentCount,
      recentMovements: recentMovements.map((m) => ({
        id: m.id,
        itemId: m.inventoryItemId,
        sku: m.sku,
        itemName: m.itemNameEn,
        movementType: m.movementType,
        quantity: m.quantity,
        quantityBefore: m.quantityBefore,
        quantityAfter: m.quantityAfter,
        unit: m.unit,
        reason: m.reason,
        notes: m.notes,
        performedBy: m.performedBy,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }
}
