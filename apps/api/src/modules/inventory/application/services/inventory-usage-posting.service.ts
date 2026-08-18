import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import {
  INVENTORY_AUDIT_LOG,
  InventoryAuditLog,
} from '../../ports/inventory-audit-log.port';

export type InventoryUsageType =
  | 'CLINICAL_CONSUMPTION'
  | 'OPERATIONAL_CONSUMPTION'
  | 'WASTAGE'
  | 'DAMAGE'
  | 'EXPIRED'
  | 'SAMPLE_OR_PROMOTIONAL'
  | 'CORRECTION'
  | 'REVERSAL';

/** Approved domain values. Unknown strings must never reach posting. */
export const APPROVED_USAGE_TYPES = new Set<InventoryUsageType>([
  'CLINICAL_CONSUMPTION',
  'OPERATIONAL_CONSUMPTION',
  'WASTAGE',
  'DAMAGE',
  'EXPIRED',
  'SAMPLE_OR_PROMOTIONAL',
  'CORRECTION',
  'REVERSAL',
]);

/** Client/API may not invent REVERSAL rows; reverseUsage owns that. */
const CLIENT_POSTABLE_USAGE_TYPES = new Set<InventoryUsageType>([
  'CLINICAL_CONSUMPTION',
  'OPERATIONAL_CONSUMPTION',
  'WASTAGE',
  'DAMAGE',
  'EXPIRED',
  'SAMPLE_OR_PROMOTIONAL',
  'CORRECTION',
]);

const REASON_REQUIRED = new Set<InventoryUsageType>(['WASTAGE', 'DAMAGE', 'EXPIRED']);
/**
 * P0-10 / INV-B01: every human-driven stock-affecting post requires an explicit
 * accountable human (`usedByUserId`). Recorder must never be inferred.
 * Frozen: clinical, operational, wastage, damage, expired, sample, correction.
 * REVERSAL is not client-posted; reverseUsage requires the reversal actor.
 */
export const ACCOUNTABLE_REQUIRED = new Set<InventoryUsageType>([
  'CLINICAL_CONSUMPTION',
  'OPERATIONAL_CONSUMPTION',
  'WASTAGE',
  'DAMAGE',
  'EXPIRED',
  'SAMPLE_OR_PROMOTIONAL',
  'CORRECTION',
]);

export interface PostUsageInput {
  tenantId: string;
  inventoryItemId: string;
  quantity: number;
  usageType: InventoryUsageType;
  recordedByUserId: string;
  usedByUserId?: string | null;
  warehouseId?: string | null;
  branchId?: string | null;
  inventoryBatchId?: string | null;
  patientId?: string | null;
  encounterId?: string | null;
  appointmentId?: string | null;
  clinicalServiceId?: string | null;
  beautyAnnotationId?: string | null;
  procedureCode?: string | null;
  reasonCode?: string | null;
  notes?: string | null;
  unit?: string | null;
  injectable?: {
    dose?: number | null;
    anatomicalSite?: string | null;
    beautyAnnotationId?: string | null;
    notes?: string | null;
  } | null;
  /**
   * Required when `injectable` is present. Must be derived from the authenticated
   * actor's api.clinical-injectable / create grant — never from a client boolean.
   */
  hasInjectableCreatePermission?: boolean;
}

export interface PostedUsageLine {
  usageLedgerId: string;
  stockMovementId: string;
  inventoryBatchId: string | null;
  quantity: number;
}

/**
 * Canonical inventory usage posting (AR-20 / AR-11).
 * Stock movement + usage ledger (+ injectable detail + audit) share one txn.
 */
