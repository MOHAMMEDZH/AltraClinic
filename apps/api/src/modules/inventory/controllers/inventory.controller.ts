import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { InventoryPermissionGuard } from '../api/inventory-permission.guard';
import { RequirePermission, rolesGrantPermission, customRoleGrantsApply } from '../../auth/api/guards/permission.guard';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { RequireLicensedModule } from '../../subscription/api/decorators/require-licensed-module.decorator';
import { CreateInventoryItemDTO } from '../application/dto/create-inventory-item.dto';
import { ConsumeInventoryDTO } from '../application/dto/consume-inventory.dto';
import {
  CorrectInventoryUsageDto,
  InventoryUsageListQueryDto,
  InventoryUsageOwnerReportQueryDto,
  PostInventoryUsageDto,
  ReverseInventoryUsageDto,
} from '../application/dto/inventory-usage.dto';
import { UpdateInventoryItemDTO, ReceiveInventoryDTO, CreateInventoryCategoryDTO } from '../application/dto/update-inventory-item.dto';
import { ListInventoryCategoriesHandler } from '../application/handlers/list-inventory-categories.handler';
import { CreateInventoryCategoryHandler } from '../application/handlers/create-inventory-category.handler';
import { CreateInventoryItemHandler } from '../application/handlers/create-inventory-item.handler';
import { ConsumeInventoryHandler } from '../application/handlers/consume-inventory.handler';
import { InventoryUsagePostingService } from '../application/services/inventory-usage-posting.service';
import { InventoryUsageOwnerReportService } from '../application/services/inventory-usage-owner-report.service';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { GetInventoryItemHandler } from '../application/handlers/get-inventory-item.handler';
import { LookupInventoryItemHandler } from '../application/handlers/lookup-inventory-item.handler';
import { ListInventoryItemsHandler } from '../application/handlers/list-inventory-items.handler';
import { UpdateInventoryItemHandler } from '../application/handlers/update-inventory-item.handler';
import { ReceiveInventoryHandler } from '../application/handlers/receive-inventory.handler';
import {
  ArchiveInventoryItemHandler,
  ReactivateInventoryItemHandler,
} from '../application/handlers/archive-inventory-item.handler';
import { ExportInventoryItemsHandler } from '../application/handlers/export-inventory-items.handler';
import { BulkArchiveInventoryItemsHandler } from '../application/handlers/bulk-archive-inventory-items.handler';
import { BulkArchiveInventoryItemsDTO } from '../application/dto/bulk-archive-inventory-items.dto';
import { AdjustInventoryDTO } from '../application/dto/adjust-inventory.dto';
import { AdjustInventoryHandler } from '../application/handlers/adjust-inventory.handler';
import { ListInventoryMovementsHandler } from '../application/handlers/list-inventory-movements.handler';
import { ListInventoryConsumptionsHandler } from '../application/handlers/list-inventory-consumptions.handler';
import { GetInventorySummaryHandler } from '../application/handlers/get-inventory-summary.handler';
import { GetInventoryAnalyticsHandler } from '../application/handlers/get-inventory-analytics.handler';
import { ListInventoryBatchesHandler } from '../application/handlers/list-inventory-batches.handler';
import { GetInventoryExpirySummaryHandler } from '../application/handlers/get-inventory-expiry-summary.handler';
import { GetInventoryItemBatchesHandler } from '../application/handlers/get-inventory-item-batches.handler';
import { DisposeInventoryBatchHandler } from '../application/handlers/dispose-inventory-batch.handler';
import { DisposeInventoryBatchDTO } from '../application/dto/dispose-inventory-batch.dto';
import { CreateInventorySupplierDTO, UpdateInventorySupplierDTO } from '../application/dto/inventory-supplier.dto';
import { ListInventorySuppliersHandler } from '../application/handlers/list-inventory-suppliers.handler';
import { GetInventorySupplierHandler } from '../application/handlers/get-inventory-supplier.handler';
import { CreateInventorySupplierHandler } from '../application/handlers/create-inventory-supplier.handler';
import { UpdateInventorySupplierHandler } from '../application/handlers/update-inventory-supplier.handler';
import {
  DeactivateInventorySupplierHandler,
  ReactivateInventorySupplierHandler,
} from '../application/handlers/deactivate-inventory-supplier.handler';
import { CreatePurchaseOrderDTO, ReceivePurchaseOrderLineDTO } from '../application/dto/purchase-order.dto';
import {
  ListPurchaseOrdersHandler,
  GetPurchaseOrderHandler,
  CreatePurchaseOrderHandler,
  SubmitPurchaseOrderHandler,
  ApprovePurchaseOrderHandler,
  CancelPurchaseOrderHandler,
} from '../application/handlers/purchase-order.handlers';
import { ReceivePurchaseOrderLineHandler } from '../application/handlers/receive-purchase-order-line.handler';
import { CreateInventoryWarehouseDTO, UpdateInventoryWarehouseDTO } from '../application/dto/inventory-warehouse.dto';
import { CreateStockTransferDTO, ReceiveStockTransferLineDTO } from '../application/dto/stock-transfer.dto';
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
} from '../application/handlers/inventory-warehouse.handlers';
import {
  ListStockTransfersHandler,
  GetStockTransferHandler,
  CreateStockTransferHandler,
  ShipStockTransferHandler,
  ReceiveStockTransferLineHandler,
  CancelStockTransferHandler,
} from '../application/handlers/stock-transfer.handlers';
import { CreateStockCountDTO, UpdateStockCountLineDTO } from '../application/dto/stock-count.dto';
import {
  ListStockCountsHandler,
  GetStockCountHandler,
  CreateStockCountHandler,
  StartStockCountHandler,
  UpdateStockCountLineHandler,
  SubmitStockCountHandler,
  ApproveStockCountHandler,
  CancelStockCountHandler,
} from '../application/handlers/stock-count.handlers';
import {
  CreateStockRequestDTO,
  FulfillStockRequestLineDTO,
  RejectStockRequestDTO,
} from '../application/dto/stock-request.dto';
import {
  ListStockRequestsHandler,
  GetStockRequestHandler,
  CreateStockRequestHandler,
  SubmitStockRequestHandler,
  ApproveStockRequestHandler,
  RejectStockRequestHandler,
  CancelStockRequestHandler,
  FulfillStockRequestLineHandler,
} from '../application/handlers/stock-request.handlers';
import { AutoReorderInventoryHandler } from '../application/handlers/auto-reorder.handler';
import { ConvertStockRequestToPoHandler } from '../application/handlers/convert-stock-request-to-po.handler';
import { ExportInventoryAnalyticsHandler } from '../application/handlers/export-inventory-analytics.handler';

