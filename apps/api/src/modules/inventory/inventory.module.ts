import { Module } from '@nestjs/common';
import { InventoryController } from './controllers/inventory.controller';
import { CreateInventoryItemHandler } from './application/handlers/create-inventory-item.handler';
import { ConsumeInventoryHandler } from './application/handlers/consume-inventory.handler';
import { GetInventoryItemHandler } from './application/handlers/get-inventory-item.handler';
import { LookupInventoryItemHandler } from './application/handlers/lookup-inventory-item.handler';
import { ListInventoryItemsHandler } from './application/handlers/list-inventory-items.handler';
import { UpdateInventoryItemHandler } from './application/handlers/update-inventory-item.handler';
import { ReceiveInventoryHandler } from './application/handlers/receive-inventory.handler';
import {
  ArchiveInventoryItemHandler,
  ReactivateInventoryItemHandler,
} from './application/handlers/archive-inventory-item.handler';
import { ExportInventoryItemsHandler } from './application/handlers/export-inventory-items.handler';
import { BulkArchiveInventoryItemsHandler } from './application/handlers/bulk-archive-inventory-items.handler';
import { ListInventoryConsumptionsHandler } from './application/handlers/list-inventory-consumptions.handler';
import { GetInventorySummaryHandler } from './application/handlers/get-inventory-summary.handler';
import { GetInventoryAnalyticsHandler } from './application/handlers/get-inventory-analytics.handler';
import { AdjustInventoryHandler } from './application/handlers/adjust-inventory.handler';
import { ListInventoryMovementsHandler } from './application/handlers/list-inventory-movements.handler';
import { PrismaInventoryRepository } from './infrastructure/prisma-inventory.repository';
import { InventoryPolicyService } from './policies/inventory-policy.service';
import { InventoryPermissionGuard } from './api/inventory-permission.guard';
import {
  INVENTORY_ITEM_REPOSITORY,
  INVENTORY_CATEGORY_REPOSITORY,
  INVENTORY_SUPPLIER_REPOSITORY,
  PURCHASE_ORDER_REPOSITORY,
  INVENTORY_WAREHOUSE_REPOSITORY,
  STOCK_TRANSFER_REPOSITORY,
  STOCK_COUNT_REPOSITORY,
  STOCK_REQUEST_REPOSITORY,
} from '../../infrastructure/provider.tokens';
import { PrismaInventoryCategoryRepository } from './infrastructure/prisma-inventory-category.repository';
import { PrismaInventorySupplierRepository } from './infrastructure/prisma-inventory-supplier.repository';
import { ListInventoryCategoriesHandler } from './application/handlers/list-inventory-categories.handler';
import { CreateInventoryCategoryHandler } from './application/handlers/create-inventory-category.handler';
import { ListInventoryBatchesHandler } from './application/handlers/list-inventory-batches.handler';
import { GetInventoryExpirySummaryHandler } from './application/handlers/get-inventory-expiry-summary.handler';
import { GetInventoryItemBatchesHandler } from './application/handlers/get-inventory-item-batches.handler';
import { DisposeInventoryBatchHandler } from './application/handlers/dispose-inventory-batch.handler';
import { ListInventorySuppliersHandler } from './application/handlers/list-inventory-suppliers.handler';
import { GetInventorySupplierHandler } from './application/handlers/get-inventory-supplier.handler';
import { CreateInventorySupplierHandler } from './application/handlers/create-inventory-supplier.handler';
import { UpdateInventorySupplierHandler } from './application/handlers/update-inventory-supplier.handler';
import {
  DeactivateInventorySupplierHandler,
  ReactivateInventorySupplierHandler,
} from './application/handlers/deactivate-inventory-supplier.handler';
import { PrismaPurchaseOrderRepository } from './infrastructure/prisma-purchase-order.repository';
import {
  ListPurchaseOrdersHandler,
  GetPurchaseOrderHandler,
  CreatePurchaseOrderHandler,
  SubmitPurchaseOrderHandler,
  ApprovePurchaseOrderHandler,
  CancelPurchaseOrderHandler,
} from './application/handlers/purchase-order.handlers';
import { ReceivePurchaseOrderLineHandler } from './application/handlers/receive-purchase-order-line.handler';
import { PrismaInventoryWarehouseRepository } from './infrastructure/prisma-inventory-warehouse.repository';
import { PrismaStockTransferRepository } from './infrastructure/prisma-stock-transfer.repository';
import {
  ListInventoryWarehousesHandler,
  GetInventoryWarehouseHandler,
  CreateInventoryWarehouseHandler,
  UpdateInventoryWarehouseHandler,
  DeactivateInventoryWarehouseHandler,
  ReactivateInventoryWarehouseHandler,
  SetDefaultInventoryWarehouseHandler,
  ListWarehouseStockHandler,
  ListItemWarehouseStockHandler,
} from './application/handlers/inventory-warehouse.handlers';
import {
  ListStockTransfersHandler,
  GetStockTransferHandler,
  CreateStockTransferHandler,
  ShipStockTransferHandler,
  ReceiveStockTransferLineHandler,
  CancelStockTransferHandler,
} from './application/handlers/stock-transfer.handlers';
import { PrismaStockCountRepository } from './infrastructure/prisma-stock-count.repository';
import { PrismaStockRequestRepository } from './infrastructure/prisma-stock-request.repository';
import {
  ListStockCountsHandler,
  GetStockCountHandler,
  CreateStockCountHandler,
  StartStockCountHandler,
  UpdateStockCountLineHandler,
  SubmitStockCountHandler,
  ApproveStockCountHandler,
  CancelStockCountHandler,
} from './application/handlers/stock-count.handlers';
import {
  ListStockRequestsHandler,
  GetStockRequestHandler,
  CreateStockRequestHandler,
  SubmitStockRequestHandler,
  ApproveStockRequestHandler,
  RejectStockRequestHandler,
  CancelStockRequestHandler,
  FulfillStockRequestLineHandler,
} from './application/handlers/stock-request.handlers';
import { AutoReorderInventoryHandler } from './application/handlers/auto-reorder.handler';
import { ConvertStockRequestToPoHandler } from './application/handlers/convert-stock-request-to-po.handler';
import { ExportInventoryAnalyticsHandler } from './application/handlers/export-inventory-analytics.handler';
import { InventoryReorderService } from './domain/services/inventory-reorder.service';