@Injectable()
export class InventoryUsagePostingService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(INVENTORY_AUDIT_LOG)
    private readonly audit: InventoryAuditLog | null = null,
  ) {}

  async postClinicalUsage(input: PostUsageInput): Promise<{ lines: PostedUsageLine[] }> {
    return this.postUsage({
      ...input,
      usageType: input.usageType ?? 'CLINICAL_CONSUMPTION',
    });
  }

  async postUsage(input: PostUsageInput): Promise<{ lines: PostedUsageLine[] }> {
    this.validateInputs(input);
    return this.prisma.$transaction(
      async (tx) => this.postUsageInTx(tx, input),
      { maxWait: 20_000, timeout: 60_000 },
    );
  }

  async postUsageInTx(
    tx: Prisma.TransactionClient,
    input: PostUsageInput,
  ): Promise<{ lines: PostedUsageLine[] }> {
    this.validateInputs(input);

    const usedByExplicit = input.usedByUserId?.trim() || null;
    if (usedByExplicit) {
      await this.assertTenantUser(tx, input.tenantId, usedByExplicit);
    }
    await this.assertRelatedTenantReferences(tx, input);

    const itemRows = await tx.$queryRaw<
      Array<{
        id: string;
        unit: string;
        quantityOnHand: Prisma.Decimal;
      }>
    >`
      SELECT id, unit, "quantityOnHand"
      FROM inventory_items
      WHERE id = ${input.inventoryItemId}::uuid
        AND "tenantId" = ${input.tenantId}::uuid
        AND "deletedAt" IS NULL
      FOR UPDATE
    `;
    const item = itemRows[0];
    if (!item) throw new NotFoundException('Inventory item not found');

    const warehouseId = await this.resolveWarehouseId(tx, input);

    await tx.$queryRaw`
      SELECT id FROM inventory_warehouse_stock
      WHERE "tenantId" = ${input.tenantId}::uuid
        AND "warehouseId" = ${warehouseId}::uuid
        AND "inventoryItemId" = ${input.inventoryItemId}::uuid
      FOR UPDATE
    `;

    const activeBatches = await tx.$queryRaw<
      Array<{
        id: string;
        quantityOnHand: Prisma.Decimal;
        expiryDate: Date | null;
        recalled: boolean;
        status: string;
        receivedAt: Date;
      }>
    >`
      SELECT id, "quantityOnHand", "expiryDate", recalled, status, "receivedAt"
      FROM inventory_batches
      WHERE "tenantId" = ${input.tenantId}::uuid
        AND "inventoryItemId" = ${input.inventoryItemId}::uuid
        AND status = 'ACTIVE'
        AND "quantityOnHand" > 0
      ORDER BY "expiryDate" ASC NULLS LAST, "receivedAt" ASC
      FOR UPDATE
    `;

    const batchControlled = activeBatches.length > 0 || Boolean(input.inventoryBatchId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allocations = this.planBatchAllocations({
      quantity: input.quantity,
      batchControlled,
      requestedBatchId: input.inventoryBatchId ?? null,
      batches: activeBatches,
      today,
      usageType: input.usageType,
    });

    const doseAllocations = this.allocateInjectableDoses(
      input.injectable?.dose ?? null,
      allocations.map((a) => a.quantity),
    );

    const lines: PostedUsageLine[] = [];
    let remainingQtyBefore = Number(item.quantityOnHand);
    const now = new Date();
    const unit = input.unit ?? item.unit;

    const usedBy = usedByExplicit;
    // New production rows are never LEGACY_UNATTRIBUTED (migration/backfill only).
    // Accountable-required types already rejected missing usedBy; ATTRIBUTED is the only runtime write.
    const attributionStatus = 'ATTRIBUTED';

    for (let i = 0; i < allocations.length; i++) {
      const alloc = allocations[i];
      if (alloc.batchId) {
        const batch = activeBatches.find((b) => b.id === alloc.batchId)!;
        const after = Number(batch.quantityOnHand) - alloc.quantity;
        await tx.inventoryBatch.update({
          where: { id: alloc.batchId },
          data: {
            quantityOnHand: new Prisma.Decimal(after),
            status: after <= 0 ? 'DEPLETED' : 'ACTIVE',
          },
        });
        batch.quantityOnHand = new Prisma.Decimal(after);
      }

      const wh = await this.applyWarehouseDelta(tx, {
        tenantId: input.tenantId,
        warehouseId,
        itemId: input.inventoryItemId,
        delta: -alloc.quantity,
      });

      const qtyBefore = remainingQtyBefore;
      const qtyAfter = qtyBefore - alloc.quantity;
      remainingQtyBefore = qtyAfter;

      await tx.inventoryItem.update({
        where: { id: input.inventoryItemId },
        data: { quantityOnHand: new Prisma.Decimal(qtyAfter) },
      });

      const movementId = randomUUID();
      await tx.inventoryStockMovement.create({
        data: {
          id: movementId,
          tenantId: input.tenantId,
          inventoryItemId: input.inventoryItemId,
          movementType: 'CONSUME',
          quantity: new Prisma.Decimal(alloc.quantity),
          quantityBefore: new Prisma.Decimal(wh.itemQtyBefore ?? qtyBefore),
          quantityAfter: new Prisma.Decimal(wh.itemQtyAfter ?? qtyAfter),
          reason: input.reasonCode ?? input.procedureCode ?? input.usageType,
          notes: input.notes ?? null,
          encounterId: input.encounterId ?? null,
          patientId: input.patientId ?? null,
          procedureCode: input.procedureCode ?? null,
          warehouseId,
          performedBy: input.recordedByUserId,
        },
      });

      const usageId = randomUUID();
      await tx.inventoryUsageLedger.create({
        data: {
          id: usageId,
          tenantId: input.tenantId,
          branchId: input.branchId ?? null,
          warehouseId,
          inventoryItemId: input.inventoryItemId,
          inventoryBatchId: alloc.batchId,
          encounterId: input.encounterId ?? null,
          patientId: input.patientId ?? null,
          procedureCode: input.procedureCode ?? null,
          quantityUsed: new Prisma.Decimal(alloc.quantity),
          unit,
          usageType: input.usageType,
          // Legacy consumedBy column: prefer accountable user when present, else recorder.
          consumedBy: usedBy ?? input.recordedByUserId,
          usedByUserId: usedBy,
          recordedByUserId: input.recordedByUserId,
          appointmentId: input.appointmentId ?? null,
          clinicalServiceId: input.clinicalServiceId ?? null,
          beautyAnnotationId: input.beautyAnnotationId ?? null,
          reasonCode: input.reasonCode ?? null,
          notes: input.notes ?? null,
          consumedAt: now,
          occurredAt: now,
          recordedAt: now,
          sourceStockMovementId: movementId,
          status: 'POSTED',
          attributionStatus,
        },
      });

      if (input.injectable) {
        const lineDose = doseAllocations[i];
        await tx.injectableUsageDetail.create({
          data: {
            usageLedgerId: usageId,
            dose: lineDose != null ? new Prisma.Decimal(lineDose) : null,
            anatomicalSite: input.injectable.anatomicalSite ?? null,
            beautyAnnotationId:
              input.injectable.beautyAnnotationId ?? input.beautyAnnotationId ?? null,
            notes: input.injectable.notes ?? null,
          },
        });
      }

      lines.push({
        usageLedgerId: usageId,
        stockMovementId: movementId,
        inventoryBatchId: alloc.batchId,
        quantity: alloc.quantity,
      });
    }

    if (this.audit) {
      await this.audit.recordInTransaction(tx, {
        tenantId: input.tenantId,
        action: `inventory.usage.${input.usageType.toLowerCase()}`,
        resourceId: lines[0]?.usageLedgerId ?? input.inventoryItemId,
        actorId: input.recordedByUserId,
        actorRoles: [],
        descriptionEn: `Posted inventory usage ${input.usageType}`,
        descriptionAr: `تم تسجيل استخدام المخزون ${input.usageType}`,
        details: {
          usageType: input.usageType,
          inventoryItemId: input.inventoryItemId,
          quantity: input.quantity,
          usedByUserId: usedBy,
          recordedByUserId: input.recordedByUserId,
          reasonCode: input.reasonCode ?? null,
          inventoryBatchId: input.inventoryBatchId ?? null,
          lineCount: lines.length,
          usageLedgerIds: lines.map((l) => l.usageLedgerId).join(','),
        },
      });
    }

    return { lines };
  }

  async reverseUsage(input: {
    tenantId: string;
    usageLedgerId: string;
    recordedByUserId: string;
    reasonCode?: string | null;
    notes?: string | null;
  }): Promise<{ reversalUsageId: string }> {
    if (!input.recordedByUserId?.trim()) {
      throw new BadRequestException('recordedByUserId is required');
    }
    return this.prisma.$transaction(
      async (tx) => this.reverseUsageInTx(tx, input),
      { maxWait: 20_000, timeout: 60_000 },
    );
  }

  async reverseUsageInTx(
    tx: Prisma.TransactionClient,
    input: {
      tenantId: string;
      usageLedgerId: string;
      recordedByUserId: string;
      reasonCode?: string | null;
      notes?: string | null;
    },
  ): Promise<{ reversalUsageId: string }> {
    if (!input.recordedByUserId?.trim()) {
      throw new BadRequestException('recordedByUserId is required');
    }

    const original = await tx.inventoryUsageLedger.findFirst({
      where: { id: input.usageLedgerId, tenantId: input.tenantId },
    });
    if (!original) throw new NotFoundException('Usage ledger entry not found');
    if (original.status === 'REVERSED') {
      throw new BadRequestException('Usage already reversed');
    }

    const qty = Number(original.quantityUsed);
    const warehouseId =
      original.warehouseId ??
      (
        await tx.inventoryWarehouse.findFirst({
          where: { tenantId: input.tenantId, isDefault: true, deletedAt: null },
          select: { id: true },
        })
      )?.id;
    if (!warehouseId) throw new BadRequestException('Warehouse required for reversal');

    if (original.inventoryBatchId) {
      await tx.$queryRaw`
        SELECT id FROM inventory_batches WHERE id = ${original.inventoryBatchId}::uuid FOR UPDATE
      `;
      const batch = await tx.inventoryBatch.findUnique({
        where: { id: original.inventoryBatchId },
      });
      if (batch) {
        await tx.inventoryBatch.update({
          where: { id: batch.id },
          data: {
            quantityOnHand: new Prisma.Decimal(Number(batch.quantityOnHand) + qty),
            status: 'ACTIVE',
          },
        });
      }
    }

    await tx.$queryRaw`
      SELECT id FROM inventory_items
      WHERE id = ${original.inventoryItemId}::uuid
        AND "tenantId" = ${input.tenantId}::uuid
      FOR UPDATE
    `;
    const item = await tx.inventoryItem.findFirst({
      where: { id: original.inventoryItemId, tenantId: input.tenantId },
    });
    if (!item) throw new NotFoundException('Inventory item not found');

    const before = Number(item.quantityOnHand);
    const after = before + qty;
    await tx.inventoryItem.update({
      where: { id: item.id },
      data: { quantityOnHand: new Prisma.Decimal(after) },
    });

    await this.applyWarehouseDelta(tx, {
      tenantId: input.tenantId,
      warehouseId,
      itemId: original.inventoryItemId,
      delta: qty,
    });

    const movementId = randomUUID();
    await tx.inventoryStockMovement.create({
      data: {
        id: movementId,
        tenantId: input.tenantId,
        inventoryItemId: original.inventoryItemId,
        movementType: 'ADJUST',
        quantity: new Prisma.Decimal(qty),
        quantityBefore: new Prisma.Decimal(before),
        quantityAfter: new Prisma.Decimal(after),
        reason: input.reasonCode ?? 'REVERSAL',
        notes: input.notes ?? null,
        warehouseId,
        performedBy: input.recordedByUserId,
        patientId: original.patientId,
        encounterId: original.encounterId,
        procedureCode: original.procedureCode,
      },
    });

    const reversalId = randomUUID();
    const now = new Date();
    await tx.inventoryUsageLedger.create({
      data: {
        id: reversalId,
        tenantId: input.tenantId,
        branchId: original.branchId,
        warehouseId,
        inventoryItemId: original.inventoryItemId,
        inventoryBatchId: original.inventoryBatchId,
        quantityUsed: new Prisma.Decimal(qty),
        unit: original.unit,
        usageType: 'REVERSAL',
        consumedBy: input.recordedByUserId,
        usedByUserId: original.usedByUserId,
        recordedByUserId: input.recordedByUserId,
        patientId: original.patientId,
        encounterId: original.encounterId,
        appointmentId: original.appointmentId,
        clinicalServiceId: original.clinicalServiceId,
        reasonCode: input.reasonCode ?? 'REVERSAL',
        notes: input.notes ?? null,
        consumedAt: now,
        occurredAt: now,
        recordedAt: now,
        sourceStockMovementId: movementId,
        reversalOfUsageId: original.id,
        status: 'POSTED',
        // New reversal rows are never LEGACY_UNATTRIBUTED (migration-only status).
        attributionStatus: 'ATTRIBUTED',
      },
    });

    await tx.inventoryUsageLedger.update({
      where: { id: original.id },
      data: { status: 'REVERSED' },
    });

    if (this.audit) {
      await this.audit.recordInTransaction(tx, {
        tenantId: input.tenantId,
        action: 'inventory.usage.reverse',
        resourceId: original.id,
        actorId: input.recordedByUserId,
        actorRoles: [],
        descriptionEn: 'Reversed inventory usage',
        descriptionAr: 'تم عكس استخدام المخزون',
        details: {
          originalUsageId: original.id,
          reversalUsageId: reversalId,
          usedByUserId: original.usedByUserId,
          reasonCode: input.reasonCode ?? 'REVERSAL',
          quantity: qty,
        },
      });
    }

    return { reversalUsageId: reversalId };
  }

  async correctUsage(input: {
    tenantId: string;
    usageLedgerId: string;
    recordedByUserId: string;
    correction: Omit<PostUsageInput, 'tenantId' | 'recordedByUserId'>;
    reasonCode: string;
    /** Test-only: force failure after reverse inside the atomic txn. */
    forceFailAfterReverse?: boolean;
  }): Promise<{ reversalUsageId: string; lines: PostedUsageLine[] }> {
    if (!input.reasonCode?.trim()) {
      throw new BadRequestException('reasonCode is required for correction');
    }

    return this.prisma.$transaction(
      async (tx) => {
        const reversed = await this.reverseUsageInTx(tx, {
          tenantId: input.tenantId,
          usageLedgerId: input.usageLedgerId,
          recordedByUserId: input.recordedByUserId,
          reasonCode: input.reasonCode,
          notes: 'Correction reversal',
        });

        if (
          input.forceFailAfterReverse === true &&
          process.env.ALLOW_TEST_DATABASE_RESET === 'true'
        ) {
          throw new Error('TEST_FORCE_FAIL_AFTER_REVERSE');
        }

        const posted = await this.postUsageInTx(tx, {
          ...input.correction,
          tenantId: input.tenantId,
          recordedByUserId: input.recordedByUserId,
          usageType: input.correction.usageType ?? 'CORRECTION',
          reasonCode: input.reasonCode,
        });

        if (this.audit) {
          await this.audit.recordInTransaction(tx, {
            tenantId: input.tenantId,
            action: 'inventory.usage.correct',
            resourceId: input.usageLedgerId,
            actorId: input.recordedByUserId,
            actorRoles: [],
            descriptionEn: 'Corrected inventory usage (atomic reverse+repost)',
            descriptionAr: 'تم تصحيح استخدام المخزون',
            details: {
              originalUsageId: input.usageLedgerId,
              reversalUsageId: reversed.reversalUsageId,
              replacementUsageIds: posted.lines.map((l) => l.usageLedgerId).join(','),
              reasonCode: input.reasonCode,
              usedByUserId: input.correction.usedByUserId ?? null,
            },
          });
        }

        return { reversalUsageId: reversed.reversalUsageId, lines: posted.lines };
      },
      { maxWait: 20_000, timeout: 60_000 },
    );
  }

  async disposeBatch(input: {
    tenantId: string;
    batchId: string;
    quantity: number;
    reason: string;
    notes?: string | null;
    disposedBy: string;
    usedByUserId: string;
    forceFailAfterUsage?: boolean;
  }): Promise<{ batchId: string; itemId: string; quantity: number; usageLedgerIds: string[] }> {
    if (!input.disposedBy?.trim()) throw new BadRequestException('User context is required');
    if (!input.usedByUserId?.trim()) {
      throw new BadRequestException(
        'usedByUserId is required for disposal (recorder must not be inferred as accountable user)',
      );
    }
    if (!input.reason?.trim()) throw new BadRequestException('Disposal reason is required');

    return this.prisma.$transaction(
      async (tx) => {
        const batch = await tx.inventoryBatch.findFirst({
          where: { id: input.batchId, tenantId: input.tenantId },
        });
        if (!batch) throw new NotFoundException('Batch not found or invalid disposal quantity');
        if (input.quantity <= 0 || input.quantity > Number(batch.quantityOnHand)) {
          throw new NotFoundException('Batch not found or invalid disposal quantity');
        }

        const usageType = this.mapDisposeUsageType(input.reason);
        const actor = input.disposedBy.trim();
        const usedByUserId = input.usedByUserId.trim();

        const posted = await this.postUsageInTx(tx, {
          tenantId: input.tenantId,
          inventoryItemId: batch.inventoryItemId,
          quantity: input.quantity,
          usageType,
          recordedByUserId: actor,
          usedByUserId,
          inventoryBatchId: input.batchId,
          reasonCode: input.reason.trim(),
          notes: input.notes ?? null,
        });

        if (
          input.forceFailAfterUsage === true &&
          process.env.ALLOW_TEST_DATABASE_RESET === 'true'
        ) {
          throw new Error('TEST_FORCE_FAIL_AFTER_DISPOSAL_USAGE');
        }

        await tx.inventoryDisposalLog.create({
          data: {
            id: randomUUID(),
            tenantId: input.tenantId,
            inventoryItemId: batch.inventoryItemId,
            batchId: input.batchId,
            quantity: new Prisma.Decimal(input.quantity),
            reason: input.reason.trim(),
            notes: input.notes ?? null,
            disposedBy: actor,
          },
        });

        const remaining = await tx.inventoryBatch.findFirst({
          where: { id: input.batchId, tenantId: input.tenantId },
          select: { quantityOnHand: true },
        });
        if (remaining && Number(remaining.quantityOnHand) <= 0) {
          await tx.inventoryBatch.update({
            where: { id: input.batchId },
            data: { status: 'DISPOSED' },
          });
        }

        if (this.audit) {
          await this.audit.recordInTransaction(tx, {
            tenantId: input.tenantId,
            action: 'inventory.usage.dispose',
            resourceId: input.batchId,
            actorId: actor,
            actorRoles: [],
            descriptionEn: 'Disposed inventory batch',
            descriptionAr: 'تم التخلص من دفعة المخزون',
            details: {
              batchId: input.batchId,
              inventoryItemId: batch.inventoryItemId,
              quantity: input.quantity,
              reason: input.reason.trim(),
              usageType,
              usageLedgerIds: posted.lines.map((l) => l.usageLedgerId).join(','),
            },
          });
        }

        return {
          batchId: input.batchId,
          itemId: batch.inventoryItemId,
          quantity: input.quantity,
          usageLedgerIds: posted.lines.map((l) => l.usageLedgerId),
        };
      },
      { maxWait: 20_000, timeout: 60_000 },
    );
  }

  private mapDisposeUsageType(reason: string): InventoryUsageType {
    const r = reason.toLowerCase();
    if (r.includes('expir')) return 'EXPIRED';
    if (r.includes('damage') || r.includes('damaged')) return 'DAMAGE';
    return 'WASTAGE';
  }

  private validateInputs(input: PostUsageInput) {
    if (!input.tenantId?.trim()) throw new BadRequestException('tenantId is required');
    if (!input.inventoryItemId?.trim()) throw new BadRequestException('inventoryItemId is required');
    if (!input.recordedByUserId?.trim()) {
      throw new BadRequestException('recordedByUserId (authenticated actor) is required');
    }
    if (!(input.quantity > 0)) throw new BadRequestException('quantity must be > 0');
    if (!input.usageType || !APPROVED_USAGE_TYPES.has(input.usageType)) {
      throw new BadRequestException(
        `usageType must be one of: ${[...CLIENT_POSTABLE_USAGE_TYPES].join(', ')}`,
      );
    }
    if (input.usageType === 'REVERSAL') {
      throw new BadRequestException(
        'usageType REVERSAL cannot be posted directly; use the reverse endpoint',
      );
    }
    if (!CLIENT_POSTABLE_USAGE_TYPES.has(input.usageType)) {
      throw new BadRequestException(`usageType ${input.usageType} is not allowed for posting`);
    }
    if (ACCOUNTABLE_REQUIRED.has(input.usageType) && !input.usedByUserId?.trim()) {
      throw new BadRequestException(
        `usedByUserId is required for ${input.usageType} (recorder must not be inferred as accountable user)`,
      );
    }
    if (REASON_REQUIRED.has(input.usageType) && !input.reasonCode?.trim()) {
      throw new BadRequestException(`reasonCode is required for ${input.usageType}`);
    }
    if (input.injectable && input.hasInjectableCreatePermission !== true) {
      throw new ForbiddenException(
        'api.clinical-injectable create permission is required to record injectable usage',
      );
    }
  }

  private async assertTenantUser(
    tx: Prisma.TransactionClient,
    tenantId: string,
    userId: string,
  ): Promise<void> {
    const user = await tx.user.findFirst({
      where: { id: userId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!user) {
      throw new BadRequestException('usedByUserId must belong to the current tenant');
    }
  }

  /**
   * Fail-closed tenant ownership for every optional related UUID written to InventoryUsageLedger.
   * Platform/global clinical services (tenantId null, SYSTEM_CANONICAL) are the only approved exception.
   */
  private async assertRelatedTenantReferences(
    tx: Prisma.TransactionClient,
    input: PostUsageInput,
  ): Promise<void> {
    if (input.patientId?.trim()) {
      const patient = await tx.patient.findFirst({
        where: { id: input.patientId, tenantId: input.tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!patient) {
        throw new BadRequestException('patientId does not belong to the current tenant');
      }
    }

    if (input.branchId?.trim()) {
      const branch = await tx.branch.findFirst({
        where: { id: input.branchId, tenantId: input.tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!branch) {
        throw new BadRequestException('branchId does not belong to the current tenant');
      }
    }

    if (input.clinicalServiceId?.trim()) {
      const service = await tx.canonicalClinicalServiceDefinition.findFirst({
        where: { id: input.clinicalServiceId },
        select: { id: true, tenantId: true, provenance: true },
      });
      if (!service) {
        throw new BadRequestException('clinicalServiceId not found');
      }
      const platformOk = service.tenantId == null && service.provenance === 'SYSTEM_CANONICAL';
      const tenantOk = service.tenantId === input.tenantId;
      if (!platformOk && !tenantOk) {
        throw new BadRequestException('clinicalServiceId does not belong to the current tenant');
      }
    }

    if (input.appointmentId?.trim()) {
      const appointment = await tx.appointment.findFirst({
        where: { id: input.appointmentId, tenantId: input.tenantId, deletedAt: null },
        select: { id: true, patientId: true, branchId: true, clinicalServiceId: true },
      });
      if (!appointment) {
        throw new BadRequestException('appointmentId does not belong to the current tenant');
      }
      if (input.patientId?.trim() && appointment.patientId !== input.patientId) {
        throw new BadRequestException('appointmentId patient does not match patientId');
      }
      if (
        input.clinicalServiceId?.trim() &&
        appointment.clinicalServiceId &&
        appointment.clinicalServiceId !== input.clinicalServiceId
      ) {
        throw new BadRequestException('appointmentId clinical service does not match clinicalServiceId');
      }
      if (input.branchId?.trim() && appointment.branchId && appointment.branchId !== input.branchId) {
        throw new BadRequestException('appointmentId branch does not match branchId');
      }
    }

    if (input.encounterId?.trim()) {
      const encounter = await tx.encounter.findFirst({
        where: { id: input.encounterId, tenantId: input.tenantId, deletedAt: null },
        select: { id: true, patientId: true, appointmentId: true, branchId: true },
      });
      if (!encounter) {
        throw new BadRequestException('encounterId does not belong to the current tenant');
      }
      if (input.patientId?.trim() && encounter.patientId !== input.patientId) {
        throw new BadRequestException('encounterId patient does not match patientId');
      }
      if (
        input.appointmentId?.trim() &&
        encounter.appointmentId &&
        encounter.appointmentId !== input.appointmentId
      ) {
        throw new BadRequestException('encounterId appointment does not match appointmentId');
      }
      if (input.branchId?.trim() && encounter.branchId && encounter.branchId !== input.branchId) {
        throw new BadRequestException('encounterId branch does not match branchId');
      }
    }

    const annotationIds = [
      input.beautyAnnotationId?.trim() || null,
      input.injectable?.beautyAnnotationId?.trim() || null,
    ].filter((id): id is string => Boolean(id));
    const uniqueAnnotationIds = [...new Set(annotationIds)];
    for (const annotationId of uniqueAnnotationIds) {
      const annotation = await tx.beautyAnnotation.findFirst({
        where: { id: annotationId, tenantId: input.tenantId },
        select: {
          id: true,
          encounterId: true,
          beautyRecord: { select: { patientId: true, tenantId: true } },
        },
      });
      if (!annotation) {
        throw new BadRequestException('beautyAnnotationId does not belong to the current tenant');
      }
      if (input.patientId?.trim() && annotation.beautyRecord.patientId !== input.patientId) {
        throw new BadRequestException('beautyAnnotationId patient does not match patientId');
      }
      if (
        input.encounterId?.trim() &&
        annotation.encounterId &&
        annotation.encounterId !== input.encounterId
      ) {
        throw new BadRequestException('beautyAnnotationId encounter does not match encounterId');
      }
    }
  }

  private allocateInjectableDoses(
    totalDose: number | null,
    quantities: number[],
  ): Array<number | null> {
    if (totalDose == null || !(totalDose >= 0) || quantities.length === 0) {
      return quantities.map(() => null);
    }
    const totalQty = quantities.reduce((a, b) => a + b, 0);
    if (totalQty <= 0) return quantities.map(() => null);
    const doses: number[] = [];
    let allocated = 0;
    for (let i = 0; i < quantities.length; i++) {
      if (i === quantities.length - 1) {
        doses.push(Number((totalDose - allocated).toFixed(6)));
      } else {
        const share = Number(((totalDose * quantities[i]) / totalQty).toFixed(6));
        doses.push(share);
        allocated += share;
      }
    }
    return doses;
  }

  private async resolveWarehouseId(
    tx: Prisma.TransactionClient,
    input: PostUsageInput,
  ): Promise<string> {
    if (input.warehouseId?.trim()) {
      const wh = await tx.inventoryWarehouse.findFirst({
        where: {
          id: input.warehouseId,
          tenantId: input.tenantId,
          deletedAt: null,
          isActive: true,
        },
        select: { id: true },
      });
      if (!wh) throw new BadRequestException('Warehouse not found or inactive');
      return wh.id;
    }
    const def = await tx.inventoryWarehouse.findFirst({
      where: { tenantId: input.tenantId, isDefault: true, deletedAt: null },
      select: { id: true },
    });
    if (!def) throw new BadRequestException('Default warehouse not found');
    return def.id;
  }

  private planBatchAllocations(params: {
    quantity: number;
    batchControlled: boolean;
    requestedBatchId: string | null;
    batches: Array<{
      id: string;
      quantityOnHand: Prisma.Decimal;
      expiryDate: Date | null;
      recalled: boolean;
      status: string;
    }>;
    today: Date;
    usageType: InventoryUsageType;
  }): Array<{ batchId: string | null; quantity: number }> {
    const denyExpiredOrRecalled =
      params.usageType === 'CLINICAL_CONSUMPTION' ||
      params.usageType === 'OPERATIONAL_CONSUMPTION' ||
      params.usageType === 'SAMPLE_OR_PROMOTIONAL';

    if (!params.batchControlled) {
      return [{ batchId: null, quantity: params.quantity }];
    }

    if (params.requestedBatchId) {
      const batch = params.batches.find((b) => b.id === params.requestedBatchId);
      if (!batch) throw new BadRequestException('Requested batch not available');
      if (denyExpiredOrRecalled) {
        if (batch.recalled) throw new BadRequestException('Recalled batch cannot be used');
        if (batch.expiryDate && batch.expiryDate < params.today) {
          throw new BadRequestException('Expired batch cannot be used for clinical/operational usage');
        }
      }
      if (Number(batch.quantityOnHand) < params.quantity) {
        throw new BadRequestException('Insufficient quantity on requested batch');
      }
      return [{ batchId: batch.id, quantity: params.quantity }];
    }

    const usable = params.batches.filter((b) => {
      if (denyExpiredOrRecalled) {
        if (b.recalled) return false;
        if (b.expiryDate && b.expiryDate < params.today) return false;
      }
      return Number(b.quantityOnHand) > 0;
    });

    let remaining = params.quantity;
    const lines: Array<{ batchId: string | null; quantity: number }> = [];
    for (const batch of usable) {
      if (remaining <= 0) break;
      const take = Math.min(Number(batch.quantityOnHand), remaining);
      lines.push({ batchId: batch.id, quantity: take });
      remaining -= take;
    }
    if (remaining > 0) {
      throw new BadRequestException(
        'Insufficient non-expired, non-recalled batch stock for requested quantity',
      );
    }
    return lines;
  }

  private async applyWarehouseDelta(
    tx: Prisma.TransactionClient,
    params: { tenantId: string; warehouseId: string; itemId: string; delta: number },
  ): Promise<{ itemQtyBefore: number; itemQtyAfter: number }> {
    const stock = await tx.inventoryWarehouseStock.findFirst({
      where: {
        tenantId: params.tenantId,
        warehouseId: params.warehouseId,
        inventoryItemId: params.itemId,
      },
    });
    const before = stock ? Number(stock.quantityOnHand) : 0;
    const after = before + params.delta;
    if (after < -0.0001) {
      throw new BadRequestException('Insufficient stock at selected warehouse');
    }
    if (stock) {
      await tx.inventoryWarehouseStock.update({
        where: { id: stock.id },
        data: { quantityOnHand: new Prisma.Decimal(Math.max(0, after)) },
      });
    } else if (params.delta > 0) {
      await tx.inventoryWarehouseStock.create({
        data: {
          id: randomUUID(),
          tenantId: params.tenantId,
          warehouseId: params.warehouseId,
          inventoryItemId: params.itemId,
          quantityOnHand: new Prisma.Decimal(after),
        },
      });
    } else {
      throw new BadRequestException('Insufficient stock at selected warehouse');
    }
    return { itemQtyBefore: before, itemQtyAfter: Math.max(0, after) };
  }
}