@Controller('inventory')
@UseGuards(InventoryPermissionGuard)
@RequireLicensedModule('inventory')
export class InventoryController {
  constructor(
    private readonly createItemHandler: CreateInventoryItemHandler,
    private readonly consumeHandler: ConsumeInventoryHandler,
    private readonly getHandler: GetInventoryItemHandler,
    private readonly lookupHandler: LookupInventoryItemHandler,
    private readonly listHandler: ListInventoryItemsHandler,
    private readonly updateHandler: UpdateInventoryItemHandler,
    private readonly receiveHandler: ReceiveInventoryHandler,
    private readonly archiveHandler: ArchiveInventoryItemHandler,
    private readonly reactivateHandler: ReactivateInventoryItemHandler,
    private readonly exportItemsHandler: ExportInventoryItemsHandler,
    private readonly bulkArchiveHandler: BulkArchiveInventoryItemsHandler,
    private readonly summaryHandler: GetInventorySummaryHandler,
    private readonly analyticsHandler: GetInventoryAnalyticsHandler,
    private readonly adjustHandler: AdjustInventoryHandler,
    private readonly listMovementsHandler: ListInventoryMovementsHandler,
    private readonly listConsumptionsHandler: ListInventoryConsumptionsHandler,
    private readonly listCategoriesHandler: ListInventoryCategoriesHandler,
    private readonly createCategoryHandler: CreateInventoryCategoryHandler,
    private readonly listBatchesHandler: ListInventoryBatchesHandler,
    private readonly expirySummaryHandler: GetInventoryExpirySummaryHandler,
    private readonly itemBatchesHandler: GetInventoryItemBatchesHandler,
    private readonly disposeBatchHandler: DisposeInventoryBatchHandler,
    private readonly listSuppliersHandler: ListInventorySuppliersHandler,
    private readonly getSupplierHandler: GetInventorySupplierHandler,
    private readonly createSupplierHandler: CreateInventorySupplierHandler,
    private readonly updateSupplierHandler: UpdateInventorySupplierHandler,
    private readonly deactivateSupplierHandler: DeactivateInventorySupplierHandler,
    private readonly reactivateSupplierHandler: ReactivateInventorySupplierHandler,
    private readonly listPurchaseOrdersHandler: ListPurchaseOrdersHandler,
    private readonly getPurchaseOrderHandler: GetPurchaseOrderHandler,
    private readonly createPurchaseOrderHandler: CreatePurchaseOrderHandler,
    private readonly submitPurchaseOrderHandler: SubmitPurchaseOrderHandler,
    private readonly approvePurchaseOrderHandler: ApprovePurchaseOrderHandler,
    private readonly cancelPurchaseOrderHandler: CancelPurchaseOrderHandler,
    private readonly receivePurchaseOrderLineHandler: ReceivePurchaseOrderLineHandler,
    private readonly listWarehousesHandler: ListInventoryWarehousesHandler,
    private readonly getWarehouseHandler: GetInventoryWarehouseHandler,
    private readonly createWarehouseHandler: CreateInventoryWarehouseHandler,
    private readonly updateWarehouseHandler: UpdateInventoryWarehouseHandler,
    private readonly deactivateWarehouseHandler: DeactivateInventoryWarehouseHandler,
    private readonly reactivateWarehouseHandler: ReactivateInventoryWarehouseHandler,
    private readonly setDefaultWarehouseHandler: SetDefaultInventoryWarehouseHandler,
    private readonly listWarehouseStockHandler: ListWarehouseStockHandler,
    private readonly listItemWarehouseStockHandler: ListItemWarehouseStockHandler,
    private readonly listStockTransfersHandler: ListStockTransfersHandler,
    private readonly getStockTransferHandler: GetStockTransferHandler,
    private readonly createStockTransferHandler: CreateStockTransferHandler,
    private readonly shipStockTransferHandler: ShipStockTransferHandler,
    private readonly receiveStockTransferLineHandler: ReceiveStockTransferLineHandler,
    private readonly cancelStockTransferHandler: CancelStockTransferHandler,
    private readonly listStockCountsHandler: ListStockCountsHandler,
    private readonly getStockCountHandler: GetStockCountHandler,
    private readonly createStockCountHandler: CreateStockCountHandler,
    private readonly startStockCountHandler: StartStockCountHandler,
    private readonly updateStockCountLineHandler: UpdateStockCountLineHandler,
    private readonly submitStockCountHandler: SubmitStockCountHandler,
    private readonly approveStockCountHandler: ApproveStockCountHandler,
    private readonly cancelStockCountHandler: CancelStockCountHandler,
    private readonly listStockRequestsHandler: ListStockRequestsHandler,
    private readonly getStockRequestHandler: GetStockRequestHandler,
    private readonly createStockRequestHandler: CreateStockRequestHandler,
    private readonly submitStockRequestHandler: SubmitStockRequestHandler,
    private readonly approveStockRequestHandler: ApproveStockRequestHandler,
    private readonly rejectStockRequestHandler: RejectStockRequestHandler,
    private readonly cancelStockRequestHandler: CancelStockRequestHandler,
    private readonly fulfillStockRequestLineHandler: FulfillStockRequestLineHandler,
    private readonly autoReorderHandler: AutoReorderInventoryHandler,
    private readonly convertStockRequestToPoHandler: ConvertStockRequestToPoHandler,
    private readonly exportAnalyticsHandler: ExportInventoryAnalyticsHandler,
    private readonly usagePosting: InventoryUsagePostingService,
    private readonly ownerReportService: InventoryUsageOwnerReportService,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /** Explicit resource/action grant from role matrix or custom role — never a client flag. */
  private async userHasPermission(
    user: JwtClaimsVO | undefined,
    resource: string,
    action: string,
  ): Promise<boolean> {
    if (!user) return false;
    if (rolesGrantPermission(user.roles ?? [], resource, action as never)) return true;
    if (!customRoleGrantsApply(resource, action as never)) return false;
    const tenantId = user.tenantId ?? '';
    if (!tenantId || !user.sub) return false;
    const rows = await this.prisma.userCustomRole.findMany({
      where: { userId: user.sub, tenantId },
      include: { customRole: { select: { permissions: true, isArchived: true } } },
    });
    return rows.some((row) => {
      if (row.customRole.isArchived) return false;
      const grants = row.customRole.permissions as Record<string, string[]>;
      return (grants[resource] ?? []).includes(action);
    });
  }

  /** PHI inclusion requires api.patients / view — inventory export alone is not enough. */
  private async userHasPatientsView(user?: JwtClaimsVO): Promise<boolean> {
    return this.userHasPermission(user, 'api.patients', 'view');
  }

  @Post('usage')
  @RequirePermission('api.inventory', 'update')
  async postUsage(
    @Body() body: PostInventoryUsageDto,
    @Req() req: { user?: JwtClaimsVO },
  ) {
    const userId = req.user?.sub ?? '';
    const injectable = body.injectable ?? null;
    const hasInjectableCreatePermission =
      injectable != null
        ? await this.userHasPermission(req.user, 'api.clinical-injectable', 'create')
        : false;
    if (injectable != null && !hasInjectableCreatePermission) {
      throw new ForbiddenException(
        'api.clinical-injectable create permission is required to record injectable usage',
      );
    }
    return await this.consumeHandler.execute({
      itemId: body.itemId,
      quantity: body.quantity,
      consumedBy: userId,
      recordedByUserId: userId,
      usedByUserId: body.usedByUserId ?? null,
      usageType: body.usageType ?? 'CLINICAL_CONSUMPTION',
      warehouseId: body.warehouseId ?? null,
      branchId: body.branchId ?? null,
      encounterId: body.encounterId ?? null,
      beautyAnnotationId: body.beautyAnnotationId ?? body.injectable?.beautyAnnotationId ?? null,
      patientId: body.patientId ?? null,
      appointmentId: body.appointmentId ?? null,
      clinicalServiceId: body.clinicalServiceId ?? null,
      inventoryBatchId: body.inventoryBatchId ?? null,
      reasonCode: body.reasonCode ?? null,
      procedureCode: body.procedureCode ?? null,
      notes: body.notes ?? null,
      injectable,
      hasInjectableCreatePermission,
    });
  }

  @Post('usage/:id/reverse')
  @RequirePermission('api.inventory', 'approve')
  async reverseUsage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReverseInventoryUsageDto,
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    const userId = req.user?.userId ?? req.user?.sub ?? '';
    const tenant = (await this.tenantContext.resolve()) as { tenantId?: string };
    if (!tenant.tenantId) throw new BadRequestException('tenant context could not be resolved');
    return this.usagePosting.reverseUsage({
      tenantId: tenant.tenantId,
      usageLedgerId: id,
      recordedByUserId: userId,
      reasonCode: body.reasonCode ?? null,
      notes: body.notes ?? null,
    });
  }