@Module({
  controllers: [InventoryController],
  providers: [
    { provide: INVENTORY_ITEM_REPOSITORY, useClass: PrismaInventoryRepository },
    { provide: INVENTORY_CATEGORY_REPOSITORY, useClass: PrismaInventoryCategoryRepository },
    { provide: INVENTORY_SUPPLIER_REPOSITORY, useClass: PrismaInventorySupplierRepository },
    { provide: PURCHASE_ORDER_REPOSITORY, useClass: PrismaPurchaseOrderRepository },
    { provide: INVENTORY_WAREHOUSE_REPOSITORY, useClass: PrismaInventoryWarehouseRepository },
    { provide: STOCK_TRANSFER_REPOSITORY, useClass: PrismaStockTransferRepository },
    { provide: STOCK_COUNT_REPOSITORY, useClass: PrismaStockCountRepository },
    { provide: STOCK_REQUEST_REPOSITORY, useClass: PrismaStockRequestRepository },
    CreateInventoryItemHandler,
    ConsumeInventoryHandler,
    GetInventoryItemHandler,
    LookupInventoryItemHandler,
    ListInventoryItemsHandler,
    UpdateInventoryItemHandler,
    ReceiveInventoryHandler,
    ArchiveInventoryItemHandler,
    ReactivateInventoryItemHandler,
    ExportInventoryItemsHandler,
    BulkArchiveInventoryItemsHandler,
    GetInventorySummaryHandler,
    GetInventoryAnalyticsHandler,
    AdjustInventoryHandler,
    ListInventoryMovementsHandler,
    ListInventoryConsumptionsHandler,
    ListInventoryCategoriesHandler,
    CreateInventoryCategoryHandler,
    ListInventoryBatchesHandler,
    GetInventoryExpirySummaryHandler,
    GetInventoryItemBatchesHandler,
    DisposeInventoryBatchHandler,
    ListInventorySuppliersHandler,
    GetInventorySupplierHandler,
    CreateInventorySupplierHandler,
    UpdateInventorySupplierHandler,
    DeactivateInventorySupplierHandler,
    ReactivateInventorySupplierHandler,
    ListPurchaseOrdersHandler,
    GetPurchaseOrderHandler,
    CreatePurchaseOrderHandler,
    SubmitPurchaseOrderHandler,
    ApprovePurchaseOrderHandler,
    CancelPurchaseOrderHandler,
    ReceivePurchaseOrderLineHandler,
    ListInventoryWarehousesHandler,
    GetInventoryWarehouseHandler,
    CreateInventoryWarehouseHandler,
    UpdateInventoryWarehouseHandler,
    DeactivateInventoryWarehouseHandler,
    ReactivateInventoryWarehouseHandler,
    SetDefaultInventoryWarehouseHandler,
    ListWarehouseStockHandler,
    ListItemWarehouseStockHandler,
    ListStockTransfersHandler,
    GetStockTransferHandler,
    CreateStockTransferHandler,
    ShipStockTransferHandler,
    ReceiveStockTransferLineHandler,
    CancelStockTransferHandler,
    ListStockCountsHandler,
    GetStockCountHandler,
    CreateStockCountHandler,
    StartStockCountHandler,
    UpdateStockCountLineHandler,
    SubmitStockCountHandler,
    ApproveStockCountHandler,
    CancelStockCountHandler,
    ListStockRequestsHandler,
    GetStockRequestHandler,
    CreateStockRequestHandler,
    SubmitStockRequestHandler,
    ApproveStockRequestHandler,
    RejectStockRequestHandler,
    CancelStockRequestHandler,
    FulfillStockRequestLineHandler,
    AutoReorderInventoryHandler,
    ConvertStockRequestToPoHandler,
    ExportInventoryAnalyticsHandler,
    InventoryReorderService,
    InventoryPolicyService,
    InventoryPermissionGuard,
  ],
  exports: [
    ConsumeInventoryHandler,
    ListInventoryItemsHandler,
    ListInventoryConsumptionsHandler,
    ListInventoryMovementsHandler,
    INVENTORY_ITEM_REPOSITORY,
  ],
})
export class InventoryModule {}
