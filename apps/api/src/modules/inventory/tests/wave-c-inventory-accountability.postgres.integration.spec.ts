/**
 * Wave C inventory accountability — C-INV-01..30 (full).
 */
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Prisma } from '@prisma/client';
import {
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  assertSafePlatformTestDatabaseUrl,
} from '../../auth/tests/platform-db-security.harness';
import { InventoryUsagePostingService } from '../application/services/inventory-usage-posting.service';
import { InventoryUsageOwnerReportService } from '../application/services/inventory-usage-owner-report.service';
import { FulfillStockRequestLineHandler } from '../application/handlers/stock-request.handlers';
import { PrismaStockRequestRepository } from '../infrastructure/prisma-stock-request.repository';
import { PrismaInventoryWarehouseRepository } from '../infrastructure/prisma-inventory-warehouse.repository';

const describeIf = platformDbSecurityEnabled() ? describe : describe.skip;

describeIf('Wave C inventory accountability (postgres)', () => {
  const tenantId = randomUUID();
  const otherTenantId = randomUUID();
  const actorId = randomUUID();
  const usedBy = randomUUID();
  let prisma: Awaited<ReturnType<typeof createPlatformDbSecurityClient>>;
  let posting: InventoryUsagePostingService;
  let ownerReport: InventoryUsageOwnerReportService;
  let itemId: string;
  let warehouseId: string;
  let otherWarehouseId: string;
  let patientId: string;

  async function seedStock(qty = 500) {
    await prisma.inventoryItem.update({
      where: { id: itemId },
      data: { quantityOnHand: new Prisma.Decimal(qty) },
    });
    await prisma.inventoryWarehouseStock.updateMany({
      where: { tenantId, warehouseId, inventoryItemId: itemId },
      data: { quantityOnHand: new Prisma.Decimal(qty) },
    });
  }

  async function addBatch(opts: {
    qty: number;
    lot?: string;
    expiryDays?: number;
    recalled?: boolean;
    status?: string;
    receivedOffsetMs?: number;
  }) {
    const id = randomUUID();
    await prisma.inventoryBatch.create({
      data: {
        id,
        tenantId,
        inventoryItemId: itemId,
        lotNumber: opts.lot ?? `LOT-${id.slice(0, 6)}`,
        quantityOnHand: new Prisma.Decimal(opts.qty),
        status: opts.status ?? 'ACTIVE',
        recalled: opts.recalled ?? false,
        recalledAt: opts.recalled ? new Date() : null,
        expiryDate:
          opts.expiryDays != null
            ? new Date(Date.now() + opts.expiryDays * 86400000)
            : new Date(Date.now() + 365 * 86400000),
        receivedAt: new Date(Date.now() + (opts.receivedOffsetMs ?? 0)),
      },
    });
    return id;
  }

  async function createTenantService() {
    const id = randomUUID();
    await prisma.canonicalClinicalServiceDefinition.create({
      data: {
        id,
        tenantId,
        provenance: 'TENANT_CUSTOM',
        stableKey: `tenant.${tenantId}.custom.wc-acc-${id.slice(0, 8)}`,
        domain: 'GENERAL',
        lifecycle: 'PUBLISHED',
      },
    });
    return id;
  }

  function failingOnUsageCreate() {
    return new Proxy(prisma, {
      get(target, prop, receiver) {
        if (prop === '$transaction') {
          return async (fn: (tx: unknown) => Promise<unknown>, opts?: unknown) =>
            (target.$transaction as Function).call(
              target,
              async (tx: Record<string, unknown>) => {
                const failingTx = new Proxy(tx, {
                  get(t, p, r) {
                    if (p === 'inventoryUsageLedger') {
                      const ledger = Reflect.get(t, p, r) as { create: Function };
                      return {
                        ...ledger,
                        create: async () => {
                          throw new Error('forced usage-write failure');
                        },
                      };
                    }
                    return Reflect.get(t, p, r);
                  },
                });
                return fn(failingTx);
              },
              opts,
            );
        }
        return Reflect.get(target, prop, receiver);
      },
    }) as typeof prisma;
  }

  function failingAfterUsageWrite() {
    return new Proxy(prisma, {
      get(target, prop, receiver) {
        if (prop === '$transaction') {
          return async (fn: (tx: unknown) => Promise<unknown>, opts?: unknown) =>
            (target.$transaction as Function).call(
              target,
              async (tx: Record<string, unknown>) => {
                const failingTx = new Proxy(tx, {
                  get(t, p, r) {
                    if (p === 'injectableUsageDetail') {
                      return {
                        create: async () => {
                          throw new Error('forced post-write failure');
                        },
                      };
                    }
                    return Reflect.get(t, p, r);
                  },
                });
                return fn(failingTx);
              },
              opts,
            );
        }
        return Reflect.get(target, prop, receiver);
      },
    }) as typeof prisma;
  }

  beforeAll(async () => {
    assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
    prisma = await createPlatformDbSecurityClient();
    await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
    await prisma.tenant.create({
      data: { id: tenantId, name: 'WC Inv', slug: `wc-inv-${tenantId.slice(0, 8)}` },
    });
    await prisma.tenant.create({
      data: {
        id: otherTenantId,
        name: 'WC Inv Other',
        slug: `wc-inv-o-${otherTenantId.slice(0, 8)}`,
      },
    });
    patientId = randomUUID();
    await prisma.patient.create({
      data: {
        id: patientId,
        tenantId,
        firstName: 'Inv',
        lastName: 'Patient',
        phone: `+1777${tenantId.slice(0, 7)}`,
      },
    });
    warehouseId = randomUUID();
    otherWarehouseId = randomUUID();
    await prisma.inventoryWarehouse.create({
      data: {
        id: warehouseId,
        tenantId,
        code: 'MAIN',
        nameEn: 'Main',
        isDefault: true,
        isActive: true,
      },
    });
    await prisma.inventoryWarehouse.create({
      data: {
        id: otherWarehouseId,
        tenantId,
        code: 'OTHER',
        nameEn: 'Other',
        isDefault: false,
        isActive: true,
      },
    });
    itemId = randomUUID();
    await prisma.inventoryItem.create({
      data: {
        id: itemId,
        tenantId,
        sku: `SKU-${itemId.slice(0, 6)}`,
        nameEn: 'Toxin',
        unit: 'unit',
        quantityOnHand: new Prisma.Decimal(500),
      },
    });
    await prisma.inventoryWarehouseStock.create({
      data: {
        id: randomUUID(),
        tenantId,
        warehouseId,
        inventoryItemId: itemId,
        quantityOnHand: new Prisma.Decimal(500),
      },
    });
    await prisma.inventoryWarehouseStock.create({
      data: {
        id: randomUUID(),
        tenantId,
        warehouseId: otherWarehouseId,
        inventoryItemId: itemId,
        quantityOnHand: new Prisma.Decimal(0),
      },
    });
    await prisma.user.create({
      data: {
        id: actorId,
        tenantId,
        email: `actor-${actorId.slice(0, 8)}@test.local`,
        passwordHash: 'x',
        firstName: 'Actor',
        lastName: 'Recorder',
      },
    });
    await prisma.user.create({
      data: {
        id: usedBy,
        tenantId,
        email: `usedby-${usedBy.slice(0, 8)}@test.local`,
        passwordHash: 'x',
        firstName: 'Used',
        lastName: 'By',
      },
    });
    const { AuditTrailInventoryAuditLog } = await import(
      '../infrastructure/audit-trail-inventory-audit-log'
    );
    const audit = new AuditTrailInventoryAuditLog(prisma as never);
    posting = new InventoryUsagePostingService(prisma as never, audit);
    ownerReport = new InventoryUsageOwnerReportService(prisma as never);
    // Ensure Wave C append-only protections are live (single-statement Prisma raw calls).
    await prisma.$executeRawUnsafe(`
CREATE OR REPLACE FUNCTION prevent_inventory_usage_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $fn$
DECLARE
  invoice_link_changed boolean;
  clinical_changed boolean;
  allow_invoice_link boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'inventory_consumption_logs is append-only. DELETE is forbidden.'
      USING ERRCODE = 'restrict_violation';
  END IF;

  invoice_link_changed :=
    NEW."invoiceId" IS DISTINCT FROM OLD."invoiceId"
    OR NEW."invoiceLineItemId" IS DISTINCT FROM OLD."invoiceLineItemId";

  allow_invoice_link :=
    coalesce(current_setting('app.allow_inventory_usage_invoice_link', true), '') = 'true';

  IF invoice_link_changed AND NOT allow_invoice_link THEN
    RAISE EXCEPTION 'inventory_consumption_logs invoice linkage may only change via trusted billing path'
      USING ERRCODE = 'restrict_violation';
  END IF;

  clinical_changed :=
       NEW."tenantId" IS DISTINCT FROM OLD."tenantId"
    OR NEW."inventoryItemId" IS DISTINCT FROM OLD."inventoryItemId"
    OR NEW."inventoryBatchId" IS DISTINCT FROM OLD."inventoryBatchId"
    OR NEW."quantityUsed" IS DISTINCT FROM OLD."quantityUsed"
    OR NEW."usageType" IS DISTINCT FROM OLD."usageType"
    OR NEW."usedByUserId" IS DISTINCT FROM OLD."usedByUserId"
    OR NEW."recordedByUserId" IS DISTINCT FROM OLD."recordedByUserId"
    OR NEW."consumedBy" IS DISTINCT FROM OLD."consumedBy"
    OR NEW."sourceStockMovementId" IS DISTINCT FROM OLD."sourceStockMovementId"
    OR NEW."reversalOfUsageId" IS DISTINCT FROM OLD."reversalOfUsageId"
    OR NEW."patientId" IS DISTINCT FROM OLD."patientId"
    OR NEW."encounterId" IS DISTINCT FROM OLD."encounterId"
    OR NEW."appointmentId" IS DISTINCT FROM OLD."appointmentId"
    OR NEW."clinicalServiceId" IS DISTINCT FROM OLD."clinicalServiceId"
    OR NEW."warehouseId" IS DISTINCT FROM OLD."warehouseId"
    OR NEW."branchId" IS DISTINCT FROM OLD."branchId"
    OR NEW."unit" IS DISTINCT FROM OLD."unit"
    OR NEW."reasonCode" IS DISTINCT FROM OLD."reasonCode"
    OR NEW."occurredAt" IS DISTINCT FROM OLD."occurredAt"
    OR NEW."attributionStatus" IS DISTINCT FROM OLD."attributionStatus"
    OR NEW."procedureCode" IS DISTINCT FROM OLD."procedureCode"
    OR NEW."beautyAnnotationId" IS DISTINCT FROM OLD."beautyAnnotationId"
    OR NEW."notes" IS DISTINCT FROM OLD."notes"
    OR NEW."consumedAt" IS DISTINCT FROM OLD."consumedAt"
    OR NEW."recordedAt" IS DISTINCT FROM OLD."recordedAt";

  IF OLD."status" = 'REVERSED' THEN
    IF clinical_changed OR NEW."status" IS DISTINCT FROM OLD."status" THEN
      RAISE EXCEPTION 'inventory_consumption_logs reversed rows are immutable'
        USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD."status" = 'POSTED' THEN
    IF NEW."status" IS DISTINCT FROM OLD."status"
       AND NOT (OLD."status" = 'POSTED' AND NEW."status" = 'REVERSED') THEN
      RAISE EXCEPTION 'inventory_consumption_logs status transition % → % forbidden',
        OLD."status", NEW."status"
        USING ERRCODE = 'restrict_violation';
    END IF;

    IF clinical_changed THEN
      RAISE EXCEPTION 'inventory_consumption_logs posted critical fields are immutable'
        USING ERRCODE = 'restrict_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;
`);
    await prisma.$executeRawUnsafe(
      `DROP TRIGGER IF EXISTS inventory_consumption_logs_append_only ON inventory_consumption_logs`,
    );
    await prisma.$executeRawUnsafe(`
CREATE TRIGGER inventory_consumption_logs_append_only
  BEFORE UPDATE OR DELETE ON inventory_consumption_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_inventory_usage_ledger_mutation()
`);
    await prisma.$executeRawUnsafe(`
CREATE OR REPLACE FUNCTION prevent_injectable_usage_detail_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'injectable_usage_details is append-only. DELETE is forbidden.'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RAISE EXCEPTION 'injectable_usage_details is append-only. UPDATE is forbidden.'
    USING ERRCODE = 'restrict_violation';
END;
$fn$;
`);
    await prisma.$executeRawUnsafe(
      `DROP TRIGGER IF EXISTS injectable_usage_details_append_only ON injectable_usage_details`,
    );
    await prisma.$executeRawUnsafe(`
CREATE TRIGGER injectable_usage_details_append_only
  BEFORE UPDATE OR DELETE ON injectable_usage_details
  FOR EACH ROW EXECUTE FUNCTION prevent_injectable_usage_detail_mutation()
`);
  }, 120_000);

  afterAll(async () => {
    if (!prisma) return;
    try {
      await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
      await prisma.inventoryWarehouseStock.deleteMany({ where: { tenantId } }).catch(() => undefined);
    } finally {
      await prisma.$disconnect().catch(() => undefined);
    }
  });

  async function mutationSnapshot() {
    const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
    const ledger = await prisma.inventoryUsageLedger.count({ where: { tenantId } });
    const movements = await prisma.inventoryStockMovement.count({ where: { tenantId } });
    const audit = await prisma.auditEntry.count({ where: { tenantId } });
    const disposal = await prisma.inventoryDisposalLog.count({ where: { tenantId } });
    return {
      qty: Number(item!.quantityOnHand),
      ledger,
      movements,
      audit,
      disposal,
    };
  }

  it('C-INV-01 — CLINICAL_CONSUMPTION requires usedBy', async () => {
    await expect(
      posting.postUsage({
        tenantId,
        inventoryItemId: itemId,
        quantity: 1,
        usageType: 'CLINICAL_CONSUMPTION',
        recordedByUserId: actorId,
        usedByUserId: null,
        warehouseId,
      }),
    ).rejects.toThrow(/usedByUserId/);
  });

  it('C-INV-02 — recordedBy = authenticated actor', async () => {
    await expect(
      posting.postUsage({
        tenantId,
        inventoryItemId: itemId,
        quantity: 1,
        usageType: 'CLINICAL_CONSUMPTION',
        recordedByUserId: '',
        usedByUserId: usedBy,
        warehouseId,
      }),
    ).rejects.toThrow(/recordedByUserId/);
    const result = await posting.postUsage({
      tenantId,
      inventoryItemId: itemId,
      quantity: 1,
      usageType: 'CLINICAL_CONSUMPTION',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      warehouseId,
    });
    const usage = await prisma.inventoryUsageLedger.findUnique({
      where: { id: result.lines[0].usageLedgerId },
    });
    expect(usage?.recordedByUserId).toBe(actorId);
  });

  it('C-INV-03 — usedBy != recordedBy supported', async () => {
    const result = await posting.postUsage({
      tenantId,
      inventoryItemId: itemId,
      quantity: 1,
      usageType: 'CLINICAL_CONSUMPTION',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      warehouseId,
    });
    const usage = await prisma.inventoryUsageLedger.findUnique({
      where: { id: result.lines[0].usageLedgerId },
    });
    expect(usage?.usedByUserId).toBe(usedBy);
    expect(usage?.recordedByUserId).toBe(actorId);
    expect(usage?.usedByUserId).not.toBe(usage?.recordedByUserId);
  });

  it('P0-10 — missing usedBy rejects WASTAGE/DAMAGE/EXPIRED/SAMPLE/OPERATIONAL/CLINICAL/CORRECTION with zero mutation', async () => {
    const types: Array<{
      usageType:
        | 'WASTAGE'
        | 'DAMAGE'
        | 'EXPIRED'
        | 'SAMPLE_OR_PROMOTIONAL'
        | 'OPERATIONAL_CONSUMPTION'
        | 'CLINICAL_CONSUMPTION'
        | 'CORRECTION';
      reasonCode?: string;
    }> = [
      { usageType: 'WASTAGE', reasonCode: 'WASTE' },
      { usageType: 'DAMAGE', reasonCode: 'DAMAGED' },
      { usageType: 'EXPIRED', reasonCode: 'EXPIRED_DISPOSAL' },
      { usageType: 'SAMPLE_OR_PROMOTIONAL' },
      { usageType: 'OPERATIONAL_CONSUMPTION' },
      { usageType: 'CLINICAL_CONSUMPTION' },
      { usageType: 'CORRECTION', reasonCode: 'FIX' },
    ];
    await seedStock(80);
    for (const row of types) {
      const before = await mutationSnapshot();
      await expect(
        posting.postUsage({
          tenantId,
          inventoryItemId: itemId,
          quantity: 1,
          usageType: row.usageType,
          recordedByUserId: actorId,
          usedByUserId: null,
          warehouseId,
          reasonCode: row.reasonCode ?? null,
        }),
      ).rejects.toThrow(/usedByUserId/);
      const after = await mutationSnapshot();
      expect(after).toEqual(before);
    }
  });

  it('P0-10 — valid same-tenant usedBy succeeds for WASTAGE/DAMAGE/EXPIRED/SAMPLE', async () => {
    await addBatch({ qty: 20, lot: 'LIVE-P010', expiryDays: 365 });
    await seedStock(80);
    const wastage = await posting.postUsage({
      tenantId,
      inventoryItemId: itemId,
      quantity: 1,
      usageType: 'WASTAGE',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      warehouseId,
      reasonCode: 'WASTE',
    });
    const damage = await posting.postUsage({
      tenantId,
      inventoryItemId: itemId,
      quantity: 1,
      usageType: 'DAMAGE',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      warehouseId,
      reasonCode: 'DAMAGED',
    });
    const sample = await posting.postUsage({
      tenantId,
      inventoryItemId: itemId,
      quantity: 1,
      usageType: 'SAMPLE_OR_PROMOTIONAL',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      warehouseId,
    });
    const expiredLot = await addBatch({ qty: 4, lot: 'EXP-P010', expiryDays: -1 });
    const expired = await posting.postUsage({
      tenantId,
      inventoryItemId: itemId,
      quantity: 1,
      usageType: 'EXPIRED',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      warehouseId,
      reasonCode: 'EXPIRED_DISPOSAL',
      inventoryBatchId: expiredLot,
    });
    for (const posted of [wastage, damage, expired, sample]) {
      const usage = await prisma.inventoryUsageLedger.findUnique({
        where: { id: posted.lines[0].usageLedgerId },
      });
      expect(usage?.usedByUserId).toBe(usedBy);
      expect(usage?.attributionStatus).toBe('ATTRIBUTED');
      expect(usage?.attributionStatus).not.toBe('LEGACY_UNATTRIBUTED');
    }
    await addBatch({ qty: 500, lot: 'LIVE-P010-REST', expiryDays: 365 });
  });

  it('C-INV-04 — department-only human accountability rejected', async () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../application/services/inventory-usage-posting.service.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/departmentId|departmentCode|departmentOnly/i);
    expect(src).toContain('usedByUserId is required for');
    await expect(
      posting.postUsage({
        tenantId,
        inventoryItemId: itemId,
        quantity: 1,
        usageType: 'CLINICAL_CONSUMPTION',
        recordedByUserId: actorId,
        usedByUserId: '   ',
        warehouseId,
      }),
    ).rejects.toThrow(/usedByUserId/);
  });

  it('C-INV-05 — stock decrement + StockMovement + UsageLedger atomic', async () => {
    const before = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
    const beforeQty = Number(before!.quantityOnHand);
    const result = await posting.postUsage({
      tenantId,
      inventoryItemId: itemId,
      quantity: 2,
      usageType: 'CLINICAL_CONSUMPTION',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      warehouseId,
    });
    const after = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
    const movement = await prisma.inventoryStockMovement.findUnique({
      where: { id: result.lines[0].stockMovementId },
    });
    const usage = await prisma.inventoryUsageLedger.findUnique({
      where: { id: result.lines[0].usageLedgerId },
    });
    expect(Number(after!.quantityOnHand)).toBe(beforeQty - 2);
    expect(movement).toBeTruthy();
    expect(usage?.sourceStockMovementId).toBe(movement!.id);
  });

  it('C-INV-06 — forced usage-write failure rolls stock/movement back', async () => {
    await seedStock(100);
    const before = Number((await prisma.inventoryItem.findUnique({ where: { id: itemId } }))!.quantityOnHand);
    const movementsBefore = await prisma.inventoryStockMovement.count({
      where: { tenantId, inventoryItemId: itemId },
    });
    const failing = new InventoryUsagePostingService(failingOnUsageCreate() as never);
    await expect(
      failing.postUsage({
        tenantId,
        inventoryItemId: itemId,
        quantity: 3,
        usageType: 'CLINICAL_CONSUMPTION',
        recordedByUserId: actorId,
        usedByUserId: usedBy,
        warehouseId,
      }),
    ).rejects.toThrow(/forced usage-write failure/);
    const after = Number((await prisma.inventoryItem.findUnique({ where: { id: itemId } }))!.quantityOnHand);
    const movementsAfter = await prisma.inventoryStockMovement.count({
      where: { tenantId, inventoryItemId: itemId },
    });
    expect(after).toBe(before);
    expect(movementsAfter).toBe(movementsBefore);
  });

  it('C-INV-07 — forced post-write failure rolls entire transaction back', async () => {
    await seedStock(100);
    const before = Number((await prisma.inventoryItem.findUnique({ where: { id: itemId } }))!.quantityOnHand);
    const failing = new InventoryUsagePostingService(failingAfterUsageWrite() as never);
    await expect(
      failing.postUsage({
        tenantId,
        inventoryItemId: itemId,
        quantity: 1,
        usageType: 'CLINICAL_CONSUMPTION',
        recordedByUserId: actorId,
        usedByUserId: usedBy,
        warehouseId,
        hasInjectableCreatePermission: true,
        injectable: { dose: 0.1, anatomicalSite: 'test' },
      }),
    ).rejects.toThrow(/forced post-write failure/);
    const after = Number((await prisma.inventoryItem.findUnique({ where: { id: itemId } }))!.quantityOnHand);
    expect(after).toBe(before);
  });

  it('C-INV-08 — insufficient stock denied; no negative stock', async () => {
    await seedStock(2);
    await expect(
      posting.postUsage({
        tenantId,
        inventoryItemId: itemId,
        quantity: 10,
        usageType: 'CLINICAL_CONSUMPTION',
        recordedByUserId: actorId,
        usedByUserId: usedBy,
        warehouseId,
      }),
    ).rejects.toThrow(/Insufficient/);
    const after = Number((await prisma.inventoryItem.findUnique({ where: { id: itemId } }))!.quantityOnHand);
    expect(after).toBeGreaterThanOrEqual(0);
    expect(after).toBe(2);
    await seedStock(200);
  });

  it('C-INV-09 — batch-controlled usage requires batch', async () => {
    await seedStock(50);
    await addBatch({ qty: 30, lot: 'BC-1', expiryDays: 100 });
    const result = await posting.postUsage({
      tenantId,
      inventoryItemId: itemId,
      quantity: 5,
      usageType: 'CLINICAL_CONSUMPTION',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      warehouseId,
    });
    expect(result.lines.length).toBeGreaterThan(0);
    expect(result.lines.every((l) => l.inventoryBatchId != null)).toBe(true);
  });

  it('C-INV-10 — insufficient batch quantity denied', async () => {
    const batchId = await addBatch({ qty: 1, lot: 'SMALL', expiryDays: 200 });
    await expect(
      posting.postUsage({
        tenantId,
        inventoryItemId: itemId,
        quantity: 5,
        usageType: 'CLINICAL_CONSUMPTION',
        recordedByUserId: actorId,
        usedByUserId: usedBy,
        warehouseId,
        inventoryBatchId: batchId,
      }),
    ).rejects.toThrow(/Insufficient quantity on requested batch/);
  });

  it('C-INV-11 — expired batch denied for new clinical usage', async () => {
    const expired = await addBatch({ qty: 5, lot: 'EXP', expiryDays: -2 });
    await expect(
      posting.postUsage({
        tenantId,
        inventoryItemId: itemId,
        quantity: 1,
        usageType: 'CLINICAL_CONSUMPTION',
        recordedByUserId: actorId,
        usedByUserId: usedBy,
        warehouseId,
        inventoryBatchId: expired,
      }),
    ).rejects.toThrow(/Expired/);
  });

  it('C-INV-12 — recalled batch denied for new clinical usage', async () => {
    const recalled = await addBatch({ qty: 5, lot: 'RECALL', expiryDays: 30, recalled: true });
    await expect(
      posting.postUsage({
        tenantId,
        inventoryItemId: itemId,
        quantity: 1,
        usageType: 'CLINICAL_CONSUMPTION',
        recordedByUserId: actorId,
        usedByUserId: usedBy,
        warehouseId,
        inventoryBatchId: recalled,
      }),
    ).rejects.toThrow(/Recalled/);
  });

  it('C-INV-13 — cross-tenant batch denied', async () => {
    const foreignBatch = randomUUID();
    await prisma.inventoryItem.create({
      data: {
        id: randomUUID(),
        tenantId: otherTenantId,
        sku: `O-${foreignBatch.slice(0, 6)}`,
        nameEn: 'Other',
        unit: 'u',
        quantityOnHand: new Prisma.Decimal(10),
      },
    });
    const otherItem = await prisma.inventoryItem.findFirst({ where: { tenantId: otherTenantId } });
    await prisma.inventoryBatch.create({
      data: {
        id: foreignBatch,
        tenantId: otherTenantId,
        inventoryItemId: otherItem!.id,
        lotNumber: 'FOREIGN',
        quantityOnHand: new Prisma.Decimal(10),
        status: 'ACTIVE',
        expiryDate: new Date(Date.now() + 86400000 * 30),
      },
    });
    await expect(
      posting.postUsage({
        tenantId,
        inventoryItemId: itemId,
        quantity: 1,
        usageType: 'CLINICAL_CONSUMPTION',
        recordedByUserId: actorId,
        usedByUserId: usedBy,
        warehouseId,
        inventoryBatchId: foreignBatch,
      }),
    ).rejects.toThrow(/Requested batch not available|not found/i);
  });

  it('C-INV-14 — wrong branch/warehouse batch denied', async () => {
    const batchId = await addBatch({ qty: 5, lot: 'WH', expiryDays: 40 });
    await expect(
      posting.postUsage({
        tenantId,
        inventoryItemId: itemId,
        quantity: 1,
        usageType: 'CLINICAL_CONSUMPTION',
        recordedByUserId: actorId,
        usedByUserId: usedBy,
        warehouseId: otherWarehouseId,
        inventoryBatchId: batchId,
      }),
    ).rejects.toThrow(/Insufficient stock/);
  });

  it('C-INV-15 — deactivated/depleted historical batch remains readable', async () => {
    const batchId = await addBatch({ qty: 2, lot: 'HIST', expiryDays: 50 });
    await posting.postUsage({
      tenantId,
      inventoryItemId: itemId,
      quantity: 2,
      usageType: 'CLINICAL_CONSUMPTION',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      warehouseId,
      inventoryBatchId: batchId,
    });
    const batch = await prisma.inventoryBatch.findUnique({ where: { id: batchId } });
    expect(batch?.status).toBe('DEPLETED');
    const usage = await prisma.inventoryUsageLedger.findFirst({
      where: { tenantId, inventoryBatchId: batchId },
    });
    expect(usage).toBeTruthy();
    expect(Number(batch?.quantityOnHand)).toBe(0);
  });

  it('C-INV-16 — FIFO split records actual consumed batch lines', async () => {
    // Isolate FIFO: use a dedicated item so earlier batches do not interfere.
    const fifoItem = randomUUID();
    await prisma.inventoryItem.create({
      data: {
        id: fifoItem,
        tenantId,
        sku: `FIFO-${fifoItem.slice(0, 6)}`,
        nameEn: 'FIFO',
        unit: 'u',
        quantityOnHand: new Prisma.Decimal(10),
      },
    });
    await prisma.inventoryWarehouseStock.create({
      data: {
        id: randomUUID(),
        tenantId,
        warehouseId,
        inventoryItemId: fifoItem,
        quantityOnHand: new Prisma.Decimal(10),
      },
    });
    const early = randomUUID();
    const late = randomUUID();
    await prisma.inventoryBatch.create({
      data: {
        id: early,
        tenantId,
        inventoryItemId: fifoItem,
        lotNumber: 'EARLY',
        quantityOnHand: new Prisma.Decimal(3),
        status: 'ACTIVE',
        expiryDate: new Date(Date.now() + 10 * 86400000),
        receivedAt: new Date(Date.now() - 10000),
      },
    });
    await prisma.inventoryBatch.create({
      data: {
        id: late,
        tenantId,
        inventoryItemId: fifoItem,
        lotNumber: 'LATE',
        quantityOnHand: new Prisma.Decimal(7),
        status: 'ACTIVE',
        expiryDate: new Date(Date.now() + 100 * 86400000),
        receivedAt: new Date(),
      },
    });
    const result = await posting.postUsage({
      tenantId,
      inventoryItemId: fifoItem,
      quantity: 5,
      usageType: 'CLINICAL_CONSUMPTION',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      warehouseId,
    });
    expect(result.lines.length).toBe(2);
    expect(result.lines.map((l) => l.inventoryBatchId).sort()).toEqual([early, late].sort());
    expect(result.lines.find((l) => l.inventoryBatchId === early)?.quantity).toBe(3);
    expect(result.lines.find((l) => l.inventoryBatchId === late)?.quantity).toBe(2);
  });

  it('C-INV-17 — sourceStockMovementId links authoritative movement', async () => {
    const result = await posting.postUsage({
      tenantId,
      inventoryItemId: itemId,
      quantity: 1,
      usageType: 'CLINICAL_CONSUMPTION',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      warehouseId,
    });
    const usage = await prisma.inventoryUsageLedger.findUnique({
      where: { id: result.lines[0].usageLedgerId },
    });
    expect(usage?.sourceStockMovementId).toBe(result.lines[0].stockMovementId);
  });

  it('C-INV-18 — WASTAGE requires reason', async () => {
    await expect(
      posting.postUsage({
        tenantId,
        inventoryItemId: itemId,
        quantity: 1,
        usageType: 'WASTAGE',
        recordedByUserId: actorId,
        usedByUserId: usedBy,
        warehouseId,
      }),
    ).rejects.toThrow(/reasonCode/);
  });

  it('C-INV-19 — DAMAGE requires reason', async () => {
    await expect(
      posting.postUsage({
        tenantId,
        inventoryItemId: itemId,
        quantity: 1,
        usageType: 'DAMAGE',
        recordedByUserId: actorId,
        usedByUserId: usedBy,
        warehouseId,
      }),
    ).rejects.toThrow(/reasonCode/);
  });

  it('C-INV-20 — EXPIRED usage/disposal requires usedBy, reason, and lot when tracked', async () => {
    await expect(
      posting.postUsage({
        tenantId,
        inventoryItemId: itemId,
        quantity: 1,
        usageType: 'EXPIRED',
        recordedByUserId: actorId,
        usedByUserId: usedBy,
        warehouseId,
      }),
    ).rejects.toThrow(/reasonCode/);
    const expiredLot = await addBatch({ qty: 4, lot: 'EXP-USE', expiryDays: -1 });
    const result = await posting.postUsage({
      tenantId,
      inventoryItemId: itemId,
      quantity: 1,
      usageType: 'EXPIRED',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      warehouseId,
      reasonCode: 'EXPIRED_DISPOSAL',
      inventoryBatchId: expiredLot,
    });
    expect(result.lines[0].inventoryBatchId).toBe(expiredLot);
  });

  it('C-INV-21 — reversal creates compensating movement', async () => {
    const posted = await posting.postUsage({
      tenantId,
      inventoryItemId: itemId,
      quantity: 1,
      usageType: 'CLINICAL_CONSUMPTION',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      warehouseId,
    });
    const rev = await posting.reverseUsage({
      tenantId,
      usageLedgerId: posted.lines[0].usageLedgerId,
      recordedByUserId: actorId,
      reasonCode: 'TEST_REVERSE',
    });
    const reversal = await prisma.inventoryUsageLedger.findUnique({
      where: { id: rev.reversalUsageId },
    });
    expect(reversal?.usageType).toBe('REVERSAL');
    expect(reversal?.sourceStockMovementId).toBeTruthy();
    const movement = await prisma.inventoryStockMovement.findUnique({
      where: { id: reversal!.sourceStockMovementId! },
    });
    expect(movement?.movementType).toBe('ADJUST');
  });

  it('C-INV-22 — original posted usage immutable after reversal', async () => {
    const posted = await posting.postUsage({
      tenantId,
      inventoryItemId: itemId,
      quantity: 1,
      usageType: 'CLINICAL_CONSUMPTION',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      warehouseId,
    });
    await posting.reverseUsage({
      tenantId,
      usageLedgerId: posted.lines[0].usageLedgerId,
      recordedByUserId: actorId,
      reasonCode: 'IMM',
    });
    await expect(
      prisma.inventoryUsageLedger.update({
        where: { id: posted.lines[0].usageLedgerId },
        data: { quantityUsed: new Prisma.Decimal(99) },
      }),
    ).rejects.toThrow(/immutable|forbidden/i);
  });

  it('C-INV-23 — correction = reversal + replacement post', async () => {
    const posted = await posting.postUsage({
      tenantId,
      inventoryItemId: itemId,
      quantity: 1,
      usageType: 'CLINICAL_CONSUMPTION',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      warehouseId,
    });
    const corrected = await posting.correctUsage({
      tenantId,
      usageLedgerId: posted.lines[0].usageLedgerId,
      recordedByUserId: actorId,
      reasonCode: 'CORRECTION',
      correction: {
        inventoryItemId: itemId,
        quantity: 2,
        usageType: 'CORRECTION',
        usedByUserId: usedBy,
        warehouseId,
      },
    });
    expect(corrected.reversalUsageId).toBeTruthy();
    expect(corrected.lines.length).toBeGreaterThanOrEqual(1);
    const original = await prisma.inventoryUsageLedger.findUnique({
      where: { id: posted.lines[0].usageLedgerId },
    });
    expect(original?.status).toBe('REVERSED');
  });

  it('C-INV-24 — hard delete of posted usage forbidden', async () => {
    const posted = await posting.postUsage({
      tenantId,
      inventoryItemId: itemId,
      quantity: 1,
      usageType: 'CLINICAL_CONSUMPTION',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      warehouseId,
    });
    await expect(
      prisma.inventoryUsageLedger.delete({ where: { id: posted.lines[0].usageLedgerId } }),
    ).rejects.toThrow();
  });

  it('C-INV-25 — usage/reversal/correction write real AuditEntry rows', async () => {
    const posted = await posting.postUsage({
      tenantId,
      inventoryItemId: itemId,
      quantity: 1,
      usageType: 'CLINICAL_CONSUMPTION',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      warehouseId,
      reasonCode: 'AUDIT_POST',
    });
    const postAudits = await prisma.auditEntry.findMany({
      where: {
        tenantId,
        action: { contains: 'inventory.usage' },
        resourceId: posted.lines[0].usageLedgerId,
      },
    });
    expect(postAudits.length).toBeGreaterThan(0);
    expect(postAudits[0].actorId).toBe(actorId);

    const rev = await posting.reverseUsage({
      tenantId,
      usageLedgerId: posted.lines[0].usageLedgerId,
      recordedByUserId: actorId,
      reasonCode: 'AUDIT_REV',
    });
    const revAudits = await prisma.auditEntry.findMany({
      where: { tenantId, action: 'inventory.usage.reverse', resourceId: posted.lines[0].usageLedgerId },
    });
    expect(revAudits.length).toBeGreaterThan(0);
    expect(revAudits.some((a) => String(a.details).includes(rev.reversalUsageId) || a.actorId === actorId)).toBe(
      true,
    );
  });

  it('C-INV-26 — usedBy correction writes AuditEntry and replacement usedBy', async () => {
    const newUsedBy = randomUUID();
    await prisma.user.create({
      data: {
        id: newUsedBy,
        tenantId,
        email: `newused-${newUsedBy.slice(0, 8)}@test.local`,
        passwordHash: 'x',
        firstName: 'New',
        lastName: 'Used',
      },
    });
    const posted = await posting.postUsage({
      tenantId,
      inventoryItemId: itemId,
      quantity: 1,
      usageType: 'CLINICAL_CONSUMPTION',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      warehouseId,
    });
    const corrected = await posting.correctUsage({
      tenantId,
      usageLedgerId: posted.lines[0].usageLedgerId,
      recordedByUserId: actorId,
      reasonCode: 'USED_BY_FIX',
      correction: {
        inventoryItemId: itemId,
        quantity: 1,
        usageType: 'CLINICAL_CONSUMPTION',
        usedByUserId: newUsedBy,
        warehouseId,
      },
    });
    const replacement = await prisma.inventoryUsageLedger.findUnique({
      where: { id: corrected.lines[0].usageLedgerId },
    });
    expect(replacement?.usedByUserId).toBe(newUsedBy);
    expect(replacement?.reasonCode).toBe('USED_BY_FIX');
    const audits = await prisma.auditEntry.findMany({
      where: { tenantId, action: 'inventory.usage.correct', resourceId: posted.lines[0].usageLedgerId },
    });
    expect(audits.length).toBeGreaterThan(0);
  });

  it('C-INV-27 — owner report aggregates by usedByUserId', async () => {
    const report = await ownerReport.report({
      tenantId,
      usedByUserId: usedBy,
      hasPhiPermission: true,
    });
    expect(report.total).toBeGreaterThan(0);
    expect(report.aggregates.byUsedBy.length).toBeGreaterThan(0);
    expect(report.aggregates.byUsedBy.every((a) => a.usedByUserId === usedBy)).toBe(true);
    expect(report.rows.every((r) => r.usedByUserId === usedBy)).toBe(true);
  });

  it('C-INV-28a — owner report filters by inventoryBatchId', async () => {
    const batchId = await addBatch({ qty: 10 });
    await posting.postUsage({
      tenantId,
      inventoryItemId: itemId,
      quantity: 1,
      usageType: 'CLINICAL_CONSUMPTION',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      warehouseId,
      inventoryBatchId: batchId,
    });
    const report = await ownerReport.report({
      tenantId,
      inventoryBatchId: batchId,
      hasPhiPermission: true,
    });
    expect(report.total).toBeGreaterThan(0);
    expect(report.rows.every((r) => r.inventoryBatchId === batchId)).toBe(true);
  });

  it('C-INV-28b — owner report filters by branchId', async () => {
    const branchId = randomUUID();
    await prisma.branch.create({
      data: { id: branchId, tenantId, name: 'WC Branch', isActive: true },
    });
    await posting.postUsage({
      tenantId,
      inventoryItemId: itemId,
      quantity: 1,
      usageType: 'CLINICAL_CONSUMPTION',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      warehouseId,
      branchId,
    });
    const report = await ownerReport.report({
      tenantId,
      branchId,
      hasPhiPermission: true,
    });
    expect(report.total).toBeGreaterThan(0);
    expect(report.rows.every((r) => r.branchId === branchId)).toBe(true);
  });

  it('C-INV-28c — owner report filters by clinicalServiceId', async () => {
    const clinicalServiceId = await createTenantService();
    await posting.postUsage({
      tenantId,
      inventoryItemId: itemId,
      quantity: 1,
      usageType: 'CLINICAL_CONSUMPTION',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      warehouseId,
      clinicalServiceId,
    });
    const report = await ownerReport.report({
      tenantId,
      clinicalServiceId,
      hasPhiPermission: true,
    });
    expect(report.total).toBeGreaterThan(0);
    expect(report.rows.every((r) => r.clinicalServiceId === clinicalServiceId)).toBe(true);
  });

  it('C-INV-28d — owner report filters by date range', async () => {
    const from = new Date(Date.now() - 86400000);
    const to = new Date(Date.now() + 86400000);
    const report = await ownerReport.report({
      tenantId,
      inventoryItemId: itemId,
      from,
      to,
      hasPhiPermission: true,
    });
    expect(report.rows.every((r) => !r.occurredAt || (r.occurredAt >= from && r.occurredAt <= to))).toBe(
      true,
    );
  });

  it('C-INV-29 — owner report PHI boundary', async () => {
    await posting.postUsage({
      tenantId,
      inventoryItemId: itemId,
      quantity: 1,
      usageType: 'CLINICAL_CONSUMPTION',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      warehouseId,
      patientId,
    });
    await expect(
      ownerReport.report({
        tenantId,
        includePhi: true,
        hasPhiPermission: false,
      }),
    ).rejects.toThrow(/api\.patients view permission/);
    const without = await ownerReport.report({
      tenantId,
      includePhi: false,
      hasPhiPermission: false,
      inventoryItemId: itemId,
    });
    expect(without.rows.every((r) => !('patientId' in r))).toBe(true);
    const withPhi = await ownerReport.report({
      tenantId,
      includePhi: true,
      hasPhiPermission: true,
      inventoryItemId: itemId,
    });
    expect(withPhi.rows.some((r) => 'patientId' in r)).toBe(true);
  });

  it('C-INV-30 — correction rollback leaves no half-corrected state; disposal uses canonical path', async () => {
    process.env.ALLOW_TEST_DATABASE_RESET = 'true';
    await seedStock(100);
    const before = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
    const posted = await posting.postUsage({
      tenantId,
      inventoryItemId: itemId,
      quantity: 2,
      usageType: 'CLINICAL_CONSUMPTION',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      warehouseId,
    });
    const auditCountBefore = await prisma.auditEntry.count({
      where: { tenantId, action: 'inventory.usage.correct' },
    });
    await expect(
      posting.correctUsage({
        tenantId,
        usageLedgerId: posted.lines[0].usageLedgerId,
        recordedByUserId: actorId,
        reasonCode: 'FORCE_FAIL',
        forceFailAfterReverse: true,
        correction: {
          inventoryItemId: itemId,
          quantity: 2,
          usageType: 'CLINICAL_CONSUMPTION',
          usedByUserId: usedBy,
          warehouseId,
        },
      }),
    ).rejects.toThrow(/TEST_FORCE_FAIL_AFTER_REVERSE/);

    const original = await prisma.inventoryUsageLedger.findUnique({
      where: { id: posted.lines[0].usageLedgerId },
    });
    expect(original?.status).toBe('POSTED');
    const after = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
    expect(Number(after?.quantityOnHand)).toBe(Number(before?.quantityOnHand) - 2);
    const auditCountAfter = await prisma.auditEntry.count({
      where: { tenantId, action: 'inventory.usage.correct' },
    });
    expect(auditCountAfter).toBe(auditCountBefore);

    const disposeSrc = fs.readFileSync(
      path.join(__dirname, '../application/handlers/dispose-inventory-batch.handler.ts'),
      'utf8',
    );
    expect(disposeSrc).toContain('usagePosting.disposeBatch');
    const repoSrc = fs.readFileSync(
      path.join(__dirname, '../infrastructure/prisma-inventory.repository.ts'),
      'utf8',
    );
    expect(repoSrc).toContain('disposeBatch repository primitive is closed');
  });

  it('C-INV-31 — disposal rollback leaves stock and no disposal log', async () => {
    process.env.ALLOW_TEST_DATABASE_RESET = 'true';
    await seedStock(50);
    const batchId = await addBatch({ qty: 20 });
    const before = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
    await expect(
      posting.disposeBatch({
        tenantId,
        batchId,
        quantity: 3,
        reason: 'wastage test',
        disposedBy: actorId,
        usedByUserId: usedBy,
        forceFailAfterUsage: true,
      }),
    ).rejects.toThrow(/TEST_FORCE_FAIL_AFTER_DISPOSAL_USAGE/);
    const after = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
    expect(Number(after?.quantityOnHand)).toBe(Number(before?.quantityOnHand));
    const logs = await prisma.inventoryDisposalLog.findMany({ where: { tenantId, batchId } });
    expect(logs.length).toBe(0);
  });

  it('P0-10 — disposal without usedBy rejects and does not copy recorder', async () => {
    await seedStock(50);
    const batchId = await addBatch({ qty: 8, lot: 'DISP-NO-USED' });
    const before = await mutationSnapshot();
    await expect(
      posting.disposeBatch({
        tenantId,
        batchId,
        quantity: 1,
        reason: 'expired disposal',
        disposedBy: actorId,
        usedByUserId: '',
      }),
    ).rejects.toThrow(/usedByUserId/);
    const after = await mutationSnapshot();
    expect(after).toEqual(before);
  });

  it('P0-10 — disposal with explicit usedBy succeeds and does not use recorder as usedBy', async () => {
    await seedStock(50);
    const batchId = await addBatch({ qty: 8, lot: 'DISP-USED' });
    const result = await posting.disposeBatch({
      tenantId,
      batchId,
      quantity: 1,
      reason: 'expired disposal',
      disposedBy: actorId,
      usedByUserId: usedBy,
    });
    const usage = await prisma.inventoryUsageLedger.findUnique({
      where: { id: result.usageLedgerIds[0] },
    });
    expect(usage?.usedByUserId).toBe(usedBy);
    expect(usage?.recordedByUserId).toBe(actorId);
    expect(usage?.usedByUserId).not.toBe(usage?.recordedByUserId);
    expect(usage?.attributionStatus).toBe('ATTRIBUTED');
  });

  it('C-INV-32 — posted historical fields including notes/procedureCode are immutable', async () => {
    const posted = await posting.postUsage({
      tenantId,
      inventoryItemId: itemId,
      quantity: 1,
      usageType: 'CLINICAL_CONSUMPTION',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      warehouseId,
      procedureCode: 'PROC1',
      notes: 'keep',
    });
    const id = posted.lines[0].usageLedgerId;
    await expect(
      prisma.inventoryUsageLedger.update({ where: { id }, data: { notes: 'mutated' } }),
    ).rejects.toThrow();
    await expect(
      prisma.inventoryUsageLedger.update({ where: { id }, data: { procedureCode: 'X' } }),
    ).rejects.toThrow();
    await expect(
      prisma.inventoryUsageLedger.update({ where: { id }, data: { quantityUsed: new Prisma.Decimal(99) } }),
    ).rejects.toThrow();
    await expect(prisma.inventoryUsageLedger.delete({ where: { id } })).rejects.toThrow();
  });

  it('C-INV-33 — cross-tenant usedByUserId rejected', async () => {
    const foreignUser = randomUUID();
    await prisma.user.create({
      data: {
        id: foreignUser,
        tenantId: otherTenantId,
        email: `foreign-${foreignUser.slice(0, 8)}@test.local`,
        passwordHash: 'x',
        firstName: 'Foreign',
        lastName: 'User',
      },
    });
    await expect(
      posting.postUsage({
        tenantId,
        inventoryItemId: itemId,
        quantity: 1,
        usageType: 'CLINICAL_CONSUMPTION',
        recordedByUserId: actorId,
        usedByUserId: foreignUser,
        warehouseId,
      }),
    ).rejects.toThrow(/usedByUserId must belong/);
  });

  it('C-INV-34 — unknown usageType rejected; never LEGACY_UNATTRIBUTED on new rows', async () => {
    await expect(
      posting.postUsage({
        tenantId,
        inventoryItemId: itemId,
        quantity: 1,
        usageType: 'SOMETHING_ELSE' as never,
        recordedByUserId: actorId,
        usedByUserId: usedBy,
        warehouseId,
      }),
    ).rejects.toThrow(/usageType/);

    const posted = await posting.postUsage({
      tenantId,
      inventoryItemId: itemId,
      quantity: 1,
      usageType: 'EXPIRED',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      reasonCode: 'EXPIRED_DISPOSAL',
      warehouseId,
    });
    const row = await prisma.inventoryUsageLedger.findUnique({
      where: { id: posted.lines[0].usageLedgerId },
    });
    expect(row?.attributionStatus).toBe('ATTRIBUTED');
    expect(row?.attributionStatus).not.toBe('LEGACY_UNATTRIBUTED');

    // Historical LEGACY rows remain readable
    const legacyId = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO inventory_consumption_logs (
        id, "tenantId", "inventoryItemId", "quantityUsed", unit, "usageType",
        "consumedBy", "consumedAt", "occurredAt", "recordedAt", status, "attributionStatus", "warehouseId"
      ) VALUES (
        ${legacyId}::uuid, ${tenantId}::uuid, ${itemId}::uuid, 1, 'unit', 'CLINICAL_CONSUMPTION',
        ${actorId}::uuid, NOW(), NOW(), NOW(), 'POSTED', 'LEGACY_UNATTRIBUTED', ${warehouseId}::uuid
      )
    `;
    const legacy = await prisma.inventoryUsageLedger.findUnique({ where: { id: legacyId } });
    expect(legacy?.attributionStatus).toBe('LEGACY_UNATTRIBUTED');
  });

  it('C-INV-35 — correction without usedBy rejected for accountable replacement', async () => {
    const posted = await posting.postUsage({
      tenantId,
      inventoryItemId: itemId,
      quantity: 2,
      usageType: 'CLINICAL_CONSUMPTION',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      warehouseId,
    });
    await expect(
      posting.correctUsage({
        tenantId,
        usageLedgerId: posted.lines[0].usageLedgerId,
        recordedByUserId: actorId,
        reasonCode: 'FIX',
        correction: {
          inventoryItemId: itemId,
          quantity: 1,
          usageType: 'CORRECTION',
          usedByUserId: null,
          warehouseId,
        },
      }),
    ).rejects.toThrow(/usedByUserId/);
  });

  it('C-INV-36 — owner report net totals: usage 5, that usage reversed => 0, usage 5 corrected to 3', async () => {
    await seedStock(200);

    function summarize(report: Awaited<ReturnType<InventoryUsageOwnerReportService['report']>>) {
      return {
        net: report.aggregates.netQuantityTotal,
        rows: report.rows.map((r) => ({
          id: r.id,
          usageType: r.usageType,
          status: r.status,
          quantityUsed: r.quantityUsed,
          signedQuantity: r.signedQuantity,
        })),
      };
    }

    // Case 1 — isolated: a single usage of 5 => net 5
    const caseUsage = await createTenantService();
    const postedUsage = await posting.postUsage({
      tenantId,
      inventoryItemId: itemId,
      quantity: 5,
      usageType: 'CLINICAL_CONSUMPTION',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      warehouseId,
      clinicalServiceId: caseUsage,
    });
    const reportUsage = await ownerReport.report({
      tenantId,
      clinicalServiceId: caseUsage,
      hasPhiPermission: true,
    });
    const usageSummary = summarize(reportUsage);
    expect(usageSummary.rows).toHaveLength(1);
    expect(usageSummary.rows[0]).toMatchObject({
      id: postedUsage.lines[0].usageLedgerId,
      usageType: 'CLINICAL_CONSUMPTION',
      status: 'POSTED',
      quantityUsed: 5,
      signedQuantity: 5,
    });
    expect(usageSummary.net).toBe(5);

    // Case 2 — isolated: that same usage fully reversed => net 0
    const caseReverse = await createTenantService();
    const postedToReverse = await posting.postUsage({
      tenantId,
      inventoryItemId: itemId,
      quantity: 5,
      usageType: 'CLINICAL_CONSUMPTION',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      warehouseId,
      clinicalServiceId: caseReverse,
    });
    const reversed = await posting.reverseUsage({
      tenantId,
      usageLedgerId: postedToReverse.lines[0].usageLedgerId,
      recordedByUserId: actorId,
      reasonCode: 'UNDO',
    });
    const reportReverse = await ownerReport.report({
      tenantId,
      clinicalServiceId: caseReverse,
      hasPhiPermission: true,
    });
    const reverseSummary = summarize(reportReverse);
    expect(reverseSummary.rows).toHaveLength(2);
    const originalReversed = reverseSummary.rows.find(
      (r) => r.id === postedToReverse.lines[0].usageLedgerId,
    );
    const reversalRow = reverseSummary.rows.find((r) => r.id === reversed.reversalUsageId);
    expect(originalReversed).toMatchObject({
      usageType: 'CLINICAL_CONSUMPTION',
      status: 'REVERSED',
      quantityUsed: 5,
      signedQuantity: 0,
    });
    expect(reversalRow).toMatchObject({
      usageType: 'REVERSAL',
      status: 'POSTED',
      quantityUsed: 5,
      signedQuantity: 0,
    });
    expect(reverseSummary.net).toBe(0);

    // Case 3 — isolated: a usage of 5 corrected to 3 => net 3
    const caseCorrect = await createTenantService();
    const postedToCorrect = await posting.postUsage({
      tenantId,
      inventoryItemId: itemId,
      quantity: 5,
      usageType: 'CLINICAL_CONSUMPTION',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      warehouseId,
      clinicalServiceId: caseCorrect,
    });
    const corrected = await posting.correctUsage({
      tenantId,
      usageLedgerId: postedToCorrect.lines[0].usageLedgerId,
      recordedByUserId: actorId,
      reasonCode: 'QTY_FIX',
      correction: {
        inventoryItemId: itemId,
        quantity: 3,
        usageType: 'CORRECTION',
        usedByUserId: usedBy,
        warehouseId,
        clinicalServiceId: caseCorrect,
      },
    });
    const reportCorrect = await ownerReport.report({
      tenantId,
      clinicalServiceId: caseCorrect,
      hasPhiPermission: true,
    });
    const correctSummary = summarize(reportCorrect);
    const originalCorrected = correctSummary.rows.find(
      (r) => r.id === postedToCorrect.lines[0].usageLedgerId,
    );
    const correctionReversal = correctSummary.rows.find((r) => r.id === corrected.reversalUsageId);
    const replacementRows = correctSummary.rows.filter((r) =>
      corrected.lines.some((l) => l.usageLedgerId === r.id),
    );
    expect(originalCorrected).toMatchObject({
      usageType: 'CLINICAL_CONSUMPTION',
      status: 'REVERSED',
      quantityUsed: 5,
      signedQuantity: 0,
    });
    expect(correctionReversal).toMatchObject({
      usageType: 'REVERSAL',
      status: 'POSTED',
      quantityUsed: 5,
      signedQuantity: 0,
    });
    expect(replacementRows.length).toBeGreaterThanOrEqual(1);
    expect(replacementRows.every((r) => r.usageType === 'CORRECTION' && r.status === 'POSTED')).toBe(
      true,
    );
    expect(replacementRows.reduce((sum, r) => sum + r.quantityUsed, 0)).toBe(3);
    expect(replacementRows.reduce((sum, r) => sum + r.signedQuantity, 0)).toBe(3);
    expect(correctSummary.net).toBe(3);
  });

  it('C-INV-37 — billing invoice link/unlink via trusted session flag; clinical fields stay immutable', async () => {
    const posted = await posting.postUsage({
      tenantId,
      inventoryItemId: itemId,
      quantity: 1,
      usageType: 'CLINICAL_CONSUMPTION',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      warehouseId,
    });
    const usageId = posted.lines[0].usageLedgerId;
    const invoiceId = randomUUID();
    const lineId = randomUUID();

    await prisma.invoice.create({
      data: {
        id: invoiceId,
        tenantId,
        patientId,
        invoiceNumber: `INV-${invoiceId.slice(0, 8)}`,
        invoiceDate: new Date(),
        currency: 'SYP',
        status: 'DRAFT',
        amountSubtotal: new Prisma.Decimal(0),
        amountDiscount: new Prisma.Decimal(0),
        amountTax: new Prisma.Decimal(0),
        amountTotal: new Prisma.Decimal(0),
        amountPaid: new Prisma.Decimal(0),
      },
    });
    await prisma.invoiceLineItem.create({
      data: {
        id: lineId,
        invoiceId,
        tenantId,
        description: 'usage',
        quantity: new Prisma.Decimal(1),
        unitPrice: new Prisma.Decimal(0),
        discountPercent: new Prisma.Decimal(0),
        taxPercent: new Prisma.Decimal(0),
        subtotal: new Prisma.Decimal(0),
        discountAmount: new Prisma.Decimal(0),
        taxAmount: new Prisma.Decimal(0),
        lineTotal: new Prisma.Decimal(0),
      },
    });

    await expect(
      prisma.inventoryUsageLedger.update({
        where: { id: usageId },
        data: { invoiceId, invoiceLineItemId: lineId },
      }),
    ).rejects.toThrow(/invoice linkage|immutable|trusted billing/i);

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.allow_inventory_usage_invoice_link', 'true', true)`;
      await tx.inventoryUsageLedger.update({
        where: { id: usageId },
        data: { invoiceId, invoiceLineItemId: lineId },
      });
    });
    let linked = await prisma.inventoryUsageLedger.findUnique({ where: { id: usageId } });
    expect(linked?.invoiceId).toBe(invoiceId);

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.allow_inventory_usage_invoice_link', 'true', true)`;
      await tx.inventoryUsageLedger.update({
        where: { id: usageId },
        data: { invoiceId: null, invoiceLineItemId: null },
      });
    });
    linked = await prisma.inventoryUsageLedger.findUnique({ where: { id: usageId } });
    expect(linked?.invoiceId).toBeNull();

    await expect(
      prisma.inventoryUsageLedger.update({
        where: { id: usageId },
        data: { quantityUsed: new Prisma.Decimal(99) },
      }),
    ).rejects.toThrow();
  });

  function makeFulfillHandler() {
    const requestRepo = new PrismaStockRequestRepository(prisma as never);
    const itemRepo = {
      findById: async () => ({ id: itemId, unit: 'unit' }),
    };
    const warehouseRepo = {
      ensureDefaultWarehouseId: async () => warehouseId,
      existsActive: async () => true,
    };
    const tenantContext = { resolve: async () => ({ tenantId, branchId: null }) };
    return new FulfillStockRequestLineHandler(
      requestRepo,
      itemRepo as never,
      warehouseRepo as never,
      tenantContext as never,
      posting,
      prisma as never,
    );
  }

  async function seedApprovedRequest(requested: number, opts?: { warehouseId?: string | null }) {
    const requestId = randomUUID();
    const lineId = randomUUID();
    await prisma.inventoryStockRequest.create({
      data: {
        id: requestId,
        tenantId,
        requestNumber: `REQ-${requestId.slice(0, 8)}`,
        requestType: 'DEPARTMENT',
        status: 'APPROVED',
        warehouseId: opts && 'warehouseId' in opts ? opts.warehouseId : warehouseId,
        requestedBy: actorId,
        approvedBy: actorId,
        approvedAt: new Date(),
        lines: {
          create: [
            {
              id: lineId,
              tenantId,
              inventoryItemId: itemId,
              quantityRequested: new Prisma.Decimal(requested),
              quantityFulfilled: new Prisma.Decimal(0),
            },
          ],
        },
      },
    });
    return { requestId, lineId };
  }

  async function stockRequestSnapshot(requestId: string, lineId: string) {
    const base = await mutationSnapshot();
    const line = await prisma.inventoryStockRequestLine.findUnique({ where: { id: lineId } });
    const request = await prisma.inventoryStockRequest.findUnique({ where: { id: requestId } });
    const usage = await prisma.inventoryUsageLedger.findMany({
      where: { tenantId, reasonCode: `Stock request ${request!.requestNumber}` },
    });
    return {
      ...base,
      lineFulfilled: Number(line!.quantityFulfilled),
      requestStatus: request!.status,
      fulfilledBy: request!.fulfilledBy,
      usageCount: usage.length,
      usageQty: usage.reduce((sum, row) => sum + Number(row.quantityUsed), 0),
    };
  }

  it('P0-10 — stock-request fulfill missing usedBy rejects with zero mutation', async () => {
    await seedStock(80);
    const { requestId, lineId } = await seedApprovedRequest(4);
    const before = await stockRequestSnapshot(requestId, lineId);
    const handler = makeFulfillHandler();
    await expect(
      handler.execute({
        lineId,
        quantity: 2,
        fulfilledBy: actorId,
        usedByUserId: '',
      }),
    ).rejects.toThrow(/usedByUserId/);
    expect(await stockRequestSnapshot(requestId, lineId)).toEqual(before);
  });

  it('P0-10 — stock-request fulfill unknown usedBy rejects with zero mutation', async () => {
    await seedStock(80);
    const { requestId, lineId } = await seedApprovedRequest(4);
    const before = await stockRequestSnapshot(requestId, lineId);
    const handler = makeFulfillHandler();
    await expect(
      handler.execute({
        lineId,
        quantity: 2,
        fulfilledBy: actorId,
        usedByUserId: randomUUID(),
      }),
    ).rejects.toThrow(/usedByUserId must belong/);
    expect(await stockRequestSnapshot(requestId, lineId)).toEqual(before);
  });

  it('P0-10 — stock-request fulfill cross-tenant usedBy rejects with zero mutation', async () => {
    const foreignUser = randomUUID();
    await prisma.user.create({
      data: {
        id: foreignUser,
        tenantId: otherTenantId,
        email: `sr-foreign-${foreignUser.slice(0, 8)}@test.local`,
        passwordHash: 'x',
        firstName: 'Foreign',
        lastName: 'Fulfill',
      },
    });
    await seedStock(80);
    const { requestId, lineId } = await seedApprovedRequest(4);
    const before = await stockRequestSnapshot(requestId, lineId);
    const handler = makeFulfillHandler();
    await expect(
      handler.execute({
        lineId,
        quantity: 2,
        fulfilledBy: actorId,
        usedByUserId: foreignUser,
      }),
    ).rejects.toThrow(/usedByUserId must belong/);
    expect(await stockRequestSnapshot(requestId, lineId)).toEqual(before);
  });

  it('P0-10 — stock-request fulfill stores recordedBy and usedBy independently', async () => {
    await seedStock(80);
    const { requestId, lineId } = await seedApprovedRequest(3);
    const handler = makeFulfillHandler();
    const result = await handler.execute({
      lineId,
      quantity: 3,
      fulfilledBy: actorId,
      usedByUserId: usedBy,
    });
    expect(result.status).toBe('FULFILLED');
    const request = await prisma.inventoryStockRequest.findUnique({ where: { id: requestId } });
    const usage = await prisma.inventoryUsageLedger.findMany({
      where: { tenantId, reasonCode: `Stock request ${request!.requestNumber}` },
    });
    expect(usage).toHaveLength(1);
    expect(usage[0].recordedByUserId).toBe(actorId);
    expect(usage[0].usedByUserId).toBe(usedBy);
    expect(usage[0].usedByUserId).not.toBe(usage[0].recordedByUserId);
    expect(usage[0].usageType).toBe('OPERATIONAL_CONSUMPTION');
    expect(usage[0].attributionStatus).toBe('ATTRIBUTED');
    const line = await prisma.inventoryStockRequestLine.findUnique({ where: { id: lineId } });
    expect(Number(line!.quantityFulfilled)).toBe(3);
  });

  it('P0-10 — stock-request fulfill same UUID for both only when explicitly supplied', async () => {
    await seedStock(80);
    const { requestId, lineId } = await seedApprovedRequest(2);
    const handler = makeFulfillHandler();
    await handler.execute({
      lineId,
      quantity: 2,
      fulfilledBy: actorId,
      usedByUserId: actorId,
    });
    const request = await prisma.inventoryStockRequest.findUnique({ where: { id: requestId } });
    const usage = await prisma.inventoryUsageLedger.findMany({
      where: { tenantId, reasonCode: `Stock request ${request!.requestNumber}` },
    });
    expect(usage).toHaveLength(1);
    expect(usage[0].recordedByUserId).toBe(actorId);
    expect(usage[0].usedByUserId).toBe(actorId);
  });

  it('H3 — stock-request fulfill failure after posting rolls back stock, ledger, audit, and line', async () => {
    process.env.ALLOW_TEST_DATABASE_RESET = 'true';
    await seedStock(80);
    const { requestId, lineId } = await seedApprovedRequest(4);
    const before = await stockRequestSnapshot(requestId, lineId);
    const handler = makeFulfillHandler();
    await expect(
      handler.execute({
        lineId,
        quantity: 2,
        fulfilledBy: actorId,
        usedByUserId: usedBy,
        forceFailAfterUsage: true,
      }),
    ).rejects.toThrow(/TEST_FORCE_FAIL_AFTER_STOCK_REQUEST_FULFILLMENT/);
    expect(await stockRequestSnapshot(requestId, lineId)).toEqual(before);
  });

  it('H3 — stock-request fulfill retry after rollback posts exactly once', async () => {
    process.env.ALLOW_TEST_DATABASE_RESET = 'true';
    await seedStock(80);
    const { requestId, lineId } = await seedApprovedRequest(2);
    const handler = makeFulfillHandler();
    await expect(
      handler.execute({
        lineId,
        quantity: 2,
        fulfilledBy: actorId,
        usedByUserId: usedBy,
        forceFailAfterUsage: true,
      }),
    ).rejects.toThrow(/TEST_FORCE_FAIL_AFTER_STOCK_REQUEST_FULFILLMENT/);
    await handler.execute({
      lineId,
      quantity: 2,
      fulfilledBy: actorId,
      usedByUserId: usedBy,
    });
    const request = await prisma.inventoryStockRequest.findUnique({ where: { id: requestId } });
    const usage = await prisma.inventoryUsageLedger.findMany({
      where: { tenantId, reasonCode: `Stock request ${request!.requestNumber}` },
    });
    expect(usage).toHaveLength(1);
    expect(Number(usage[0].quantityUsed)).toBe(2);
    const line = await prisma.inventoryStockRequestLine.findUnique({ where: { id: lineId } });
    expect(Number(line!.quantityFulfilled)).toBe(2);
    expect(Number(line!.quantityFulfilled)).toBeLessThanOrEqual(Number(line!.quantityRequested));
  });

  it('H3 — concurrent stock-request fulfillments do not over-consume remaining quantity', async () => {
    await seedStock(80);
    const { requestId, lineId } = await seedApprovedRequest(5);
    const beforeItem = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
    const handlerA = makeFulfillHandler();
    const handlerB = makeFulfillHandler();
    const results = await Promise.allSettled([
      handlerA.execute({
        lineId,
        quantity: 5,
        fulfilledBy: actorId,
        usedByUserId: usedBy,
      }),
      handlerB.execute({
        lineId,
        quantity: 5,
        fulfilledBy: actorId,
        usedByUserId: usedBy,
      }),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    if (rejected[0].status === 'rejected') {
      expect(String(rejected[0].reason)).toMatch(
        /Invalid fulfillment quantity|Only approved requests can be fulfilled/,
      );
    }
    const line = await prisma.inventoryStockRequestLine.findUnique({ where: { id: lineId } });
    expect(Number(line!.quantityFulfilled)).toBe(5);
    expect(Number(line!.quantityFulfilled)).toBeLessThanOrEqual(Number(line!.quantityRequested));
    const request = await prisma.inventoryStockRequest.findUnique({ where: { id: requestId } });
    const usage = await prisma.inventoryUsageLedger.findMany({
      where: { tenantId, reasonCode: `Stock request ${request!.requestNumber}` },
    });
    expect(usage).toHaveLength(1);
    const afterItem = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
    expect(Number(beforeItem!.quantityOnHand) - Number(afterItem!.quantityOnHand)).toBe(5);
  });

  function makeFulfillHandlerWithRealWarehouse() {
    const requestRepo = new PrismaStockRequestRepository(prisma as never);
    const itemRepo = {
      findById: async (tid: string, id: string) => {
        const row = await prisma.inventoryItem.findFirst({ where: { id, tenantId: tid } });
        return row ? { id: row.id, unit: row.unit } : null;
      },
    };
    const warehouseRepo = new PrismaInventoryWarehouseRepository(prisma as never);
    const tenantContext = { resolve: async () => ({ tenantId, branchId: null }) };
    return new FulfillStockRequestLineHandler(
      requestRepo,
      itemRepo as never,
      warehouseRepo,
      tenantContext as never,
      posting,
      prisma as never,
    );
  }

  it('V2 — ensureDefaultWarehouseId setDefault write rolls back with fulfillment', async () => {
    process.env.ALLOW_TEST_DATABASE_RESET = 'true';
    await seedStock(80);
    await prisma.inventoryWarehouse.update({
      where: { id: warehouseId },
      data: { isDefault: false },
    });
    const { requestId, lineId } = await seedApprovedRequest(2, { warehouseId: null });
    const before = await stockRequestSnapshot(requestId, lineId);
    const handler = makeFulfillHandlerWithRealWarehouse();
    await expect(
      handler.execute({
        lineId,
        quantity: 2,
        fulfilledBy: actorId,
        usedByUserId: usedBy,
        forceFailAfterUsage: true,
      }),
    ).rejects.toThrow(/TEST_FORCE_FAIL_AFTER_STOCK_REQUEST_FULFILLMENT/);
    expect(await stockRequestSnapshot(requestId, lineId)).toEqual(before);
    const main = await prisma.inventoryWarehouse.findUnique({ where: { id: warehouseId } });
    expect(main?.isDefault).toBe(false);
    await prisma.inventoryWarehouse.update({
      where: { id: warehouseId },
      data: { isDefault: true },
    });
  });

  it('V2 — ensureDefaultWarehouseId create write rolls back when fulfillment fails', async () => {
    const isolatedTenant = randomUUID();
    const isolatedActor = randomUUID();
    const isolatedUsedBy = randomUUID();
    const isolatedItem = randomUUID();
    await prisma.tenant.create({
      data: { id: isolatedTenant, name: 'WC WH', slug: `wc-wh-${isolatedTenant.slice(0, 8)}` },
    });
    await prisma.user.create({
      data: {
        id: isolatedActor,
        tenantId: isolatedTenant,
        email: `wh-actor-${isolatedActor.slice(0, 8)}@test.local`,
        passwordHash: 'x',
        firstName: 'Wh',
        lastName: 'Actor',
      },
    });
    await prisma.user.create({
      data: {
        id: isolatedUsedBy,
        tenantId: isolatedTenant,
        email: `wh-used-${isolatedUsedBy.slice(0, 8)}@test.local`,
        passwordHash: 'x',
        firstName: 'Wh',
        lastName: 'Used',
      },
    });
    await prisma.inventoryItem.create({
      data: {
        id: isolatedItem,
        tenantId: isolatedTenant,
        sku: `SKU-${isolatedItem.slice(0, 6)}`,
        nameEn: 'No Warehouse Item',
        unit: 'unit',
        quantityOnHand: new Prisma.Decimal(10),
      },
    });
    const requestId = randomUUID();
    const lineId = randomUUID();
    await prisma.inventoryStockRequest.create({
      data: {
        id: requestId,
        tenantId: isolatedTenant,
        requestNumber: `REQ-${requestId.slice(0, 8)}`,
        requestType: 'DEPARTMENT',
        status: 'APPROVED',
        warehouseId: null,
        requestedBy: isolatedActor,
        approvedBy: isolatedActor,
        approvedAt: new Date(),
        lines: {
          create: [
            {
              id: lineId,
              tenantId: isolatedTenant,
              inventoryItemId: isolatedItem,
              quantityRequested: new Prisma.Decimal(2),
              quantityFulfilled: new Prisma.Decimal(0),
            },
          ],
        },
      },
    });

    const requestRepo = new PrismaStockRequestRepository(prisma as never);
    const itemRepo = {
      findById: async (tid: string, id: string) => {
        const row = await prisma.inventoryItem.findFirst({ where: { id, tenantId: tid } });
        return row ? { id: row.id, unit: row.unit } : null;
      },
    };
    const warehouseRepo = new PrismaInventoryWarehouseRepository(prisma as never);
    const handler = new FulfillStockRequestLineHandler(
      requestRepo,
      itemRepo as never,
      warehouseRepo,
      { resolve: async () => ({ tenantId: isolatedTenant, branchId: null }) } as never,
      posting,
      prisma as never,
    );

    await expect(
      handler.execute({
        lineId,
        quantity: 2,
        fulfilledBy: isolatedActor,
        usedByUserId: isolatedUsedBy,
      }),
    ).rejects.toThrow();

    expect(
      await prisma.inventoryWarehouse.count({ where: { tenantId: isolatedTenant } }),
    ).toBe(0);
    const line = await prisma.inventoryStockRequestLine.findUnique({ where: { id: lineId } });
    expect(Number(line!.quantityFulfilled)).toBe(0);
    const request = await prisma.inventoryStockRequest.findUnique({ where: { id: requestId } });
    expect(request!.status).toBe('APPROVED');
    expect(
      await prisma.inventoryUsageLedger.count({
        where: { tenantId: isolatedTenant },
      }),
    ).toBe(0);
  });
});