  @Post('usage/:id/correct')
  @RequirePermission('api.inventory', 'approve')
  async correctUsage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CorrectInventoryUsageDto,
    @Req() req: { user?: JwtClaimsVO },
  ) {
    const userId = req.user?.sub ?? '';
    const tenant = (await this.tenantContext.resolve()) as { tenantId?: string };
    if (!tenant.tenantId) throw new BadRequestException('tenant context could not be resolved');
    const injectable = body.correction.injectable ?? null;
    const hasInjectableCreatePermission =
      injectable != null
        ? await this.userHasPermission(req.user as JwtClaimsVO | undefined, 'api.clinical-injectable', 'create')
        : false;
    if (injectable != null && !hasInjectableCreatePermission) {
      throw new ForbiddenException(
        'api.clinical-injectable create permission is required to record injectable usage',
      );
    }
    return this.usagePosting.correctUsage({
      tenantId: tenant.tenantId,
      usageLedgerId: id,
      recordedByUserId: userId,
      reasonCode: body.reasonCode,
      correction: {
        inventoryItemId: body.correction.itemId,
        quantity: body.correction.quantity,
        usageType: body.correction.usageType ?? 'CORRECTION',
        usedByUserId: body.correction.usedByUserId ?? null,
        warehouseId: body.correction.warehouseId ?? null,
        inventoryBatchId: body.correction.inventoryBatchId ?? null,
        patientId: body.correction.patientId ?? null,
        clinicalServiceId: body.correction.clinicalServiceId ?? null,
        appointmentId: body.correction.appointmentId ?? null,
        reasonCode: body.correction.reasonCode ?? body.reasonCode,
        notes: body.correction.notes ?? null,
        injectable,
        hasInjectableCreatePermission,
      },
    });
  }

  @Get('usage/owner-report')
  @RequirePermission('api.inventory', 'export')
  async ownerReport(
    @Query() query: InventoryUsageOwnerReportQueryDto,
    @Req() req?: { user?: JwtClaimsVO },
  ) {
    const tenant = (await this.tenantContext.resolve()) as { tenantId?: string };
    if (!tenant.tenantId) throw new BadRequestException('tenant context could not be resolved');
    const includePhiFlag = query.includePhi === 'true' || query.includePhi === '1';
    const hasPhiPermission = await this.userHasPatientsView(req?.user);
    if (includePhiFlag && !hasPhiPermission) {
      throw new ForbiddenException('api.patients view permission required to include PHI fields');
    }
    return this.ownerReportService.report({
      tenantId: tenant.tenantId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      usageType: query.usageType,
      usedByUserId: query.usedByUserId,
      inventoryItemId: query.inventoryItemId,
      inventoryBatchId: query.inventoryBatchId,
      warehouseId: query.warehouseId,
      branchId: query.branchId,
      clinicalServiceId: query.clinicalServiceId,
      includePhi: includePhiFlag,
      hasPhiPermission,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get('usage')
  @RequirePermission('api.inventory', 'view')
  async listUsage(@Query() query: InventoryUsageListQueryDto) {
    return await this.listConsumptionsHandler.execute({
      itemId: query.itemId,
      encounterId: query.encounterId,
      patientId: query.patientId,
      procedureCode: query.procedureCode,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get('usage/:id/injectable')
  @RequirePermission('api.clinical-injectable', 'view')
  async getInjectable(@Param('id', ParseUUIDPipe) id: string) {
    const tenant = (await this.tenantContext.resolve()) as { tenantId?: string };
    if (!tenant.tenantId) throw new BadRequestException('tenant context could not be resolved');
    const ledger = await this.prisma.inventoryUsageLedger.findFirst({
      where: { id, tenantId: tenant.tenantId },
      include: { injectableDetail: true },
    });
    if (!ledger?.injectableDetail) {
      throw new BadRequestException('Injectable usage detail not found');
    }
    return ledger.injectableDetail;
  }

  @Get('categories')
  @RequirePermission('api.inventory', 'view')
  async listCategories() {
    return await this.listCategoriesHandler.execute();
  }

  @Post('categories')
  @RequirePermission('api.inventory', 'manage')
  async createCategory(@Body() body: CreateInventoryCategoryDTO) {
    return await this.createCategoryHandler.execute({
      nameEn: body.nameEn,
      nameAr: body.nameAr ?? null,
      key: body.key,
    });
  }

  @Get('suppliers')
  @RequirePermission('api.inventory', 'view')
  async listSuppliers(
    @Query('q') q?: string,
    @Query('status') status?: 'active' | 'all',
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return await this.listSuppliersHandler.execute({
      q: q?.trim() || undefined,
      status,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Post('suppliers')
  @RequirePermission('api.inventory', 'manage')
  async createSupplier(@Body() body: CreateInventorySupplierDTO) {
    return await this.createSupplierHandler.execute({
      code: body.code,
      nameEn: body.nameEn,
      nameAr: body.nameAr ?? null,
      contactName: body.contactName ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      address: body.address ?? null,
      leadTimeDays: body.leadTimeDays ?? null,
      notes: body.notes ?? null,
    });
  }

  @Get('suppliers/:supplierId')
  @RequirePermission('api.inventory', 'view')
  async getSupplier(@Param('supplierId') supplierId: string) {
    return await this.getSupplierHandler.execute(supplierId);
  }

  @Patch('suppliers/:supplierId')
  @RequirePermission('api.inventory', 'manage')
  async updateSupplier(@Param('supplierId') supplierId: string, @Body() body: UpdateInventorySupplierDTO) {
    return await this.updateSupplierHandler.execute({
      supplierId,
      code: body.code,
      nameEn: body.nameEn,
      nameAr: body.nameAr,
      contactName: body.contactName,
      email: body.email,
      phone: body.phone,
      address: body.address,
      leadTimeDays: body.leadTimeDays,
      notes: body.notes,
    });
  }

  @Post('suppliers/:supplierId/deactivate')
  @RequirePermission('api.inventory', 'manage')
  async deactivateSupplier(@Param('supplierId') supplierId: string) {
    return await this.deactivateSupplierHandler.execute(supplierId);
  }

  @Post('suppliers/:supplierId/reactivate')
  @RequirePermission('api.inventory', 'manage')
  async reactivateSupplier(@Param('supplierId') supplierId: string) {
    return await this.reactivateSupplierHandler.execute(supplierId);
  }

  @Get('purchase-orders')
  @RequirePermission('api.inventory', 'view')
  async listPurchaseOrders(
    @Query('status') status?: string,
    @Query('supplierId') supplierId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return await this.listPurchaseOrdersHandler.execute({
      status: status?.trim() || undefined,
      supplierId: supplierId?.trim() || undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Post('purchase-orders')
  @RequirePermission('api.inventory', 'create')
  async createPurchaseOrder(
    @Body() body: CreatePurchaseOrderDTO,
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    const userId = req.user?.userId ?? req.user?.sub ?? '';
    return await this.createPurchaseOrderHandler.execute({
      supplierId: body.supplierId ?? null,
      notes: body.notes ?? null,
      lines: body.lines.map((l) => ({
        itemId: l.itemId,
        quantity: l.quantity,
        unitCost: l.unitCost ?? null,
      })),
      requestedBy: userId,
    });
  }

  @Get('purchase-orders/:orderId')
  @RequirePermission('api.inventory', 'view')
  async getPurchaseOrder(@Param('orderId') orderId: string) {
    return await this.getPurchaseOrderHandler.execute(orderId);
  }

  @Post('purchase-orders/:orderId/submit')
  @RequirePermission('api.inventory', 'update')
  async submitPurchaseOrder(@Param('orderId') orderId: string) {
    return await this.submitPurchaseOrderHandler.execute(orderId);
  }

  @Post('purchase-orders/:orderId/approve')
  @RequirePermission('api.inventory', 'approve')
  async approvePurchaseOrder(
    @Param('orderId') orderId: string,
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    const userId = req.user?.userId ?? req.user?.sub ?? '';
    return await this.approvePurchaseOrderHandler.execute(orderId, userId);
  }

  @Post('purchase-orders/:orderId/cancel')
  @RequirePermission('api.inventory', 'update')
  async cancelPurchaseOrder(@Param('orderId') orderId: string) {
    return await this.cancelPurchaseOrderHandler.execute(orderId);
  }

  @Post('purchase-orders/lines/:lineId/receive')
  @RequirePermission('api.inventory', 'update')
  async receivePurchaseOrderLine(
    @Param('lineId') lineId: string,
    @Body() body: ReceivePurchaseOrderLineDTO,
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    const userId = req.user?.userId ?? req.user?.sub ?? '';
    return await this.receivePurchaseOrderLineHandler.execute({
      lineId,
      quantity: body.quantity,
      lotNumber: body.lotNumber ?? null,
      manufacturedDate: body.manufacturedDate ?? null,
      expiryDate: body.expiryDate ?? null,
      notes: body.notes ?? null,
      userId,
    });
  }

  @Get('warehouses')
  @RequirePermission('api.inventory', 'view')
  async listWarehouses(
    @Query('q') q?: string,
    @Query('status') status?: 'active' | 'all',
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return await this.listWarehousesHandler.execute({
      q: q?.trim() || undefined,
      status,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Post('warehouses')
  @RequirePermission('api.inventory', 'manage')
  async createWarehouse(@Body() body: CreateInventoryWarehouseDTO) {
    return await this.createWarehouseHandler.execute({
      code: body.code,
      nameEn: body.nameEn,
      nameAr: body.nameAr ?? null,
      address: body.address ?? null,
      branchId: body.branchId ?? null,
      isDefault: body.isDefault,
    });
  }

  @Get('warehouses/stock')
  @RequirePermission('api.inventory', 'view')
  async listWarehouseStock(
    @Query('warehouseId') warehouseId?: string,
    @Query('itemId') itemId?: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return await this.listWarehouseStockHandler.execute({
      warehouseId: warehouseId?.trim() || undefined,
      itemId: itemId?.trim() || undefined,
      q: q?.trim() || undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('warehouses/:warehouseId')
  @RequirePermission('api.inventory', 'view')
  async getWarehouse(@Param('warehouseId') warehouseId: string) {
    return await this.getWarehouseHandler.execute(warehouseId);
  }

  @Patch('warehouses/:warehouseId')
  @RequirePermission('api.inventory', 'manage')
  async updateWarehouse(@Param('warehouseId') warehouseId: string, @Body() body: UpdateInventoryWarehouseDTO) {
    return await this.updateWarehouseHandler.execute({
      warehouseId,
      code: body.code,
      nameEn: body.nameEn,
      nameAr: body.nameAr,
      address: body.address,
      branchId: body.branchId,
    });
  }

  @Post('warehouses/:warehouseId/deactivate')
  @RequirePermission('api.inventory', 'manage')
  async deactivateWarehouse(@Param('warehouseId') warehouseId: string) {
    return await this.deactivateWarehouseHandler.execute(warehouseId);
  }

  @Post('warehouses/:warehouseId/reactivate')
  @RequirePermission('api.inventory', 'manage')
  async reactivateWarehouse(@Param('warehouseId') warehouseId: string) {
    return await this.reactivateWarehouseHandler.execute(warehouseId);
  }

  @Post('warehouses/:warehouseId/set-default')
  @RequirePermission('api.inventory', 'manage')
  async setDefaultWarehouse(@Param('warehouseId') warehouseId: string) {
    return await this.setDefaultWarehouseHandler.execute(warehouseId);
  }

  @Get('stock-transfers')
  @RequirePermission('api.inventory', 'view')
  async listStockTransfers(
    @Query('status') status?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return await this.listStockTransfersHandler.execute({
      status: status?.trim() || undefined,
      warehouseId: warehouseId?.trim() || undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Post('stock-transfers')
  @RequirePermission('api.inventory', 'create')
  async createStockTransfer(
    @Body() body: CreateStockTransferDTO,
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    const userId = req.user?.userId ?? req.user?.sub ?? '';
    return await this.createStockTransferHandler.execute({
      fromWarehouseId: body.fromWarehouseId,
      toWarehouseId: body.toWarehouseId,
      notes: body.notes ?? null,
      requestedBy: userId,
      lines: body.lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity })),
    });
  }

  @Get('stock-transfers/:transferId')
  @RequirePermission('api.inventory', 'view')
  async getStockTransfer(@Param('transferId') transferId: string) {
    return await this.getStockTransferHandler.execute(transferId);
  }

  @Post('stock-transfers/:transferId/ship')
  @RequirePermission('api.inventory', 'update')
  async shipStockTransfer(
    @Param('transferId') transferId: string,
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    const userId = req.user?.userId ?? req.user?.sub ?? '';
    return await this.shipStockTransferHandler.execute(transferId, userId);
  }

  @Post('stock-transfers/:transferId/cancel')
  @RequirePermission('api.inventory', 'update')
  async cancelStockTransfer(@Param('transferId') transferId: string) {
    return await this.cancelStockTransferHandler.execute(transferId);
  }

  @Post('stock-transfers/lines/:lineId/receive')
  @RequirePermission('api.inventory', 'update')
  async receiveStockTransferLine(
    @Param('lineId') lineId: string,
    @Body() body: ReceiveStockTransferLineDTO,
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    const userId = req.user?.userId ?? req.user?.sub ?? '';
    return await this.receiveStockTransferLineHandler.execute({
      lineId,
      quantity: body.quantity,
      userId,
    });
  }

  @Get('item/:itemId/warehouse-stock')
  @RequirePermission('api.inventory', 'view')
  async itemWarehouseStock(@Param('itemId') itemId: string) {
    return await this.listItemWarehouseStockHandler.execute(itemId);
  }

  @Get('stock-counts')
  @RequirePermission('api.inventory', 'view')
  async listStockCounts(
    @Query('status') status?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return await this.listStockCountsHandler.execute({
      status: status?.trim() || undefined,
      warehouseId: warehouseId?.trim() || undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Post('stock-counts')
  @RequirePermission('api.inventory', 'create')
  async createStockCount(
    @Body() body: CreateStockCountDTO,
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    const userId = req.user?.userId ?? req.user?.sub ?? '';
    return await this.createStockCountHandler.execute({
      warehouseId: body.warehouseId,
      notes: body.notes ?? null,
      requestedBy: userId,
      itemIds: body.itemIds,
    });
  }

  @Get('stock-counts/:countId')
  @RequirePermission('api.inventory', 'view')
  async getStockCount(@Param('countId') countId: string) {
    return await this.getStockCountHandler.execute(countId);
  }

  @Post('stock-counts/:countId/start')
  @RequirePermission('api.inventory', 'update')
  async startStockCount(@Param('countId') countId: string) {
    return await this.startStockCountHandler.execute(countId);
  }

  @Post('stock-counts/:countId/submit')
  @RequirePermission('api.inventory', 'update')
  async submitStockCount(@Param('countId') countId: string) {
    return await this.submitStockCountHandler.execute(countId);
  }

  @Post('stock-counts/:countId/approve')
  @RequirePermission('api.inventory', 'approve')
  async approveStockCount(
    @Param('countId') countId: string,
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    const userId = req.user?.userId ?? req.user?.sub ?? '';
    return await this.approveStockCountHandler.execute(countId, userId);
  }

  @Post('stock-counts/:countId/cancel')
  @RequirePermission('api.inventory', 'update')
  async cancelStockCount(@Param('countId') countId: string) {
    return await this.cancelStockCountHandler.execute(countId);
  }

  @Post('stock-counts/lines/:lineId/count')
  @RequirePermission('api.inventory', 'update')
  async updateStockCountLine(@Param('lineId') lineId: string, @Body() body: UpdateStockCountLineDTO) {
    return await this.updateStockCountLineHandler.execute(lineId, body.countedQuantity);
  }

  @Get('stock-requests')
  @RequirePermission('api.inventory', 'view')
  async listStockRequests(
    @Query('status') status?: string,
    @Query('requestType') requestType?: string,
    @Query('requestedBy') requestedBy?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return await this.listStockRequestsHandler.execute({
      status: status?.trim() || undefined,
      requestType: requestType?.trim() || undefined,
      requestedBy: requestedBy?.trim() || undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Post('stock-requests')
  @RequirePermission('api.inventory', 'update')
  async createStockRequest(
    @Body() body: CreateStockRequestDTO,
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    const userId = req.user?.userId ?? req.user?.sub ?? '';
    return await this.createStockRequestHandler.execute({
      requestType: body.requestType,
      departmentName: body.departmentName ?? null,
      patientId: body.patientId ?? null,
      warehouseId: body.warehouseId ?? null,
      notes: body.notes ?? null,
      requestedBy: userId,
      lines: body.lines.map((l) => ({
        itemId: l.itemId,
        quantity: l.quantity,
        notes: l.notes ?? null,
      })),
    });
  }

  @Get('stock-requests/:requestId')
  @RequirePermission('api.inventory', 'view')
  async getStockRequest(@Param('requestId') requestId: string) {
    return await this.getStockRequestHandler.execute(requestId);
  }

  @Post('stock-requests/:requestId/submit')
  @RequirePermission('api.inventory', 'update')
  async submitStockRequest(@Param('requestId') requestId: string) {
    return await this.submitStockRequestHandler.execute(requestId);
  }

  @Post('stock-requests/:requestId/approve')
  @RequirePermission('api.inventory', 'approve')
  async approveStockRequest(
    @Param('requestId') requestId: string,
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    const userId = req.user?.userId ?? req.user?.sub ?? '';
    return await this.approveStockRequestHandler.execute(requestId, userId);
  }

  @Post('stock-requests/:requestId/reject')
  @RequirePermission('api.inventory', 'approve')
  async rejectStockRequest(
    @Param('requestId') requestId: string,
    @Body() body: RejectStockRequestDTO,
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    const userId = req.user?.userId ?? req.user?.sub ?? '';
    return await this.rejectStockRequestHandler.execute(requestId, userId, body.reason ?? null);
  }

  @Post('stock-requests/:requestId/cancel')
  @RequirePermission('api.inventory', 'update')
  async cancelStockRequest(@Param('requestId') requestId: string) {
    return await this.cancelStockRequestHandler.execute(requestId);
  }

  @Post('stock-requests/lines/:lineId/fulfill')
  @RequirePermission('api.inventory', 'update')
  async fulfillStockRequestLine(
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() body: FulfillStockRequestLineDTO,
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    const userId = req.user?.userId ?? req.user?.sub ?? '';
    return await this.fulfillStockRequestLineHandler.execute({
      lineId,
      quantity: body.quantity,
      fulfilledBy: userId,
      usedByUserId: body.usedByUserId,
      notes: body.notes ?? null,
    });
  }

  @Post('stock-requests/:requestId/convert-to-po')
  @RequirePermission('api.inventory', 'create')
  async convertStockRequestToPo(
    @Param('requestId') requestId: string,
    @Body() body: { supplierId?: string | null; autoSubmit?: boolean },
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    const userId = req.user?.userId ?? req.user?.sub ?? '';
    return await this.convertStockRequestToPoHandler.execute({
      requestId,
      requestedBy: userId,
      supplierId: body.supplierId ?? null,
      autoSubmit: body.autoSubmit ?? false,
    });
  }

  @Get('summary')
  @RequirePermission('api.inventory', 'view')
  async summary() {
    return await this.summaryHandler.execute();
  }

  @Get('analytics')
  @RequirePermission('api.inventory', 'view')
  async analytics(@Query('days') days?: string) {
    return await this.analyticsHandler.execute(days ? Number(days) : undefined);
  }

  @Get('analytics/export')
  @RequirePermission('api.inventory', 'export')
  async exportAnalytics(
    @Res({ passthrough: false }) res: Response,
    @Query('days') days?: string,
  ) {
    const csv = await this.exportAnalyticsHandler.execute(days ? Number(days) : undefined);
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="inventory-analytics-${stamp}.csv"`);
    res.send(`\uFEFF${csv}`);
  }

  @Get('reorder/preview')
  @RequirePermission('api.inventory', 'view')
  async reorderPreview() {
    return await this.autoReorderHandler.preview();
  }

  @Post('reorder/run')
  @RequirePermission('api.inventory', 'create')
  async runReorder(
    @Body() body: { dryRun?: boolean; autoSubmit?: boolean },
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    const userId = req.user?.userId ?? req.user?.sub ?? '';
    return await this.autoReorderHandler.execute({
      requestedBy: userId,
      dryRun: body.dryRun ?? false,
      autoSubmit: body.autoSubmit ?? false,
    });
  }

  @Get('expiry/summary')
  @RequirePermission('api.inventory', 'view')
  async expirySummary() {
    return await this.expirySummaryHandler.execute();
  }

  @Get('batches')
  @RequirePermission('api.inventory', 'view')
  async listBatches(
    @Query('itemId') itemId?: string,
    @Query('expiry') expiry?: 'all' | 'expiring' | 'expired' | 'none',
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return await this.listBatchesHandler.execute({
      itemId: itemId?.trim() || undefined,
      expiry,
      status,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Post('batch/:batchId/dispose')
  @RequirePermission('api.inventory', 'update')
  async disposeBatch(
    @Param('batchId', ParseUUIDPipe) batchId: string,
    @Body() body: DisposeInventoryBatchDTO,
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    const userId = req.user?.userId ?? req.user?.sub ?? '';
    return await this.disposeBatchHandler.execute({
      batchId,
      quantity: body.quantity,
      reason: body.reason,
      notes: body.notes ?? null,
      disposedBy: userId,
      usedByUserId: body.usedByUserId,
    });
  }

  @Get('item/:itemId/batches')
  @RequirePermission('api.inventory', 'view')
  async itemBatches(@Param('itemId') itemId: string) {
    return await this.itemBatchesHandler.execute(itemId);
  }

  @Post('item')
  @RequirePermission('api.inventory', 'create')
  async createItem(
    @Body() body: CreateInventoryItemDTO,
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    const userId = req.user?.userId ?? req.user?.sub ?? '';
    return await this.createItemHandler.execute({
      branchId: body.branchId ?? null,
      categoryId: body.categoryId ?? null,
      sku: body.sku,
      barcode: body.barcode ?? null,
      brand: body.brand ?? null,
      nameEn: body.nameEn,
      nameAr: body.nameAr ?? null,
      unit: body.unit,
      quantityOnHand: body.quantityOnHand,
      reorderThreshold: body.reorderThreshold,
      minQuantity: body.minQuantity ?? null,
      maxQuantity: body.maxQuantity ?? null,
      expiryDate: body.expiryDate ?? null,
      supplierId: body.supplierId ?? null,
      costPerUnit: body.costPerUnit ?? null,
      sellingPrice: body.sellingPrice ?? null,
      storageLocation: body.storageLocation ?? null,
      lotNumber: body.lotNumber ?? null,
      performedBy: userId,
    });
  }

  @Patch('item/:itemId')
  @RequirePermission('api.inventory', 'update')
  async updateItem(@Param('itemId') itemId: string, @Body() body: UpdateInventoryItemDTO) {
    return await this.updateHandler.execute({
      itemId,
      categoryId: body.categoryId,
      barcode: body.barcode,
      brand: body.brand,
      nameEn: body.nameEn,
      nameAr: body.nameAr,
      unit: body.unit,
      reorderThreshold: body.reorderThreshold,
      minQuantity: body.minQuantity,
      maxQuantity: body.maxQuantity,
      costPerUnit: body.costPerUnit,
      sellingPrice: body.sellingPrice,
      storageLocation: body.storageLocation,
      lotNumber: body.lotNumber,
      expiryDate: body.expiryDate,
      supplierId: body.supplierId,
    });
  }

  @Post('item/:itemId/receive')
  @RequirePermission('api.inventory', 'update')
  async receive(
    @Param('itemId') itemId: string,
    @Body() body: ReceiveInventoryDTO,
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    const userId = req.user?.userId ?? req.user?.sub ?? '';
    return await this.receiveHandler.execute({
      itemId,
      quantity: body.quantity,
      notes: body.notes ?? null,
      lotNumber: body.lotNumber ?? null,
      manufacturedDate: body.manufacturedDate ?? null,
      expiryDate: body.expiryDate ?? null,
      userId,
      warehouseId: body.warehouseId ?? null,
    });
  }

  @Post('item/:itemId/archive')
  @RequirePermission('api.inventory', 'delete')
  async archive(@Param('itemId') itemId: string) {
    return await this.archiveHandler.execute({ itemId });
  }

  @Post('item/:itemId/reactivate')
  @RequirePermission('api.inventory', 'update')
  async reactivate(@Param('itemId') itemId: string) {
    return await this.reactivateHandler.execute({ itemId });
  }

  @Post('item/consume')
  @RequirePermission('api.inventory', 'update')
  async consume(
    @Body() body: ConsumeInventoryDTO,
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    const userId = req.user?.userId ?? req.user?.sub ?? '';
    return await this.consumeHandler.execute({
      itemId: body.itemId,
      quantity: body.quantity,
      sourceDocumentId: body.sourceDocumentId ?? null,
      notes: body.notes ?? null,
      consumedBy: userId,
      recordedByUserId: userId,
      usedByUserId: body.usedByUserId ?? null,
      warehouseId: body.warehouseId ?? null,
      usageType: body.usageType,
      patientId: body.patientId ?? null,
      appointmentId: body.appointmentId ?? null,
      clinicalServiceId: body.clinicalServiceId ?? null,
      inventoryBatchId: body.inventoryBatchId ?? null,
      reasonCode: body.reasonCode ?? null,
      procedureCode: body.procedureCode ?? null,
    });
  }

  @Post('item/:itemId/adjust')
  @RequirePermission('api.inventory', 'update')
  async adjust(
    @Param('itemId') itemId: string,
    @Body() body: AdjustInventoryDTO,
    @Req() req: { user?: { userId?: string; sub?: string } },
  ) {
    const userId = req.user?.userId ?? req.user?.sub ?? '';
    return await this.adjustHandler.execute({
      itemId,
      quantityAfter: body.quantityAfter,
      reason: body.reason,
      notes: body.notes ?? null,
      performedBy: userId,
    });
  }

  @Get('movements')
  @RequirePermission('api.inventory', 'view')
  async listMovements(
    @Query('itemId') itemId?: string,
    @Query('encounterId') encounterId?: string,
    @Query('movementType') movementType?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return await this.listMovementsHandler.execute({
      itemId: itemId?.trim() || undefined,
      encounterId: encounterId?.trim() || undefined,
      movementType: movementType?.trim() || undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('consumptions')
  @RequirePermission('api.inventory', 'view')
  async listConsumptions(
    @Query('itemId') itemId?: string,
    @Query('encounterId') encounterId?: string,
    @Query('patientId') patientId?: string,
    @Query('procedureCode') procedureCode?: string,
    @Query('invoiceId') invoiceId?: string,
    @Query('unbilled') unbilled?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return await this.listConsumptionsHandler.execute({
      itemId: itemId?.trim() || undefined,
      encounterId: encounterId?.trim() || undefined,
      patientId: patientId?.trim() || undefined,
      procedureCode: procedureCode?.trim() || undefined,
      invoiceId: invoiceId?.trim() || undefined,
      unbilled: unbilled === 'true' || unbilled === '1',
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('lookup')
  @RequirePermission('api.inventory', 'view')
  async lookupItem(@Query('code') code?: string) {
    return await this.lookupHandler.execute({ code: code ?? '' });
  }

  @Get('item/:itemId')
  @RequirePermission('api.inventory', 'view')
  async getItem(@Param('itemId') itemId: string) {
    const result = await this.getHandler.execute({ itemId });
    return result?.toJSON?.() ?? result;
  }

  @Get('items/export')
  @RequirePermission('api.inventory', 'export')
  async exportItems(
    @Res({ passthrough: false }) res: Response,
    @Query('ids') ids?: string,
    @Query('branchId') branchId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('q') q?: string,
    @Query('status') status?: 'active' | 'archived' | 'all',
    @Query('stock') stock?: 'all' | 'low' | 'out' | 'expiring' | 'expired',
  ) {
    const itemIds = ids
      ?.split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const normalizedBranchId = branchId?.trim() ?? '';
    const normalizedCategoryId = categoryId?.trim() ?? '';
    const csv = await this.exportItemsHandler.execute({
      itemIds,
      branchId: normalizedBranchId.length ? normalizedBranchId : null,
      categoryId: normalizedCategoryId.length ? normalizedCategoryId : null,
      q: q?.trim() || undefined,
      status,
      stock,
    });
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="inventory-export-${stamp}.csv"`);
    res.send(`\uFEFF${csv}`);
  }

  @Post('items/bulk-archive')
  @RequirePermission('api.inventory', 'delete')
  async bulkArchiveItems(@Body() body: BulkArchiveInventoryItemsDTO) {
    return await this.bulkArchiveHandler.execute({ itemIds: body.itemIds });
  }

  @Get('items')
  @RequirePermission('api.inventory', 'view')
  async listItems(
    @Query('branchId') branchId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('q') q?: string,
    @Query('status') status?: 'active' | 'archived' | 'all',
    @Query('stock') stock?: 'all' | 'low' | 'out' | 'expiring' | 'expired',
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const normalizedBranchId = branchId?.trim() ?? '';
    const normalizedCategoryId = categoryId?.trim() ?? '';
    return await this.listHandler.execute({
      branchId: normalizedBranchId.length ? normalizedBranchId : null,
      categoryId: normalizedCategoryId.length ? normalizedCategoryId : null,
      q: q?.trim() || undefined,
      status,
      stock,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }
}
