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

  it('Case A — concurrent superseding publishes after ACTIVE baseline keep single non-overlapping ACTIVE', async () => {
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

    const startFrom = new Date('2026-09-01T00:00:00.000Z').toISOString();
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
    expect(actives[0].effectiveFrom.toISOString()).toBe(startFrom);
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
});
