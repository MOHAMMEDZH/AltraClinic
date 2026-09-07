/**
 * Wave C injectable specialization — C-INJ-01..12 (full).
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

const describeIf = platformDbSecurityEnabled() ? describe : describe.skip;

describeIf('Wave C injectable (postgres)', () => {
  const tenantId = randomUUID();
  const otherTenantId = randomUUID();
  const actorId = randomUUID();
  const usedBy = randomUUID();
  let prisma: Awaited<ReturnType<typeof createPlatformDbSecurityClient>>;
  let posting: InventoryUsagePostingService;
  let itemId: string;
  let warehouseId: string;
  let emptyWarehouseId: string;
  let batchId: string;

  beforeAll(async () => {
    assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
    prisma = await createPlatformDbSecurityClient();
    await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
    await prisma.tenant.create({
      data: { id: tenantId, name: 'WC Inj', slug: `wc-inj-${tenantId.slice(0, 8)}` },
    });
    await prisma.tenant.create({
      data: {
        id: otherTenantId,
        name: 'WC Inj Other',
        slug: `wc-inj-o-${otherTenantId.slice(0, 8)}`,
      },
    });
    warehouseId = randomUUID();
    emptyWarehouseId = randomUUID();
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
        id: emptyWarehouseId,
        tenantId,
        code: 'EMPTY',
        nameEn: 'Empty',
        isDefault: false,
        isActive: true,
      },
    });
    itemId = randomUUID();
    await prisma.inventoryItem.create({
      data: {
        id: itemId,
        tenantId,
        sku: `INJ-${itemId.slice(0, 6)}`,
        nameEn: 'Filler',
        unit: 'ml',
        quantityOnHand: new Prisma.Decimal(100),
      },
    });
    await prisma.inventoryWarehouseStock.create({
      data: {
        id: randomUUID(),
        tenantId,
        warehouseId,
        inventoryItemId: itemId,
        quantityOnHand: new Prisma.Decimal(100),
      },
    });
    await prisma.inventoryWarehouseStock.create({
      data: {
        id: randomUUID(),
        tenantId,
        warehouseId: emptyWarehouseId,
        inventoryItemId: itemId,
        quantityOnHand: new Prisma.Decimal(0),
      },
    });
    batchId = randomUUID();
    await prisma.inventoryBatch.create({
      data: {
        id: batchId,
        tenantId,
        inventoryItemId: itemId,
        lotNumber: 'LOT-1',
        quantityOnHand: new Prisma.Decimal(50),
        status: 'ACTIVE',
        expiryDate: new Date(Date.now() + 86400000 * 365),
      },
    });
    await prisma.user.create({
      data: {
        id: actorId,
        tenantId,
        email: `inj-actor-${actorId.slice(0, 8)}@test.local`,
        passwordHash: 'x',
        firstName: 'A',
        lastName: 'R',
      },
    });
    await prisma.user.create({
      data: {
        id: usedBy,
        tenantId,
        email: `inj-used-${usedBy.slice(0, 8)}@test.local`,
        passwordHash: 'x',
        firstName: 'U',
        lastName: 'B',
      },
    });
    // Injectable append-only trigger is applied via prisma/triggers.sql on booking_test.
    // Re-apply as single-statement CREATE OR REPLACE (Prisma forbids multi-statement raw).
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
    posting = new InventoryUsagePostingService(prisma as never);
  }, 120_000);

  afterAll(async () => {
    if (!prisma) return;
    try {
      await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
      await prisma.injectableUsageDetail
        .deleteMany({ where: { usageLedger: { tenantId } } })
        .catch(() => undefined);
      await prisma.inventoryWarehouseStock.deleteMany({ where: { tenantId } }).catch(() => undefined);
    } finally {
      await prisma.$disconnect().catch(() => undefined);
    }
  });

  it('C-INJ-RBAC — injectable payload without create permission is rejected with no ledger or detail row', async () => {
    const ledgerBefore = await prisma.inventoryUsageLedger.count({ where: { tenantId } });
    const detailBefore = await prisma.injectableUsageDetail.count();
    await expect(
      posting.postUsage({
        tenantId,
        inventoryItemId: itemId,
        quantity: 1,
        usageType: 'CLINICAL_CONSUMPTION',
        recordedByUserId: actorId,
        usedByUserId: usedBy,
        warehouseId,
        inventoryBatchId: batchId,
        injectable: { dose: 0.2, anatomicalSite: 'glabella' },
      }),
    ).rejects.toThrow(/clinical-injectable create permission/);
    const ledgerAfter = await prisma.inventoryUsageLedger.count({ where: { tenantId } });
    const detailAfter = await prisma.injectableUsageDetail.count();
    expect(ledgerAfter).toBe(ledgerBefore);
    expect(detailAfter).toBe(detailBefore);
  });

  it('C-INJ-01 — injectable usage points to existing InventoryUsageLedger', async () => {
    const result = await posting.postUsage({
      tenantId,
      inventoryItemId: itemId,
      quantity: 1,
      usageType: 'CLINICAL_CONSUMPTION',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      warehouseId,
      inventoryBatchId: batchId,
      hasInjectableCreatePermission: true,
      injectable: { dose: 0.5, anatomicalSite: 'glabella', notes: 'test' },
    });
    const detail = await prisma.injectableUsageDetail.findUnique({
      where: { usageLedgerId: result.lines[0].usageLedgerId },
    });
    expect(detail).toBeTruthy();
    const ledger = await prisma.inventoryUsageLedger.findUnique({
      where: { id: result.lines[0].usageLedgerId },
    });
    expect(ledger).toBeTruthy();
  });

  it('C-INJ-02 — multi-batch injectable creates detail per ledger line with proportional dose', async () => {
    await prisma.inventoryItem.update({
      where: { id: itemId },
      data: { quantityOnHand: new Prisma.Decimal(100) },
    });
    await prisma.inventoryWarehouseStock.updateMany({
      where: { tenantId, warehouseId, inventoryItemId: itemId },
      data: { quantityOnHand: new Prisma.Decimal(100) },
    });
    const b1 = randomUUID();
    const b2 = randomUUID();
    await prisma.inventoryBatch.create({
      data: {
        id: b1,
        tenantId,
        inventoryItemId: itemId,
        lotNumber: 'FIFO-1',
        quantityOnHand: new Prisma.Decimal(3),
        status: 'ACTIVE',
        expiryDate: new Date(Date.now() + 86400000 * 30),
        receivedAt: new Date(Date.now() - 10000),
      },
    });
    await prisma.inventoryBatch.create({
      data: {
        id: b2,
        tenantId,
        inventoryItemId: itemId,
        lotNumber: 'FIFO-2',
        quantityOnHand: new Prisma.Decimal(10),
        status: 'ACTIVE',
        expiryDate: new Date(Date.now() + 86400000 * 60),
        receivedAt: new Date(),
      },
    });
    const beforeQty = Number(
      (await prisma.inventoryItem.findUnique({ where: { id: itemId } }))!.quantityOnHand,
    );
    const result = await posting.postUsage({
      tenantId,
      inventoryItemId: itemId,
      quantity: 5,
      usageType: 'CLINICAL_CONSUMPTION',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      warehouseId,
      hasInjectableCreatePermission: true,
      injectable: { dose: 1.0, anatomicalSite: 'cheek' },
    });
    expect(result.lines.length).toBe(2);
    const details = await prisma.injectableUsageDetail.findMany({
      where: { usageLedgerId: { in: result.lines.map((l) => l.usageLedgerId) } },
    });
    expect(details.length).toBe(2);
    const doseSum = details.reduce((s, d) => s + Number(d.dose ?? 0), 0);
    expect(doseSum).toBeCloseTo(1.0, 5);
    const afterQty = Number(
      (await prisma.inventoryItem.findUnique({ where: { id: itemId } }))!.quantityOnHand,
    );
    expect(afterQty).toBe(beforeQty - 5);
  });

  it('C-INJ-02b — injectable detail update/delete rejected', async () => {
    const result = await posting.postUsage({
      tenantId,
      inventoryItemId: itemId,
      quantity: 1,
      usageType: 'CLINICAL_CONSUMPTION',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      warehouseId,
      inventoryBatchId: batchId,
      hasInjectableCreatePermission: true,
      injectable: { dose: 0.3, anatomicalSite: 'chin' },
    });
    const id = result.lines[0].usageLedgerId;
    await expect(
      prisma.injectableUsageDetail.update({
        where: { usageLedgerId: id },
        data: { dose: new Prisma.Decimal(9) },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.injectableUsageDetail.delete({ where: { usageLedgerId: id } }),
    ).rejects.toThrow();
  });

  it('C-INJ-03 — existing InventoryBatch is the only batch SoR', async () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../application/services/inventory-usage-posting.service.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/ProductBatchUsage|product_batch_usage/i);
    expect(src).toContain('inventory_batches');
    const result = await posting.postUsage({
      tenantId,
      inventoryItemId: itemId,
      quantity: 1,
      usageType: 'CLINICAL_CONSUMPTION',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      warehouseId,
      inventoryBatchId: batchId,
      hasInjectableCreatePermission: true,
      injectable: { dose: 0.2, anatomicalSite: 'lip' },
    });
    expect(result.lines[0].inventoryBatchId).toBe(batchId);
  });

  it('C-INJ-04 — injectable batch required when item is batch-controlled', async () => {
    const result = await posting.postUsage({
      tenantId,
      inventoryItemId: itemId,
      quantity: 1,
      usageType: 'CLINICAL_CONSUMPTION',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      warehouseId,
      hasInjectableCreatePermission: true,
      injectable: { dose: 0.1, anatomicalSite: 'cheek' },
    });
    expect(result.lines[0].inventoryBatchId).toBeTruthy();
  });

  it('C-INJ-05 — expired/recalled injectable batch denied', async () => {
    const expired = randomUUID();
    const recalled = randomUUID();
    await prisma.inventoryBatch.create({
      data: {
        id: expired,
        tenantId,
        inventoryItemId: itemId,
        lotNumber: 'EXP',
        quantityOnHand: new Prisma.Decimal(5),
        status: 'ACTIVE',
        expiryDate: new Date(Date.now() - 86400000),
      },
    });
    await prisma.inventoryBatch.create({
      data: {
        id: recalled,
        tenantId,
        inventoryItemId: itemId,
        lotNumber: 'RECALL',
        quantityOnHand: new Prisma.Decimal(5),
        status: 'ACTIVE',
        recalled: true,
        recalledAt: new Date(),
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
        inventoryBatchId: expired,
        hasInjectableCreatePermission: true,
        injectable: { dose: 0.1 },
      }),
    ).rejects.toThrow(/Expired/);
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
        hasInjectableCreatePermission: true,
        injectable: { dose: 0.1 },
      }),
    ).rejects.toThrow(/Recalled/);
  });

  it('C-INJ-06 — cross-tenant injectable batch denied', async () => {
    const foreignItem = randomUUID();
    const foreignBatch = randomUUID();
    await prisma.inventoryItem.create({
      data: {
        id: foreignItem,
        tenantId: otherTenantId,
        sku: `FX-${foreignItem.slice(0, 6)}`,
        nameEn: 'Foreign',
        unit: 'ml',
        quantityOnHand: new Prisma.Decimal(10),
      },
    });
    await prisma.inventoryBatch.create({
      data: {
        id: foreignBatch,
        tenantId: otherTenantId,
        inventoryItemId: foreignItem,
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
        hasInjectableCreatePermission: true,
        injectable: { dose: 0.1 },
      }),
    ).rejects.toThrow(/Requested batch not available/);
  });

  it('C-INJ-07 — wrong branch/warehouse injectable batch denied', async () => {
    await expect(
      posting.postUsage({
        tenantId,
        inventoryItemId: itemId,
        quantity: 1,
        usageType: 'CLINICAL_CONSUMPTION',
        recordedByUserId: actorId,
        usedByUserId: usedBy,
        warehouseId: emptyWarehouseId,
        inventoryBatchId: batchId,
        hasInjectableCreatePermission: true,
        injectable: { dose: 0.1 },
      }),
    ).rejects.toThrow(/Insufficient stock/);
  });

  it('C-INJ-08 — dose/site/treatment detail remains linked 1:1 to usage event', async () => {
    const result = await posting.postUsage({
      tenantId,
      inventoryItemId: itemId,
      quantity: 1,
      usageType: 'CLINICAL_CONSUMPTION',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      warehouseId,
      inventoryBatchId: batchId,
      hasInjectableCreatePermission: true,
      injectable: { dose: 0.75, anatomicalSite: 'jawline', notes: '1:1' },
    });
    const detail = await prisma.injectableUsageDetail.findUnique({
      where: { usageLedgerId: result.lines[0].usageLedgerId },
    });
    expect(detail?.anatomicalSite).toBe('jawline');
    expect(Number(detail?.dose)).toBe(0.75);
    const count = await prisma.injectableUsageDetail.count({
      where: { usageLedgerId: result.lines[0].usageLedgerId },
    });
    expect(count).toBe(1);
  });

  it('C-INJ-09 — history remains readable after batch deactivation', async () => {
    const depleteBatch = randomUUID();
    await prisma.inventoryBatch.create({
      data: {
        id: depleteBatch,
        tenantId,
        inventoryItemId: itemId,
        lotNumber: 'DEP',
        quantityOnHand: new Prisma.Decimal(1),
        status: 'ACTIVE',
        expiryDate: new Date(Date.now() + 86400000 * 60),
      },
    });
    const result = await posting.postUsage({
      tenantId,
      inventoryItemId: itemId,
      quantity: 1,
      usageType: 'CLINICAL_CONSUMPTION',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      warehouseId,
      inventoryBatchId: depleteBatch,
      hasInjectableCreatePermission: true,
      injectable: { dose: 0.3, anatomicalSite: 'chin' },
    });
    const batch = await prisma.inventoryBatch.findUnique({ where: { id: depleteBatch } });
    expect(batch?.status).toBe('DEPLETED');
    const detail = await prisma.injectableUsageDetail.findUnique({
      where: { usageLedgerId: result.lines[0].usageLedgerId },
    });
    expect(detail).toBeTruthy();
    const ledger = await prisma.inventoryUsageLedger.findUnique({
      where: { id: result.lines[0].usageLedgerId },
    });
    expect(ledger?.inventoryBatchId).toBe(depleteBatch);
  });

  it('C-INJ-10 — insufficient batch quantity rolls back treatment usage post', async () => {
    const tiny = randomUUID();
    await prisma.inventoryBatch.create({
      data: {
        id: tiny,
        tenantId,
        inventoryItemId: itemId,
        lotNumber: 'TINY',
        quantityOnHand: new Prisma.Decimal(0.5),
        status: 'ACTIVE',
        expiryDate: new Date(Date.now() + 86400000 * 20),
      },
    });
    const before = Number((await prisma.inventoryItem.findUnique({ where: { id: itemId } }))!.quantityOnHand);
    await expect(
      posting.postUsage({
        tenantId,
        inventoryItemId: itemId,
        quantity: 2,
        usageType: 'CLINICAL_CONSUMPTION',
        recordedByUserId: actorId,
        usedByUserId: usedBy,
        warehouseId,
        inventoryBatchId: tiny,
        hasInjectableCreatePermission: true,
      injectable: { dose: 2, anatomicalSite: 'test' },
      }),
    ).rejects.toThrow(/Insufficient quantity on requested batch/);
    const after = Number((await prisma.inventoryItem.findUnique({ where: { id: itemId } }))!.quantityOnHand);
    expect(after).toBe(before);
    const orphan = await prisma.injectableUsageDetail.count({
      where: { anatomicalSite: 'test', dose: new Prisma.Decimal(2) },
    });
    expect(orphan).toBe(0);
  });

  it('C-INJ-11 — actor/usedBy semantics preserved on injectable recording', async () => {
    const result = await posting.postUsage({
      tenantId,
      inventoryItemId: itemId,
      quantity: 1,
      usageType: 'CLINICAL_CONSUMPTION',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      warehouseId,
      inventoryBatchId: batchId,
      hasInjectableCreatePermission: true,
      injectable: { dose: 0.15, anatomicalSite: 'forehead' },
    });
    const usage = await prisma.inventoryUsageLedger.findUnique({
      where: { id: result.lines[0].usageLedgerId },
    });
    expect(usage?.recordedByUserId).toBe(actorId);
    expect(usage?.usedByUserId).toBe(usedBy);
  });

  it('C-INJ-12 — posting audit entry records usage ids without PHI dump', async () => {
    const { AuditTrailInventoryAuditLog } = await import(
      '../infrastructure/audit-trail-inventory-audit-log'
    );
    const audit = new AuditTrailInventoryAuditLog(prisma as never);
    const auditedPosting = new InventoryUsagePostingService(prisma as never, audit);
    const result = await auditedPosting.postUsage({
      tenantId,
      inventoryItemId: itemId,
      quantity: 1,
      usageType: 'CLINICAL_CONSUMPTION',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      warehouseId,
      inventoryBatchId: batchId,
      hasInjectableCreatePermission: true,
      injectable: { dose: 0.1, anatomicalSite: 'temple', notes: 'site-note' },
    });
    const entries = await prisma.auditEntry.findMany({
      where: {
        tenantId,
        action: { startsWith: 'inventory.usage.' },
        resourceId: result.lines[0].usageLedgerId,
      },
    });
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].actorId).toBe(actorId);
    const details = JSON.stringify(entries[0].details ?? {});
    expect(details).toContain(itemId);
    expect(details).not.toMatch(/patientName|ssn|nationalId/i);
  });
});
