/**
 * Wave D Round 2 — dental consume production-path (handler chain → InventoryUsageLedger).
 */
import { randomUUID } from 'crypto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  createClinicalPrismaWrapper,
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
} from '../../clinical-catalog/tests/clinical-catalog-db.harness';
import { ConsumeDentalMaterialHandler } from '../application/handlers/dental-material.handlers';
import { ConsumeInventoryHandler } from '../../inventory/application/handlers/consume-inventory.handler';
import { InventoryUsagePostingService } from '../../inventory/application/services/inventory-usage-posting.service';
import { PrismaPatientRepository } from '../../patients/infrastructure/prisma-patient.repository';
import { InventoryItem } from '../../inventory/domain/entities/inventory-item.entity';
import { LocalizedText } from '../../inventory/domain/value-objects/localized-text.vo';
import { PrismaService } from '../../../infrastructure/prisma.service';

jest.setTimeout(180_000);
const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Wave D dental consume production path (PostgreSQL)', () => {
  let prisma: Awaited<ReturnType<typeof createPlatformDbSecurityClient>>;
  let wrapper: ReturnType<typeof createClinicalPrismaWrapper>;
  let tenantId: string;
  let otherTenantId: string;
  let actorId: string;
  let usedById: string;
  let patientId: string;
  let itemId: string;
  let warehouseId: string;
  let appointmentId: string;
  let foreignAppointmentId: string;
  let clinicalServiceId: string;
  let foreignClinicalServiceId: string;
  let consumeDental: ConsumeDentalMaterialHandler;
  let auditCalls: Array<Record<string, unknown>> = [];
  let prismaSvc: PrismaService;

  function buildHandler(client: typeof prisma = prisma) {
    prismaSvc = Object.assign(client, {
      withPlatformBypass: <T>(fn: (c: typeof prisma) => Promise<T>) =>
        wrapper.withPlatformBypass(fn),
    }) as unknown as PrismaService;
    const itemRepo = {
      findById: async (tid: string, id: string) => {
        const row = await client.inventoryItem.findFirst({
          where: { id, tenantId: tid, deletedAt: null },
        });
        if (!row) return null;
        return InventoryItem.restore({
          itemId: row.id,
          tenantId: row.tenantId,
          branchId: row.branchId,
          categoryId: row.categoryId,
          sku: row.sku,
          barcode: row.barcode,
          brand: row.brand,
          name: new LocalizedText(row.nameEn, row.nameAr),
          unit: row.unit,
          quantityOnHand: row.quantityOnHand.toNumber(),
          reorderThreshold: row.reorderThreshold.toNumber(),
          minQuantity: row.minQuantity?.toNumber() ?? null,
          maxQuantity: row.maxQuantity?.toNumber() ?? null,
          costPerUnit: row.costPerUnit?.toNumber() ?? null,
          sellingPrice: row.sellingPrice?.toNumber() ?? null,
          storageLocation: row.storageLocation,
          lotNumber: row.lotNumber,
          expiryDate: row.expiryDate,
          supplierId: row.supplierId,
          archivedAt: row.deletedAt,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        });
      },
    };
    const warehouseRepo = {
      ensureDefaultWarehouseId: async (tid: string) => warehouseId,
      existsActive: async (tid: string, wid: string) => {
        const row = await client.inventoryWarehouse.findFirst({
          where: { id: wid, tenantId: tid, isActive: true, deletedAt: null },
        });
        return !!row;
      },
    };
    const posting = new InventoryUsagePostingService(prismaSvc, {
      recordInTransaction: async (_tx: unknown, e: Record<string, unknown>) => {
        auditCalls.push(e);
      },
    } as never);
    const consumeInventory = new ConsumeInventoryHandler(
      itemRepo as never,
      warehouseRepo as never,
      { resolve: async () => ({ tenantId, branchId: null, locale: 'en' }) } as never,
      { publish: async () => undefined } as never,
      posting,
    );
    return new ConsumeDentalMaterialHandler(
      new PrismaPatientRepository(prismaSvc),
      { resolve: async () => ({ tenantId, branchId: null, locale: 'en' }) } as never,
      consumeInventory,
    );
  }

  async function seedStock(qty = 100) {
    await prisma.inventoryItem.update({
      where: { id: itemId },
      data: { quantityOnHand: new Prisma.Decimal(qty) },
    });
    await prisma.inventoryWarehouseStock.updateMany({
      where: { tenantId, warehouseId, inventoryItemId: itemId },
      data: { quantityOnHand: new Prisma.Decimal(qty) },
    });
  }

  beforeAll(async () => {
    prisma = await createPlatformDbSecurityClient();
    await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
    wrapper = createClinicalPrismaWrapper(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    auditCalls = [];
    tenantId = randomUUID();
    otherTenantId = randomUUID();
    actorId = randomUUID();
    usedById = randomUUID();
    patientId = randomUUID();
    itemId = randomUUID();
    warehouseId = randomUUID();
    appointmentId = randomUUID();
    foreignAppointmentId = randomUUID();
    clinicalServiceId = randomUUID();
    foreignClinicalServiceId = randomUUID();
    consumeDental = buildHandler();

    await wrapper.withPlatformBypass(async (c) => {
      await c.tenant.createMany({
        data: [
          { id: tenantId, name: 'WD Consume', slug: `wd-consume-${tenantId.slice(0, 8)}` },
          { id: otherTenantId, name: 'WD Consume O', slug: `wd-consume-o-${otherTenantId.slice(0, 8)}` },
        ],
      });
      await c.user.createMany({
        data: [
          {
            id: actorId,
            tenantId,
            email: `wd-consume-${actorId.slice(0, 8)}@t.local`,
            passwordHash: 'x',
            firstName: 'Actor',
            lastName: 'Rec',
          },
          {
            id: usedById,
            tenantId,
            email: `wd-used-${usedById.slice(0, 8)}@t.local`,
            passwordHash: 'x',
            firstName: 'Used',
            lastName: 'By',
          },
        ],
      });
      await c.patient.create({
        data: { id: patientId, tenantId, firstName: 'Dental', lastName: 'Pat' },
      });
      await c.inventoryWarehouse.create({
        data: {
          id: warehouseId,
          tenantId,
          code: 'MAIN',
          nameEn: 'Main',
          isDefault: true,
          isActive: true,
        },
      });
      await c.inventoryItem.create({
        data: {
          id: itemId,
          tenantId,
          sku: `WD-${itemId.slice(0, 8)}`,
          nameEn: 'Composite',
          nameAr: 'Composite',
          unit: 'each',
          quantityOnHand: 100,
          reorderThreshold: 0,
        },
      });
      await c.inventoryWarehouseStock.create({
        data: {
          id: randomUUID(),
          tenantId,
          warehouseId,
          inventoryItemId: itemId,
          quantityOnHand: 100,
        },
      });
      await c.canonicalClinicalServiceDefinition.create({
        data: {
          id: clinicalServiceId,
          tenantId,
          provenance: 'TENANT_CUSTOM',
          stableKey: `tenant.${tenantId}.custom.wd-consume`,
          domain: 'DENTAL',
          lifecycle: 'PUBLISHED',
        },
      });
      await c.canonicalClinicalServiceDefinition.create({
        data: {
          id: foreignClinicalServiceId,
          tenantId: otherTenantId,
          provenance: 'TENANT_CUSTOM',
          stableKey: `tenant.${otherTenantId}.custom.wd-consume`,
          domain: 'DENTAL',
          lifecycle: 'PUBLISHED',
        },
      });
      await c.appointment.create({
        data: {
          id: appointmentId,
          tenantId,
          patientId,
          providerId: actorId,
          clinicalServiceId,
          scheduledStart: new Date('2026-09-01T10:00:00.000Z'),
          scheduledEnd: new Date('2026-09-01T11:00:00.000Z'),
        },
      });
      const foreignPatient = randomUUID();
      await c.patient.create({
        data: { id: foreignPatient, tenantId: otherTenantId, firstName: 'Foreign', lastName: 'P' },
      });
      await c.appointment.create({
        data: {
          id: foreignAppointmentId,
          tenantId: otherTenantId,
          patientId: foreignPatient,
          providerId: randomUUID(),
          scheduledStart: new Date('2026-09-01T12:00:00.000Z'),
          scheduledEnd: new Date('2026-09-01T13:00:00.000Z'),
        },
      });
    });
    await seedStock();
  });

  it('valid consume with appointmentId writes InventoryUsageLedger and preserves accountability', async () => {
    const result = await consumeDental.execute(patientId, {
      itemId,
      quantity: 2,
      procedureCode: 'D2740',
      appointmentId,
      clinicalServiceId,
      consumedBy: actorId,
      usedByUserId: usedById,
    });
    expect(result.usageLedgerIds.length).toBeGreaterThan(0);
    const ledger = await prisma.inventoryUsageLedger.findFirstOrThrow({
      where: { id: result.usageLedgerIds[0] },
    });
    expect(ledger.appointmentId).toBe(appointmentId);
    expect(ledger.clinicalServiceId).toBe(clinicalServiceId);
    expect(ledger.usedByUserId).toBe(usedById);
    expect(ledger.recordedByUserId).toBe(actorId);
    expect(ledger.usedByUserId).not.toBe(actorId);
    const altTables = await prisma.$queryRaw<Array<{ relname: string }>>`
      SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND c.relname ILIKE ANY (ARRAY['%dental%usage%', '%procedure%usage%'])
        AND c.relname <> 'inventory_consumption_logs'
    `;
    expect(altTables).toHaveLength(0);
  });

  it('unknown and cross-tenant appointmentId reject with no stock or ledger mutation', async () => {
    const before = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemId } });
    for (const badAppt of [randomUUID(), foreignAppointmentId]) {
      await expect(
        consumeDental.execute(patientId, {
          itemId,
          quantity: 1,
          appointmentId: badAppt,
          consumedBy: actorId,
          usedByUserId: usedById,
        }),
      ).rejects.toThrow();
    }
    const after = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemId } });
    expect(after.quantityOnHand.toNumber()).toBe(before.quantityOnHand.toNumber());
    expect(await prisma.inventoryUsageLedger.count({ where: { tenantId, inventoryItemId: itemId } })).toBe(0);
    expect(auditCalls).toHaveLength(0);
  });

  it('unknown and cross-tenant clinicalServiceId reject with no mutation', async () => {
    const before = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemId } });
    for (const badSvc of [randomUUID(), foreignClinicalServiceId]) {
      await expect(
        consumeDental.execute(patientId, {
          itemId,
          quantity: 1,
          clinicalServiceId: badSvc,
          consumedBy: actorId,
          usedByUserId: usedById,
        }),
      ).rejects.toThrow();
    }
    const after = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemId } });
    expect(after.quantityOnHand.toNumber()).toBe(before.quantityOnHand.toNumber());
  });

  it('mismatched appointment clinicalServiceId rejects', async () => {
    const otherSvc = randomUUID();
    await wrapper.withPlatformBypass((c) =>
      c.canonicalClinicalServiceDefinition.create({
        data: {
          id: otherSvc,
          tenantId,
          provenance: 'TENANT_CUSTOM',
          stableKey: `tenant.${tenantId}.custom.mismatch`,
          domain: 'DENTAL',
          lifecycle: 'PUBLISHED',
        },
      }),
    );
    await expect(
      consumeDental.execute(patientId, {
        itemId,
        quantity: 1,
        appointmentId,
        clinicalServiceId: otherSvc,
        consumedBy: actorId,
        usedByUserId: usedById,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('usedByUserId is required and never inferred from recorder', async () => {
    await expect(
      consumeDental.execute(patientId, {
        itemId,
        quantity: 1,
        consumedBy: actorId,
        usedByUserId: '',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      consumeDental.execute(patientId, {
        itemId,
        quantity: 1,
        consumedBy: actorId,
        usedByUserId: randomUUID(),
      }),
    ).rejects.toThrow();
  });

  it('forced downstream failure rolls stock and ledger back', async () => {
    const failingPrisma = new Proxy(prisma, {
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
                          throw new Error('forced dental consume ledger failure');
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
    wrapper = createClinicalPrismaWrapper(failingPrisma);
    consumeDental = buildHandler(failingPrisma);
    const before = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemId } });
    await expect(
      consumeDental.execute(patientId, {
        itemId,
        quantity: 3,
        appointmentId,
        consumedBy: actorId,
        usedByUserId: usedById,
      }),
    ).rejects.toThrow(/forced dental consume ledger failure/);
    const after = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemId } });
    expect(after.quantityOnHand.toNumber()).toBe(before.quantityOnHand.toNumber());
    expect(await prisma.inventoryUsageLedger.count({ where: { tenantId, inventoryItemId: itemId } })).toBe(0);
  });

  it('unknown patient rejects at handler boundary', async () => {
    await expect(
      consumeDental.execute(randomUUID(), {
        itemId,
        quantity: 1,
        consumedBy: actorId,
        usedByUserId: usedById,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
