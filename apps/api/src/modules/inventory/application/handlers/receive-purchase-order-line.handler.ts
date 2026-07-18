import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PURCHASE_ORDER_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { PurchaseOrderRepository } from '../../domain/repositories/purchase-order.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { ReceiveInventoryHandler } from './receive-inventory.handler';
import { mapPurchaseOrder } from '../utils/map-purchase-order-response';

@Injectable()
export class ReceivePurchaseOrderLineHandler {
  constructor(
    @Inject(PURCHASE_ORDER_REPOSITORY) private readonly repo: PurchaseOrderRepository,
    private readonly receiveHandler: ReceiveInventoryHandler,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(command: {
    lineId: string;
    quantity: number;
    userId: string;
    lotNumber?: string | null;
    manufacturedDate?: string | null;
    expiryDate?: string | null;
    notes?: string | null;
  }) {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!command.userId?.trim()) throw new BadRequestException('User context is required');

    const line = await this.repo.findLineById(tenantId, command.lineId);
    if (!line) throw new NotFoundException('Purchase order line not found');

    if (!['APPROVED', 'PARTIALLY_RECEIVED'].includes(line.status)) {
      throw new BadRequestException('Goods can only be received against approved orders');
    }

    const remaining = line.quantityOrdered - line.quantityReceived;
    if (command.quantity <= 0 || command.quantity > remaining) {
      throw new BadRequestException('Invalid receive quantity for this line');
    }

    const notes = [
      `PO ${line.poNumber} receipt`,
      command.notes?.trim() || null,
    ]
      .filter(Boolean)
      .join(' — ');

    await this.receiveHandler.execute({
      itemId: line.itemId,
      quantity: command.quantity,
      notes,
      userId: command.userId,
      lotNumber: command.lotNumber ?? null,
      manufacturedDate: command.manufacturedDate ?? null,
      expiryDate: command.expiryDate ?? null,
    });

    await this.repo.incrementLineReceived(tenantId, command.lineId, command.quantity);
    await this.repo.recomputeOrderStatus(tenantId, line.purchaseOrderId);

    const order = await this.repo.findById(tenantId, line.purchaseOrderId);
    if (!order) throw new NotFoundException('Purchase order not found');
    return mapPurchaseOrder(order);
  }
}
