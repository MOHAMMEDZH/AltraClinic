import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import {
  PURCHASE_ORDER_REPOSITORY,
  STOCK_REQUEST_REPOSITORY,
} from '../../../../infrastructure/provider.tokens';
import { PurchaseOrderRepository } from '../../domain/repositories/purchase-order.repository.interface';
import { StockRequestRepository } from '../../domain/repositories/stock-request.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { mapPurchaseOrder } from '../utils/map-purchase-order-response';

@Injectable()
export class ConvertStockRequestToPoHandler {
  constructor(
    @Inject(STOCK_REQUEST_REPOSITORY) private readonly requestRepo: StockRequestRepository,
    @Inject(PURCHASE_ORDER_REPOSITORY) private readonly poRepo: PurchaseOrderRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(command: { requestId: string; requestedBy: string; supplierId?: string | null; autoSubmit?: boolean }) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!command.requestedBy?.trim()) throw new BadRequestException('User context is required');

    const request = await this.requestRepo.findById(tenantId, command.requestId);
    if (!request) throw new NotFoundException('Stock request not found');
    if (request.status !== 'APPROVED' && request.status !== 'FULFILLED') {
      throw new BadRequestException('Only approved or partially fulfilled requests can be converted to a purchase order');
    }

    const lines = request.lines
      .map((line) => ({
        itemId: line.itemId,
        quantity: line.quantityRequested - line.quantityFulfilled,
      }))
      .filter((line) => line.quantity > 0);

    if (lines.length === 0) {
      throw new BadRequestException('No remaining quantities to order');
    }

    const created = await this.poRepo.create({
      tenantId,
      supplierId: command.supplierId ?? null,
      notes: `Converted from stock request ${request.requestNumber}`,
      requestedBy: command.requestedBy,
      lines,
    });

    if (command.autoSubmit) {
      await this.poRepo.submit(tenantId, created.orderId);
    }

    const order = await this.poRepo.findById(tenantId, created.orderId);
    if (!order) throw new NotFoundException('Purchase order not found after creation');

    return {
      orderId: created.orderId,
      poNumber: created.poNumber,
      requestId: request.requestId,
      order: mapPurchaseOrder(order),
    };
  }
}
