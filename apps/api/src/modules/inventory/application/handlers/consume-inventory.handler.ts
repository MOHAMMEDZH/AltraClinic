import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConsumeInventoryCommand } from '../commands/consume-inventory.command';
import { InventoryItemRepository } from '../../domain/repositories/inventory-item.repository.interface';
import { InventoryWarehouseRepository } from '../../domain/repositories/inventory-warehouse.repository.interface';
import { INVENTORY_ITEM_REPOSITORY, INVENTORY_WAREHOUSE_REPOSITORY, EVENT_PUBLISHER } from '../../../../infrastructure/provider.tokens';
import { InventoryConsumedEvent } from '../../domain/events/inventory-consumed.event';
import { EventPublisherInterface } from '../../../../infrastructure/event-publisher.interface';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { TenantContextContract } from '../../../../contracts/tenant-context.contract';
import { ACCOUNTABLE_REQUIRED, InventoryUsagePostingService } from '../services/inventory-usage-posting.service';

@Injectable()
export class ConsumeInventoryHandler {
  constructor(
    @Inject(INVENTORY_ITEM_REPOSITORY) private readonly repo: InventoryItemRepository,
    @Inject(INVENTORY_WAREHOUSE_REPOSITORY) private readonly warehouseRepo: InventoryWarehouseRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisherInterface,
    private readonly usagePosting: InventoryUsagePostingService,
  ) {}

  async execute(
    command: ConsumeInventoryCommand & {
      consumedBy: string;
      /** Clinical performer (INV-B01). Required for CLINICAL_CONSUMPTION. */
      usedByUserId?: string | null;
      /** Authenticated actor who records the event. Defaults to consumedBy. */
      recordedByUserId?: string | null;
      notes?: string | null;
      warehouseId?: string | null;
      patientId?: string | null;
      procedureCode?: string | null;
      reason?: string | null;
      reasonCode?: string | null;
      branchId?: string | null;
      encounterId?: string | null;
      inventoryBatchId?: string | null;
      appointmentId?: string | null;
      clinicalServiceId?: string | null;
      beautyAnnotationId?: string | null;
      usageType?:
        | 'CLINICAL_CONSUMPTION'
        | 'OPERATIONAL_CONSUMPTION'
        | 'WASTAGE'
        | 'DAMAGE'
        | 'EXPIRED'
        | 'SAMPLE_OR_PROMOTIONAL'
        | 'CORRECTION'
        | 'REVERSAL';
      injectable?: {
        dose?: number | null;
        anatomicalSite?: string | null;
        beautyAnnotationId?: string | null;
        notes?: string | null;
      } | null;
      hasInjectableCreatePermission?: boolean;
    },
  ): Promise<{ itemId: string; quantity: number; usageLedgerIds: string[] }> {
    const tenantCtx = (await this.tenantContext.resolve()) as TenantContextContract;
    const tenantId = tenantCtx?.tenantId;
    if (!tenantId) throw new BadRequestException('tenant context could not be resolved');
    if (!command.consumedBy?.trim()) throw new BadRequestException('User context is required');

    const item = await this.repo.findById(tenantId, command.itemId);
    if (!item) throw new NotFoundException('Inventory item not found');

    const warehouseId =
      command.warehouseId?.trim() || (await this.warehouseRepo.ensureDefaultWarehouseId(tenantId));
    const warehouseOk = await this.warehouseRepo.existsActive(tenantId, warehouseId);
    if (!warehouseOk) throw new BadRequestException('Warehouse not found or inactive');

    const usageType = command.usageType ?? 'CLINICAL_CONSUMPTION';
    const approved = new Set([
      'CLINICAL_CONSUMPTION',
      'OPERATIONAL_CONSUMPTION',
      'WASTAGE',
      'DAMAGE',
      'EXPIRED',
      'SAMPLE_OR_PROMOTIONAL',
      'CORRECTION',
    ]);
    if (!approved.has(usageType)) {
      throw new BadRequestException(`usageType ${usageType} is not allowed`);
    }
    // Recorder may default to the authenticated actor; accountable usedBy must NEVER.
    const recordedByUserId = (command.recordedByUserId ?? command.consumedBy).trim();
    const usedByUserId = command.usedByUserId?.trim() || null;
    if (ACCOUNTABLE_REQUIRED.has(usageType) && !usedByUserId) {
      throw new BadRequestException(
        `usedByUserId is required for ${usageType} (recorder must not be inferred as accountable user)`,
      );
    }

    const posted = await this.usagePosting.postUsage({
      tenantId,
      inventoryItemId: command.itemId,
      quantity: command.quantity,
      usageType,
      recordedByUserId,
      usedByUserId,
      warehouseId,
      branchId: command.branchId ?? tenantCtx.branchId ?? null,
      inventoryBatchId: command.inventoryBatchId ?? null,
      patientId: command.patientId ?? null,
      encounterId: command.encounterId ?? command.sourceDocumentId ?? null,
      appointmentId: command.appointmentId ?? null,
      clinicalServiceId: command.clinicalServiceId ?? null,
      beautyAnnotationId: command.beautyAnnotationId ?? null,
      procedureCode: command.procedureCode ?? null,
      reasonCode: command.reasonCode ?? command.reason ?? null,
      notes: command.notes ?? null,
      unit: item.unit,
      injectable: command.injectable ?? null,
      hasInjectableCreatePermission: command.hasInjectableCreatePermission === true,
    });

    await this.eventPublisher.publish(
      new InventoryConsumedEvent(
        tenantId,
        item.itemId,
        command.quantity,
        item.unit,
        command.sourceDocumentId ?? null,
      ),
    );

    return {
      itemId: item.itemId,
      quantity: command.quantity,
      usageLedgerIds: posted.lines.map((l) => l.usageLedgerId),
    };
  }
}
