import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import {
  PURCHASE_ORDER_REPOSITORY,
} from '../../../../infrastructure/provider.tokens';
import { PurchaseOrderRepository } from '../../domain/repositories/purchase-order.repository.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { InventoryReorderService, type ReorderCandidate } from '../../domain/services/inventory-reorder.service';

const OPEN_PO_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_RECEIVED'] as const;

@Injectable()
export class AutoReorderInventoryHandler {
  constructor(
    @Inject(PURCHASE_ORDER_REPOSITORY) private readonly poRepo: PurchaseOrderRepository,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly reorderService: InventoryReorderService,
  ) {}

  async preview() {
    const candidates = await this.collectCandidates();
    const grouped = this.groupBySupplier(candidates);
    return {
      candidateCount: candidates.length,
      purchaseOrderCount: grouped.length,
      groups: grouped,
    };
  }

  async execute(command: { requestedBy: string; dryRun?: boolean; autoSubmit?: boolean }) {
    if (!command.requestedBy?.trim()) throw new BadRequestException('User context is required');

    const candidates = await this.collectCandidates();
    if (candidates.length === 0) {
      return { created: [], skipped: [], candidateCount: 0 };
    }

    if (command.dryRun) {
      return {
        dryRun: true,
        candidateCount: candidates.length,
        groups: this.groupBySupplier(candidates),
        created: [],
        skipped: [],
      };
    }

    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const created: Array<{ orderId: string; poNumber: string; supplierId: string | null; lineCount: number }> = [];
    const skipped: Array<{ itemId: string; reason: string }> = [];

    for (const group of this.groupBySupplier(candidates)) {
      if (group.lines.length === 0) continue;
      const result = await this.poRepo.create({
        tenantId,
        supplierId: group.supplierId,
        notes: 'Auto-generated from low-stock reorder scan',
        requestedBy: command.requestedBy,
        lines: group.lines.map((line) => ({
          itemId: line.itemId,
          quantity: line.orderQuantity,
          unitCost: line.unitCost,
        })),
      });
      if (command.autoSubmit) {
        await this.poRepo.submit(tenantId, result.orderId);
      }
      created.push({
        orderId: result.orderId,
        poNumber: result.poNumber,
        supplierId: group.supplierId,
        lineCount: group.lines.length,
      });
    }

    return { created, skipped, candidateCount: candidates.length };
  }

  private async collectCandidates(): Promise<ReorderCandidate[]> {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');

    const items = await this.prisma.inventoryItem.findMany({
      where: { tenantId, deletedAt: null },
      select: {
        id: true,
        sku: true,
        nameEn: true,
        supplierId: true,
        quantityOnHand: true,
        reorderThreshold: true,
        minQuantity: true,
        maxQuantity: true,
        costPerUnit: true,
      },
    });

    const openLineQty = await this.openPoQuantitiesByItem(tenantId);
    const candidates: ReorderCandidate[] = [];

    for (const item of items) {
      const qty = item.quantityOnHand.toNumber();
      const threshold = item.reorderThreshold.toNumber();
      if (qty > threshold) continue;

      const pending = openLineQty.get(item.id) ?? 0;
      const orderQuantity = this.reorderService.computeOrderQuantity({
        quantityOnHand: qty,
        reorderThreshold: threshold,
        minQuantity: item.minQuantity?.toNumber() ?? null,
        maxQuantity: item.maxQuantity?.toNumber() ?? null,
      });
      const netOrder = Math.max(0, orderQuantity - pending);
      if (netOrder <= 0) continue;

      candidates.push({
        itemId: item.id,
        sku: item.sku,
        nameEn: item.nameEn,
        supplierId: item.supplierId,
        quantityOnHand: qty,
        reorderThreshold: threshold,
        orderQuantity: netOrder,
        unitCost: item.costPerUnit?.toNumber() ?? null,
      });
    }

    return candidates;
  }

  private async openPoQuantitiesByItem(tenantId: string): Promise<Map<string, number>> {
    const lines = await this.prisma.purchaseOrderLine.findMany({
      where: {
        tenantId,
        purchaseOrder: { status: { in: [...OPEN_PO_STATUSES] } },
      },
      select: {
        inventoryItemId: true,
        quantityOrdered: true,
        quantityReceived: true,
      },
    });

    const map = new Map<string, number>();
    for (const line of lines) {
      const remaining = line.quantityOrdered.toNumber() - line.quantityReceived.toNumber();
      if (remaining <= 0) continue;
      map.set(line.inventoryItemId, (map.get(line.inventoryItemId) ?? 0) + remaining);
    }
    return map;
  }

  private groupBySupplier(candidates: ReorderCandidate[]) {
    const groups = new Map<string | null, ReorderCandidate[]>();
    for (const candidate of candidates) {
      const key = candidate.supplierId;
      const list = groups.get(key) ?? [];
      list.push(candidate);
      groups.set(key, list);
    }
    return Array.from(groups.entries()).map(([supplierId, lines]) => ({
      supplierId,
      lines,
    }));
  }
}
