/**
 * WAVE-A-PA-02 — REAL concurrent ClinicalServicePriceVersion publish against PostgreSQL.
 * Exercises ClinicalPriceVersionService.publish with real Prisma transactions and
 * pg_advisory_xact_lock (not mocked).
 *
 * Run:
 *   ALLOW_TEST_DATABASE_RESET=true RUN_PLATFORM_DB_SECURITY=true \
 *   npx jest --runInBand src/modules/clinical-catalog/tests/clinical-price.concurrency.postgres.integration.spec.ts
 */
import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { ClinicalPriceVersionService } from '../application/clinical-price-version.service';
import { ClinicalCatalogConflictError } from '../domain/clinical-catalog.errors';
import {
  cleanupWaveAFixtures,
  createClinicalPrismaWrapper,
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
} from './clinical-catalog-db.harness';
import { FakeClinicalCatalogAuditLog } from './support/fake-clinical-catalog-audit-log';

jest.setTimeout(180_000);

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Wave A PriceVersion concurrent publish (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let tenantId: string;
  let branchId: string;
  let serviceId: string;
  let otherServiceId: string;

  beforeAll(async () => {
    prisma = createPlatformDbSecurityClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    if (tenantId) {
      await cleanupWaveAFixtures(prisma, [tenantId]).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    if (tenantId) {
      await cleanupWaveAFixtures(prisma, [tenantId]).catch(() => undefined);
    }
    tenantId = randomUUID();
    const wrapper = createClinicalPrismaWrapper(prisma);
    await wrapper.withPlatformBypass(async (client) => {
      await client.tenant.create({
        data: {
          id: tenantId,
          name: 'WaveA Price Race Tenant',
          slug: `wa-price-${tenantId.slice(0, 8)}`,
          features: {},
        },
      });
      const branch = await client.branch.create({
        data: { tenantId, name: 'Main Branch', isActive: true },
      });
      branchId = branch.id;

      const canonical = await client.canonicalClinicalServiceDefinition.create({
        data: {
          tenantId: null,
          provenance: 'SYSTEM_CANONICAL',
          stableKey: `canonical.general.race_${tenantId.slice(0, 8)}`,
          domain: 'GENERAL',
          lifecycle: 'PUBLISHED',
          publishedAt: new Date(),
          translations: {
            create: [
              { locale: 'en', displayName: 'Race Service' },
              { locale: 'ar', displayName: 'خدمة سباق' },
            ],
          },
        },
      });
      serviceId = canonical.id;

      const other = await client.canonicalClinicalServiceDefinition.create({
        data: {
          tenantId: null,
          provenance: 'SYSTEM_CANONICAL',
          stableKey: `canonical.general.other_${tenantId.slice(0, 8)}`,
          domain: 'GENERAL',
          lifecycle: 'PUBLISHED',
          publishedAt: new Date(),
          translations: {
            create: [
              { locale: 'en', displayName: 'Other Service' },
              { locale: 'ar', displayName: 'خدمة أخرى' },
            ],
          },
        },
      });
      otherServiceId = other.id;
    });
  });

  function priceService(): ClinicalPriceVersionService {
    return new ClinicalPriceVersionService(
      createClinicalPrismaWrapper(prisma) as never,
      new FakeClinicalCatalogAuditLog() as never,
    );
  }

  function actor() {
    return {
      actorId: randomUUID(),
      actorRoles: ['owner'],
      tenantId,
      isPlatform: false,
    };
  }

  async function countActive(clinicalServiceId: string, branchScope: string | null) {
    return createClinicalPrismaWrapper(prisma).withPlatformBypass((client) =>
      client.clinicalServicePriceVersion.count({
        where: {
          tenantId,
          clinicalServiceId,
          branchId: branchScope,
          status: 'ACTIVE',
        },
      }),
    );
  }

  async function listActive(clinicalServiceId: string, branchScope: string | null) {
    return createClinicalPrismaWrapper(prisma).withPlatformBypass((client) =>
      client.clinicalServicePriceVersion.findMany({
        where: {
          tenantId,
          clinicalServiceId,
          branchId: branchScope,
          status: 'ACTIVE',
        },
      }),
    );
  }

  it('Case A/B — concurrent double-publish of same tenant-default draft: exactly one ACTIVE', async () => {
    const prices = priceService();
    const a = actor();
    const draft = await prices.createDraft(a, {
      clinicalServiceId: serviceId,
      currency: 'SYP',
      unitPrice: 100,
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      pricingUnit: 'PER_VISIT',
    });

    const dual = await Promise.allSettled([
      prices.publish(a, draft.id),
      prices.publish(a, draft.id),
    ]);
    expect(dual.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(dual.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(await countActive(serviceId, null)).toBe(1);
  });

  it('Case A/B — concurrent createDraft+publish pipelines for tenant-default key keep ≤1 ACTIVE', async () => {
    const prices = priceService();
    const a = actor();
    const from = new Date('2026-03-01T00:00:00.000Z').toISOString();

    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });

    const worker = async (unitPrice: number) => {
      await barrier;
      const draft = await prices.createDraft(a, {
        clinicalServiceId: serviceId,
        currency: 'SYP',
        unitPrice,
        effectiveFrom: from,
        pricingUnit: 'PER_VISIT',
      });
      return prices.publish(a, draft.id);
    };

    const pending = Promise.allSettled([worker(111), worker(222)]);
    release();
    const settled = await pending;
    const ok = settled.filter((r) => r.status === 'fulfilled');
    expect(ok.length).toBe(1);
    expect(await countActive(serviceId, null)).toBe(1);
  });

  it('Case A — concurrent future schedule after ACTIVE baseline: one SCHEDULED, prior ACTIVE immutable, no ACTIVE overlap', async () => {
    const prices = priceService();
    const a = actor();
    const base = await prices.createDraft(a, {
      clinicalServiceId: serviceId,
      currency: 'SYP',
      unitPrice: 50,
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      pricingUnit: 'PER_VISIT',
    });
    await prices.publish(a, base.id);

    const startFrom = new Date(Date.now() + 40 * 24 * 3600 * 1000).toISOString();
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });

    const worker = async (unitPrice: number) => {
      await barrier;
      const draft = await prices.createDraft(a, {
        clinicalServiceId: serviceId,
        currency: 'SYP',
        unitPrice,
        effectiveFrom: startFrom,
        pricingUnit: 'PER_VISIT',
      });
      return prices.publish(a, draft.id);
    };

    const pending = Promise.allSettled([worker(501), worker(502)]);
    release();
    const settled = await pending;
    expect(settled.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

    const actives = await listActive(serviceId, null);
    expect(actives).toHaveLength(1);
    expect(actives[0].id).toBe(base.id);
    expect(actives[0].effectiveTo).toBeNull();

    const scheduled = await createClinicalPrismaWrapper(prisma).withPlatformBypass((client) =>
      client.clinicalServicePriceVersion.findMany({
        where: { tenantId, clinicalServiceId: serviceId, status: 'SCHEDULED' },
      }),
    );
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].effectiveFrom.toISOString()).toBe(startFrom);

    const dims = { pricingUnit: 'PER_VISIT' as const, currency: 'SYP', serviceVariantId: null };
    const before = await prices.lookupActivePrice(a, serviceId, null, dims);
    expect(before.price.id).toBe(base.id);

    // Activate due schedule via backdate + live lookup (no future `at` mutation).
    await createClinicalPrismaWrapper(prisma).withPlatformBypass(async (client) => {
      await client.clinicalServicePriceVersion.update({
        where: { id: scheduled[0].id },
        data: { effectiveFrom: new Date(Date.now() - 60_000) },
      });
    });
    const after = await prices.lookupActivePrice(a, serviceId, null, dims);
    expect(after.price.id).toBe(scheduled[0].id);
  });

  it('Case C — branch-specific commercial key concurrent double-publish', async () => {
    const prices = priceService();
    const a = actor();
    const draft = await prices.createDraft(a, {
      clinicalServiceId: serviceId,
      branchId,
      currency: 'SYP',
      unitPrice: 80,
      effectiveFrom: new Date('2026-04-01T00:00:00.000Z').toISOString(),
      pricingUnit: 'PER_VISIT',
    });

    const dual = await Promise.allSettled([
      prices.publish(a, draft.id),
      prices.publish(a, draft.id),
    ]);
    expect(dual.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await countActive(serviceId, branchId)).toBe(1);
    expect(await countActive(serviceId, null)).toBe(0);
  });

  it('Case D — concurrent publish for different commercial keys both succeed', async () => {
    const prices = priceService();
    const a = actor();
    const from = new Date('2026-05-01T00:00:00.000Z').toISOString();

    const d1 = await prices.createDraft(a, {
      clinicalServiceId: serviceId,
      currency: 'SYP',
      unitPrice: 10,
      effectiveFrom: from,
      pricingUnit: 'PER_VISIT',
    });
    const d2 = await prices.createDraft(a, {
      clinicalServiceId: otherServiceId,
      currency: 'SYP',
      unitPrice: 20,
      effectiveFrom: from,
      pricingUnit: 'PER_VISIT',
    });

    const dual = await Promise.allSettled([
      prices.publish(a, d1.id),
      prices.publish(a, d2.id),
    ]);
    expect(dual.every((r) => r.status === 'fulfilled')).toBe(true);
    expect(await countActive(serviceId, null)).toBe(1);
    expect(await countActive(otherServiceId, null)).toBe(1);
  });

  it('commercial lock key matches overlap identity fields', () => {
    const prices = priceService();
    expect(
      prices.commercialLockKey({
        tenantId,
        branchId: null,
        clinicalServiceId: serviceId,
        pricingUnit: 'PER_VISIT',
        currency: 'syp',
        serviceVariantId: null,
      }),
    ).toBe(`clinical-price|${tenantId}|default|${serviceId}|PER_VISIT|SYP|`);

    const branchKey = prices.commercialLockKey({
      tenantId,
      branchId,
      clinicalServiceId: serviceId,
      pricingUnit: 'PER_VISIT',
      currency: 'SYP',
      serviceVariantId: null,
    });
    expect(branchKey).toContain(`|${branchId}|`);
    expect(branchKey).not.toContain('|default|');
  });

  it('same effectiveFrom overlap against ACTIVE fails closed (no second ACTIVE)', async () => {
    const prices = priceService();
    const a = actor();
    const d = await prices.createDraft(a, {
      clinicalServiceId: serviceId,
      currency: 'SYP',
      unitPrice: 1,
      effectiveFrom: new Date('2026-07-01T00:00:00.000Z').toISOString(),
      pricingUnit: 'PER_VISIT',
    });
    await prices.publish(a, d.id);

    const d2 = await prices.createDraft(a, {
      clinicalServiceId: serviceId,
      currency: 'SYP',
      unitPrice: 2,
      effectiveFrom: new Date('2026-07-01T00:00:00.000Z').toISOString(),
      pricingUnit: 'PER_VISIT',
    });
    await expect(prices.publish(a, d2.id)).rejects.toBeInstanceOf(ClinicalCatalogConflictError);
    expect(await countActive(serviceId, null)).toBe(1);
  });

  it('PA-04 — future schedule preserves current price, prior immutable, ACTIVE overlap = 0', async () => {
    const prices = priceService();
    const a = actor();
    const now = new Date();
    const t15 = new Date(now.getTime() + 15 * 24 * 3600 * 1000);
    const t30 = new Date(now.getTime() + 30 * 24 * 3600 * 1000);

    const current = await prices.createDraft(a, {
      clinicalServiceId: serviceId,
      currency: 'SYP',
      unitPrice: 100,
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      pricingUnit: 'PER_VISIT',
    });
    await prices.publish(a, current.id);
    const beforePublish = await createClinicalPrismaWrapper(prisma).withPlatformBypass((client) =>
      client.clinicalServicePriceVersion.findUniqueOrThrow({ where: { id: current.id } }),
    );

    const future = await prices.createDraft(a, {
      clinicalServiceId: serviceId,
      currency: 'SYP',
      unitPrice: 150,
      effectiveFrom: t30.toISOString(),
      pricingUnit: 'PER_VISIT',
    });
    const scheduled = await prices.publish(a, future.id);
    expect(scheduled.status).toBe('SCHEDULED');

    const afterPublish = await createClinicalPrismaWrapper(prisma).withPlatformBypass((client) =>
      client.clinicalServicePriceVersion.findUniqueOrThrow({ where: { id: current.id } }),
    );
    expect(afterPublish.effectiveTo).toEqual(beforePublish.effectiveTo);
    expect(String(afterPublish.unitPrice)).toBe(String(beforePublish.unitPrice));
    expect(afterPublish.currency).toBe(beforePublish.currency);
    expect(afterPublish.pricingUnit).toBe(beforePublish.pricingUnit);
    expect(afterPublish.effectiveFrom.toISOString()).toBe(beforePublish.effectiveFrom.toISOString());
    expect(afterPublish.status).toBe('ACTIVE');

    expect(await countActive(serviceId, null)).toBe(1);

    const dims = { pricingUnit: 'PER_VISIT' as const, currency: 'SYP', serviceVariantId: null };
    const live = await prices.lookupActivePrice(a, serviceId, null, dims);
    expect(live.price.id).toBe(current.id);

    await expect(
      prices.lookupActivePrice(a, serviceId, null, { ...dims, at: t15 }),
    ).rejects.toBeTruthy();
    await expect(
      prices.lookupActivePrice(a, serviceId, null, { ...dims, at: t30 }),
    ).rejects.toBeTruthy();

    const historical = await prices.lookupActivePrice(a, serviceId, null, {
      ...dims,
      at: new Date('2026-06-01T00:00:00.000Z'),
    });
    expect(historical.price.id).toBe(current.id);

    // Due activation via backdate + live (no future at)
    await createClinicalPrismaWrapper(prisma).withPlatformBypass(async (client) => {
      await client.clinicalServicePriceVersion.update({
        where: { id: future.id },
        data: { effectiveFrom: new Date(Date.now() - 30_000) },
      });
    });
    const activated = await prices.lookupActivePrice(a, serviceId, null, dims);
    expect(activated.price.id).toBe(future.id);
    expect(Number(activated.price.unitPrice)).toBe(150);
  });

  it('PA-04-D — schedule chain V1 ACTIVE + V2/V3 SCHEDULED; no ACTIVE overlap; no commercial mutation', async () => {
    const prices = priceService();
    const a = actor();
    const dims = { pricingUnit: 'PER_VISIT' as const, currency: 'SYP', serviceVariantId: null };
    const now = Date.now();
    const v1 = await prices.createDraft(a, {
      clinicalServiceId: serviceId,
      currency: 'SYP',
      unitPrice: 1,
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      pricingUnit: 'PER_VISIT',
    });
    await prices.publish(a, v1.id);
    const v2 = await prices.createDraft(a, {
      clinicalServiceId: serviceId,
      currency: 'SYP',
      unitPrice: 2,
      effectiveFrom: new Date(now + 30 * 24 * 3600 * 1000).toISOString(),
      pricingUnit: 'PER_VISIT',
    });
    await prices.publish(a, v2.id);
    const v3 = await prices.createDraft(a, {
      clinicalServiceId: serviceId,
      currency: 'SYP',
      unitPrice: 3,
      effectiveFrom: new Date(now + 60 * 24 * 3600 * 1000).toISOString(),
      pricingUnit: 'PER_VISIT',
    });
    await prices.publish(a, v3.id);

    const reV1 = await createClinicalPrismaWrapper(prisma).withPlatformBypass((client) =>
      client.clinicalServicePriceVersion.findUniqueOrThrow({ where: { id: v1.id } }),
    );
    const reV2 = await createClinicalPrismaWrapper(prisma).withPlatformBypass((client) =>
      client.clinicalServicePriceVersion.findUniqueOrThrow({ where: { id: v2.id } }),
    );
    const reV3 = await createClinicalPrismaWrapper(prisma).withPlatformBypass((client) =>
      client.clinicalServicePriceVersion.findUniqueOrThrow({ where: { id: v3.id } }),
    );
    expect(reV1.status).toBe('ACTIVE');
    expect(reV1.effectiveTo).toBeNull();
    expect(reV2.status).toBe('SCHEDULED');
    expect(reV2.effectiveTo).toBeNull();
    expect(reV3.status).toBe('SCHEDULED');
    expect(await countActive(serviceId, null)).toBe(1);

    // Future as-of rejected; live remains V1 until due reconcile.
    await expect(
      prices.lookupActivePrice(a, serviceId, null, {
        ...dims,
        at: new Date(now + 45 * 24 * 3600 * 1000),
      }),
    ).rejects.toBeTruthy();
    expect((await prices.lookupActivePrice(a, serviceId, null, dims)).price.id).toBe(v1.id);

    await createClinicalPrismaWrapper(prisma).withPlatformBypass(async (client) => {
      await client.clinicalServicePriceVersion.update({
        where: { id: v2.id },
        data: { effectiveFrom: new Date(Date.now() - 120_000) },
      });
    });
    expect((await prices.lookupActivePrice(a, serviceId, null, dims)).price.id).toBe(v2.id);
  });

  it('PA-07 — commercial identity distinguishes unit/currency variants', async () => {
    const prices = priceService();
    const a = actor();
    const from = new Date('2026-01-01T00:00:00.000Z').toISOString();

    const visit = await prices.createDraft(a, {
      clinicalServiceId: serviceId,
      currency: 'SYP',
      unitPrice: 10,
      effectiveFrom: from,
      pricingUnit: 'PER_VISIT',
    });
    const procedure = await prices.createDraft(a, {
      clinicalServiceId: serviceId,
      currency: 'USD',
      unitPrice: 20,
      effectiveFrom: from,
      pricingUnit: 'PER_PROCEDURE',
    });
    await prices.publish(a, visit.id);
    await prices.publish(a, procedure.id);

    const visitHit = await prices.lookupActivePrice(a, serviceId, null, {
      pricingUnit: 'PER_VISIT',
      currency: 'SYP',
      serviceVariantId: null,
    });
    const procHit = await prices.lookupActivePrice(a, serviceId, null, {
      pricingUnit: 'PER_PROCEDURE',
      currency: 'USD',
      serviceVariantId: null,
    });
    expect(visitHit.price.id).toBe(visit.id);
    expect(procHit.price.id).toBe(procedure.id);
  });
});
