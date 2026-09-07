/**
 * Wave C Round 4 E1 — real production billing path for inventory invoice link/unlink.
 * Distinct from C-INV-37, which only sets the session flag and updates the ledger directly.
 */
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  assertSafePlatformTestDatabaseUrl,
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
} from '../../auth/tests/platform-db-security.harness';
import { InventoryUsagePostingService } from '../application/services/inventory-usage-posting.service';
import { PrismaInvoiceRepository } from '../../billing/infrastructure/prisma-invoice.repository';
import { CancelInvoiceHandler } from '../../billing/application/handlers/cancel-invoice.handler';
import { Invoice } from '../../billing/domain/entities/invoice.entity';
import { PrismaService } from '../../../infrastructure/prisma.service';

jest.setTimeout(120_000);

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Wave C Round 4 real billing production path (postgres)', () => {
  const tenantId = randomUUID();
  const actorId = randomUUID();
  const usedBy = randomUUID();
  let prisma: ReturnType<typeof createPlatformDbSecurityClient>;
  let posting: InventoryUsagePostingService;
  let invoiceRepo: PrismaInvoiceRepository;
  let cancelHandler: CancelInvoiceHandler;
  let itemId: string;
  let warehouseId: string;
  let patientId: string;

  beforeAll(async () => {
    assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
    prisma = createPlatformDbSecurityClient();
    await prisma.$connect();
    await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;

    await prisma.tenant.create({
      data: { id: tenantId, name: 'WC R4 Bill', slug: `wc-r4-bill-${tenantId.slice(0, 8)}` },
    });
    patientId = randomUUID();
    await prisma.patient.create({
      data: { id: patientId, tenantId, firstName: 'Bill', lastName: 'Patient', phone: `+3${tenantId.slice(0, 10)}` },
    });
    await prisma.user.create({
      data: {
        id: actorId,
        tenantId,
        email: `r4-bill-${actorId.slice(0, 8)}@test.local`,
        passwordHash: 'x',
        firstName: 'Bill',
        lastName: 'Actor',
      },
    });
    await prisma.user.create({
      data: {
        id: usedBy,
        tenantId,
        email: `r4-bill-used-${usedBy.slice(0, 8)}@test.local`,
        passwordHash: 'x',
        firstName: 'Used',
        lastName: 'By',
      },
    });
    warehouseId = randomUUID();
    await prisma.inventoryWarehouse.create({
      data: {
        id: warehouseId,
        tenantId,
        code: 'BILL',
        nameEn: 'Bill WH',
        isDefault: true,
        isActive: true,
      },
    });
    itemId = randomUUID();
    await prisma.inventoryItem.create({
      data: {
        id: itemId,
        tenantId,
        sku: `BILL-${itemId.slice(0, 6)}`,
        nameEn: 'Bill Item',
        unit: 'unit',
        quantityOnHand: new Prisma.Decimal(20),
      },
    });
    await prisma.inventoryWarehouseStock.create({
      data: {
        id: randomUUID(),
        tenantId,
        warehouseId,
        inventoryItemId: itemId,
        quantityOnHand: new Prisma.Decimal(20),
      },
    });

    posting = new InventoryUsagePostingService(prisma as never);
    invoiceRepo = new PrismaInvoiceRepository(prisma as unknown as PrismaService);
    cancelHandler = new CancelInvoiceHandler(
      invoiceRepo,
      { resolve: async () => ({ tenantId, branchId: null }) } as never,
      { publish: async () => undefined } as never,
      prisma as unknown as PrismaService,
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('PrismaInvoiceRepository.save links usage in-txn; flag does not leak; cancel unlinks', async () => {
    const posted = await posting.postUsage({
      tenantId,
      inventoryItemId: itemId,
      quantity: 1,
      usageType: 'CLINICAL_CONSUMPTION',
      recordedByUserId: actorId,
      usedByUserId: usedBy,
      warehouseId,
      patientId,
    });
    const usageId = posted.lines[0].usageLedgerId;
    const before = await prisma.inventoryUsageLedger.findUnique({ where: { id: usageId } });
    expect(before?.invoiceId).toBeNull();
    expect(before?.quantityUsed.toNumber()).toBe(1);
    expect(before?.usedByUserId).toBe(usedBy);
    expect(before?.patientId).toBe(patientId);

    const invoice = Invoice.create({
      invoiceId: randomUUID(),
      tenantId,
      branchId: null,
      patientId,
      invoiceNumber: `INV-R4-${invoiceIdSlice()}`,
      invoiceDate: new Date(),
      lineItems: [{ description: 'usage', quantity: 1, unitPrice: 10 }],
    });
    const lineItemId = invoice.lineItems[0].itemId;

    await invoiceRepo.save(invoice, [{ consumptionId: usageId, lineItemId }]);

    const linked = await prisma.inventoryUsageLedger.findUnique({ where: { id: usageId } });
    expect(linked?.invoiceId).toBe(invoice.invoiceId);
    expect(linked?.invoiceLineItemId).toBe(lineItemId);
    expect(linked?.quantityUsed.toNumber()).toBe(1);
    expect(linked?.usedByUserId).toBe(usedBy);
    expect(linked?.patientId).toBe(patientId);
    expect(linked?.inventoryBatchId).toBe(before?.inventoryBatchId ?? null);

    const leaked = await prisma.$queryRaw<Array<{ v: string }>>`
      SELECT coalesce(current_setting('app.allow_inventory_usage_invoice_link', true), '') AS v
    `;
    expect(leaked[0].v).not.toBe('true');

    await prisma.$transaction(async (tx) => {
      const inner = await tx.$queryRaw<Array<{ v: string }>>`
        SELECT coalesce(current_setting('app.allow_inventory_usage_invoice_link', true), '') AS v
      `;
      expect(inner[0].v).not.toBe('true');
      await expect(
        tx.inventoryUsageLedger.update({
          where: { id: usageId },
          data: { invoiceId: null, invoiceLineItemId: null },
        }),
      ).rejects.toThrow(/invoice linkage|immutable|trusted billing/i);
    });

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.allow_inventory_usage_invoice_link', 'true', true)`;
      await expect(
        tx.inventoryUsageLedger.update({
          where: { id: usageId },
          data: { quantityUsed: new Prisma.Decimal(99) },
        }),
      ).rejects.toThrow();
      await expect(
        tx.inventoryUsageLedger.update({
          where: { id: usageId },
          data: { usedByUserId: actorId },
        }),
      ).rejects.toThrow();
      await expect(
        tx.inventoryUsageLedger.update({
          where: { id: usageId },
          data: { patientId: randomUUID() },
        }),
      ).rejects.toThrow();
    });

    const stillLinked = await prisma.inventoryUsageLedger.findUnique({ where: { id: usageId } });
    expect(stillLinked?.invoiceId).toBe(invoice.invoiceId);
    expect(stillLinked?.quantityUsed.toNumber()).toBe(1);

    await cancelHandler.execute({ invoiceId: invoice.invoiceId });
    const unlinked = await prisma.inventoryUsageLedger.findUnique({ where: { id: usageId } });
    expect(unlinked?.invoiceId).toBeNull();
    expect(unlinked?.invoiceLineItemId).toBeNull();
    expect(unlinked?.quantityUsed.toNumber()).toBe(1);
    expect(unlinked?.usedByUserId).toBe(usedBy);
    expect(unlinked?.patientId).toBe(patientId);

    const afterCancelFlag = await prisma.$queryRaw<Array<{ v: string }>>`
      SELECT coalesce(current_setting('app.allow_inventory_usage_invoice_link', true), '') AS v
    `;
    expect(afterCancelFlag[0].v).not.toBe('true');
  });
});

function invoiceIdSlice(): string {
  return randomUUID().slice(0, 8);
}
