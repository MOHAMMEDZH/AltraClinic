import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import {
  INVENTORY_ITEM_REPOSITORY,
  INVENTORY_SUPPLIER_REPOSITORY,
  PURCHASE_ORDER_REPOSITORY,
} from '../../../../infrastructure/provider.tokens';
import { InventoryItemRepository } from '../../domain/repositories/inventory-item.repository.interface';
import { InventorySupplierRepository } from '../../domain/repositories/inventory-supplier.repository.interface';
import { PurchaseOrderRepository } from '../../domain/repositories/purchase-order.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import type { PurchaseOrderStatus } from '../../domain/repositories/purchase-order.types';

import { mapPurchaseOrder } from '../utils/map-purchase-order-response';

@Injectable()
export class ListPurchaseOrdersHandler {
  constructor(
    @Inject(PURCHASE_ORDER_REPOSITORY) private readonly repo: PurchaseOrderRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(query: {
    status?: string;
    supplierId?: string;
    limit?: number;
    offset?: number;
  }) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const offset = Math.max(query.offset ?? 0, 0);

    const result = await this.repo.list({
      tenantId,
      status: query.status as PurchaseOrderStatus | 'OPEN' | undefined,
      supplierId: query.supplierId,
      limit,
      offset,
    });

    return {
      orders: result.orders.map(mapPurchaseOrder),
      total: result.total,
      limit,
      offset,
    };
  }
}

@Injectable()
export class GetPurchaseOrderHandler {
  constructor(
    @Inject(PURCHASE_ORDER_REPOSITORY) private readonly repo: PurchaseOrderRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(orderId: string) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const order = await this.repo.findById(tenantId, orderId);
    if (!order) throw new NotFoundException('Purchase order not found');
    return mapPurchaseOrder(order);
  }
}

@Injectable()
export class CreatePurchaseOrderHandler {
  constructor(
    @Inject(PURCHASE_ORDER_REPOSITORY) private readonly repo: PurchaseOrderRepository,
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly itemRepo: InventoryItemRepository,
    @Inject(INVENTORY_SUPPLIER_REPOSITORY) private readonly supplierRepo: InventorySupplierRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(command: {
    supplierId?: string | null;
    notes?: string | null;
    lines: Array<{ itemId: string; quantity: number; unitCost?: number | null }>;
    requestedBy: string;
  }) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!command.requestedBy?.trim()) throw new BadRequestException('User context is required');
    if (!command.lines?.length) throw new BadRequestException('At least one line is required');

    if (command.supplierId?.trim()) {
      const ok = await this.supplierRepo.existsActive(tenantId, command.supplierId.trim());
      if (!ok) throw new BadRequestException('Supplier not found or inactive');
    }

    for (const line of command.lines) {
      const item = await this.itemRepo.findById(tenantId, line.itemId);
      if (!item) throw new BadRequestException(`Inventory item not found: ${line.itemId}`);
      if (line.quantity <= 0) throw new BadRequestException('Line quantity must be positive');
    }

    return await this.repo.create({
      tenantId,
      supplierId: command.supplierId ?? null,
      notes: command.notes ?? null,
      requestedBy: command.requestedBy,
      lines: command.lines,
    });
  }
}

@Injectable()
export class SubmitPurchaseOrderHandler {
  constructor(
    @Inject(PURCHASE_ORDER_REPOSITORY) private readonly repo: PurchaseOrderRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(orderId: string) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const order = await this.repo.findById(tenantId, orderId);
    if (!order) throw new NotFoundException('Purchase order not found');
    if (order.status !== 'DRAFT') throw new BadRequestException('Only draft orders can be submitted');
    if (order.lines.length === 0) throw new BadRequestException('Order has no lines');

    await this.repo.submit(tenantId, orderId);
    const updated = await this.repo.findById(tenantId, orderId);
    return mapPurchaseOrder(updated!);
  }
}

@Injectable()
export class ApprovePurchaseOrderHandler {
  constructor(
    @Inject(PURCHASE_ORDER_REPOSITORY) private readonly repo: PurchaseOrderRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(orderId: string, approvedBy: string) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!approvedBy?.trim()) throw new BadRequestException('User context is required');

    const order = await this.repo.findById(tenantId, orderId);
    if (!order) throw new NotFoundException('Purchase order not found');
    if (order.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Only pending orders can be approved');
    }

    await this.repo.approve(tenantId, orderId, approvedBy);
    const updated = await this.repo.findById(tenantId, orderId);
    return mapPurchaseOrder(updated!);
  }
}

@Injectable()
export class CancelPurchaseOrderHandler {
  constructor(
    @Inject(PURCHASE_ORDER_REPOSITORY) private readonly repo: PurchaseOrderRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(orderId: string) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const order = await this.repo.findById(tenantId, orderId);
    if (!order) throw new NotFoundException('Purchase order not found');
    if (!['DRAFT', 'PENDING_APPROVAL', 'APPROVED'].includes(order.status)) {
      throw new BadRequestException('Order cannot be cancelled in its current status');
    }

    await this.repo.cancel(tenantId, orderId);
    const updated = await this.repo.findById(tenantId, orderId);
    return mapPurchaseOrder(updated!);
  }
}
