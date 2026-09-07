/**
 * PA-04 Option B — PostgreSQL acceptance + concurrency (T1–T44 core paths).
 *
 * Run:
 *   ALLOW_TEST_DATABASE_RESET=true RUN_PLATFORM_DB_SECURITY=true \
 *   npx jest --runInBand --testPathIgnorePatterns=[] \
 *     --testPathPattern=clinical-price.pa04.acceptance.postgres.integration.spec
 */
import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { ClinicalPriceVersionService } from '../application/clinical-price-version.service';
import {
  ClinicalCatalogConflictError,
  ClinicalCatalogValidationError,
  ClinicalPriceLookupFailClosedError,
} from '../domain/clinical-catalog.errors';
import {
  cleanupWaveAFixtures,
  createClinicalPrismaWrapper,
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
} from './clinical-catalog-db.harness';
import { FakeClinicalCatalogAuditLog } from './support/fake-clinical-catalog-audit-log';

jest.setTimeout(180_000);

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('PA-04 PriceVersion Option B acceptance (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let tenantId: string;
  let branchId: string;
  let serviceId: string;
  let otherServiceId: string;
  let prices: ClinicalPriceVersionService;
  let audit: FakeClinicalCatalogAuditLog;

  const actor = () => ({
    actorId: randomUUID(),
    actorRoles: ['owner'],
    tenantId,
    isPlatform: false,
  });

  const dims = {
    pricingUnit: 'PER_VISIT' as const,
    currency: 'SYP',
    serviceVariantId: null as string | null,
  };

  async function seedTenant() {
    if (tenantId) {
      await cleanupWaveAFixtures(prisma, [tenantId]).catch(() => undefined);
    }
    tenantId = randomUUID();
    const wrapper = createClinicalPrismaWrapper(prisma);
    audit = new FakeClinicalCatalogAuditLog();
    prices = new ClinicalPriceVersionService(wrapper as never, audit as never);

    await wrapper.withPlatformBypass(async (client) => {
      await client.tenant.create({
        data: {
          id: tenantId,
          name: 'PA04 Accept Tenant',
          slug: `pa04-${tenantId.slice(0, 8)}`,
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
          stableKey: `canonical.general.pa04_${tenantId.slice(0, 8)}`,
          domain: 'GENERAL',
          lifecycle: 'PUBLISHED',
          publishedAt: new Date(),
          translations: {
            create: [
              { locale: 'en', displayName: 'PA04 Service' },
              { locale: 'ar', displayName: 'خدمة' },
            ],
          },
        },
      });
      serviceId = canonical.id;
      const other = await client.canonicalClinicalServiceDefinition.create({
        data: {
          tenantId: null,
          provenance: 'SYSTEM_CANONICAL',
          stableKey: `canonical.general.pa04o_${tenantId.slice(0, 8)}`,
          domain: 'GENERAL',
          lifecycle: 'PUBLISHED',
          publishedAt: new Date(),
          translations: {
            create: [
              { locale: 'en', displayName: 'PA04 Other' },
              { locale: 'ar', displayName: 'أخرى' },
            ],
          },
        },
      });
      otherServiceId = other.id;
    });
  }

  beforeAll(async () => {
    prisma = createPlatformDbSecurityClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    if (tenantId) await cleanupWaveAFixtures(prisma, [tenantId]).catch(() => undefined);
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await seedTenant();
  });

  async function draftAndPublish(opts: {
    from: Date;
    to?: Date | null;
    unitPrice?: number;
    clinicalServiceId?: string;
    branchId?: string | null;
    currency?: string;
    pricingUnit?: 'PER_VISIT' | 'PER_PROCEDURE';
  }) {
    const a = actor();
    const d = await prices.createDraft(a, {
      clinicalServiceId: opts.clinicalServiceId ?? serviceId,
      branchId: opts.branchId === undefined ? undefined : opts.branchId ?? undefined,
      pricingUnit: opts.pricingUnit ?? 'PER_VISIT',
      currency: opts.currency ?? 'SYP',
      unitPrice: opts.unitPrice ?? 100,
      taxPercent: 0,
      effectiveFrom: opts.from.toISOString(),
      effectiveTo: opts.to ? opts.to.toISOString() : undefined,
    });
    return prices.publish(a, d.id);
  }

  it('T1/T2/T6 — current ACTIVE; future SCHEDULED; live stays V1 before boundary', async () => {
    const v1 = await draftAndPublish({ from: new Date('2026-01-01T00:00:00.000Z'), unitPrice: 50 });
    expect(v1.status).toBe('ACTIVE');
    const now = Date.now();
    const v2 = await draftAndPublish({
      from: new Date(now + 30 * 24 * 3600 * 1000),
      unitPrice: 90,
    });
    expect(v2.status).toBe('SCHEDULED');
    const live = await prices.lookupActivePrice(actor(), serviceId, null, dims);
    expect(live.price.id).toBe(v1.id);
    expect(live.price.status).toBe('ACTIVE');
  });

  it('T4/T19 — due reconcile activates V2; stale V1 not returned', async () => {
    const v1 = await draftAndPublish({ from: new Date('2026-01-01T00:00:00.000Z'), unitPrice: 10 });
    const t2 = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 86400000);
    const d2 = await prices.createDraft(actor(), {
      clinicalServiceId: serviceId,
      pricingUnit: 'PER_VISIT',
      currency: 'SYP',
      unitPrice: 20,
      effectiveFrom: future.toISOString(),
    });
    const scheduled = await prices.publish(actor(), d2.id);
    expect(scheduled.status).toBe('SCHEDULED');
    await backdateScheduled(scheduled.id, t2);
    const live = await prices.lookupActivePrice(actor(), serviceId, null, dims);
    expect(live.price.id).toBe(scheduled.id);
    expect(live.price.status).toBe('ACTIVE');
    const reV1 = await prisma.clinicalServicePriceVersion.findUniqueOrThrow({ where: { id: v1.id } });
    expect(reV1.status).toBe('SUPERSEDED');
    expect(Number(reV1.unitPrice)).toBe(10);
  });

  it('T10/T21 — cancel SCHEDULED before effective; never effective; V1 intact', async () => {
    const v1 = await draftAndPublish({ from: new Date('2026-01-01T00:00:00.000Z') });
    const v2 = await draftAndPublish({
      from: new Date(Date.now() + 40 * 86400000),
      unitPrice: 77,
    });
    expect(v2.status).toBe('SCHEDULED');
    const canceled = await prices.inactivate(actor(), v2.id);
    expect(canceled.status).toBe('INACTIVE');
    expect(prices.isNeverEffective(canceled)).toBe(true);
    const live = await prices.lookupActivePrice(actor(), serviceId, null, dims);
    expect(live.price.id).toBe(v1.id);
  });

  it('T29 — ACTIVE→INACTIVE without successor → 0 ACTIVE live fail-closed', async () => {
    const v1 = await draftAndPublish({ from: new Date('2026-01-01T00:00:00.000Z') });
    await prices.inactivate(actor(), v1.id);
    await expect(
      prices.lookupActivePrice(actor(), serviceId, null, dims),
    ).rejects.toBeInstanceOf(ClinicalPriceLookupFailClosedError);
  });

  it('T31/T32 — explicit overlap reject; contiguous boundary valid', async () => {
    await draftAndPublish({
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: new Date('2026-06-01T00:00:00.000Z'),
      unitPrice: 1,
    });
    const overlapDraft = await prices.createDraft(actor(), {
      clinicalServiceId: serviceId,
      pricingUnit: 'PER_VISIT',
      currency: 'SYP',
      unitPrice: 2,
      effectiveFrom: new Date('2026-03-01T00:00:00.000Z').toISOString(),
      effectiveTo: new Date('2026-09-01T00:00:00.000Z').toISOString(),
    });
    await expect(prices.publish(actor(), overlapDraft.id)).rejects.toBeInstanceOf(
      ClinicalCatalogConflictError,
    );
    await prices.inactivate(actor(), overlapDraft.id);

    const contig = await prices.createDraft(actor(), {
      clinicalServiceId: serviceId,
      pricingUnit: 'PER_VISIT',
      currency: 'SYP',
      unitPrice: 3,
      effectiveFrom: new Date('2026-06-01T00:00:00.000Z').toISOString(),
    });
    const pub = await prices.publish(actor(), contig.id);
    expect(['ACTIVE', 'SCHEDULED']).toContain(pub.status);
  });

  it('T40/T41 — successor-side overlap reject; insert between neighbors valid', async () => {
    const t0 = Date.now() + 10 * 86400000;
    const t10 = t0 + 10 * 86400000;
    const t20 = t0 + 20 * 86400000;
    const t30 = t0 + 30 * 86400000;
    const t40 = t0 + 40 * 86400000;
    const v1 = await draftAndPublish({
      from: new Date(t0),
      to: new Date(t10),
      unitPrice: 1,
    });
    expect(v1.status).toBe('SCHEDULED');
    const v3 = await draftAndPublish({
      from: new Date(t30),
      to: new Date(t40),
      unitPrice: 3,
    });
    expect(v3.status).toBe('SCHEDULED');

    const bad = await prices.createDraft(actor(), {
      clinicalServiceId: serviceId,
      pricingUnit: 'PER_VISIT',
      currency: 'SYP',
      unitPrice: 2,
      effectiveFrom: new Date(t10 + 5 * 86400000).toISOString(),
      effectiveTo: new Date(t30 + 5 * 86400000).toISOString(),
    });
    await expect(prices.publish(actor(), bad.id)).rejects.toBeInstanceOf(
      ClinicalCatalogConflictError,
    );
    await prices.inactivate(actor(), bad.id);

    const good = await prices.createDraft(actor(), {
      clinicalServiceId: serviceId,
      pricingUnit: 'PER_VISIT',
      currency: 'SYP',
      unitPrice: 2,
      effectiveFrom: new Date(t10).toISOString(),
      effectiveTo: new Date(t30).toISOString(),
    });
    const ok = await prices.publish(actor(), good.id);
    expect(ok.status).toBe('SCHEDULED');
  });

  it('T9 — different commercial keys concurrent publish both succeed', async () => {
    const from = new Date().toISOString();
    const a = actor();
    const d1 = await prices.createDraft(a, {
      clinicalServiceId: serviceId,
      pricingUnit: 'PER_VISIT',
      currency: 'SYP',
      unitPrice: 1,
      effectiveFrom: from,
    });
    const d2 = await prices.createDraft(a, {
      clinicalServiceId: otherServiceId,
      pricingUnit: 'PER_VISIT',
      currency: 'SYP',
      unitPrice: 2,
      effectiveFrom: from,
    });
    const [r1, r2] = await Promise.all([prices.publish(a, d1.id), prices.publish(a, d2.id)]);
    expect(r1.status).toBe('ACTIVE');
    expect(r2.status).toBe('ACTIVE');
  });

  it('T7 — same-key concurrent double-publish of same draft: one success', async () => {
    const a = actor();
    const d = await prices.createDraft(a, {
      clinicalServiceId: serviceId,
      pricingUnit: 'PER_VISIT',
      currency: 'SYP',
      unitPrice: 5,
      effectiveFrom: new Date().toISOString(),
    });
    const results = await Promise.allSettled([prices.publish(a, d.id), prices.publish(a, d.id)]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled.length).toBe(1);
    const actives = await prisma.clinicalServicePriceVersion.count({
      where: { tenantId, clinicalServiceId: serviceId, status: 'ACTIVE' },
    });
    expect(actives).toBe(1);
  });

  it('T14 — commercial identity distinguishes currency', async () => {
    await draftAndPublish({ from: new Date('2026-01-01T00:00:00.000Z'), currency: 'SYP' });
    await draftAndPublish({ from: new Date('2026-01-01T00:00:00.000Z'), currency: 'USD', unitPrice: 9 });
    const syp = await prices.lookupActivePrice(actor(), serviceId, null, {
      pricingUnit: 'PER_VISIT',
      currency: 'SYP',
      serviceVariantId: null,
    });
    const usd = await prices.lookupActivePrice(actor(), serviceId, null, {
      pricingUnit: 'PER_VISIT',
      currency: 'USD',
      serviceVariantId: null,
    });
    expect(syp.price.currency).toBe('SYP');
    expect(usd.price.currency).toBe('USD');
  });

  it('T12/T13 — branch current ACTIVE wins; future SCHEDULED allows tenant fallback', async () => {
    const tenantPrice = await draftAndPublish({
      from: new Date('2026-01-01T00:00:00.000Z'),
      unitPrice: 11,
    });
    const withBranch = await prices.lookupActivePrice(actor(), serviceId, branchId, dims);
    expect(withBranch.scope).toBe('tenant');
    expect(withBranch.price.id).toBe(tenantPrice.id);

    const futureBranch = await draftAndPublish({
      from: new Date(Date.now() + 10 * 86400000),
      unitPrice: 33,
      branchId,
    });
    expect(futureBranch.status).toBe('SCHEDULED');
    const stillTenant = await prices.lookupActivePrice(actor(), serviceId, branchId, dims);
    expect(stillTenant.scope).toBe('tenant');
    expect(stillTenant.price.id).toBe(tenantPrice.id);

    await prices.inactivate(actor(), futureBranch.id);
    const branchNow = await draftAndPublish({
      from: new Date('2026-01-01T00:00:00.000Z'),
      unitPrice: 22,
      branchId,
    });
    const live = await prices.lookupActivePrice(actor(), serviceId, branchId, dims);
    expect(live.scope).toBe('branch');
    expect(live.price.id).toBe(branchNow.id);
  });

  it('PA04-BR-06 / R-PA04-01 — branch due reconcile failure does not tenant-fallback', async () => {
    await draftAndPublish({ from: new Date('2026-01-01T00:00:00.000Z'), unitPrice: 11 });
    const d = await prices.createDraft(actor(), {
      clinicalServiceId: serviceId,
      branchId,
      pricingUnit: 'PER_VISIT',
      currency: 'SYP',
      unitPrice: 22,
      effectiveFrom: new Date(Date.now() + 86400000).toISOString(),
    });
    const scheduled = await prices.publish(actor(), d.id);
    await backdateScheduled(scheduled.id, new Date(Date.now() - 60_000));
    const spy = jest
      .spyOn(prices, 'reconcileCommercialTimeline')
      .mockRejectedValueOnce(new Error('forced branch reconcile failure'));
    await expect(
      prices.lookupActivePrice(actor(), serviceId, branchId, dims),
    ).rejects.toThrow(/forced branch reconcile failure/);
    spy.mockRestore();
  });

  it('T33/T37 — expired SCHEDULED without successor → INACTIVE-after-effective, not live', async () => {
    await draftAndPublish({ from: new Date('2026-01-01T00:00:00.000Z'), unitPrice: 1 });
    const future = new Date(Date.now() + 86400000);
    const end = new Date(Date.now() + 2 * 86400000);
    const d = await prices.createDraft(actor(), {
      clinicalServiceId: serviceId,
      pricingUnit: 'PER_VISIT',
      currency: 'SYP',
      unitPrice: 5,
      effectiveFrom: future.toISOString(),
      effectiveTo: end.toISOString(),
    });
    const scheduled = await prices.publish(actor(), d.id);
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', true)`;
      await tx.clinicalServicePriceVersion.update({
        where: { id: scheduled.id },
        data: {
          effectiveFrom: new Date(Date.now() - 3 * 86400000),
          effectiveTo: new Date(Date.now() - 86400000),
        },
      });
    });
    const live = await prices.lookupActivePrice(actor(), serviceId, null, dims);
    expect(live.price.status).toBe('ACTIVE');
    const re = await prisma.clinicalServicePriceVersion.findUniqueOrThrow({
      where: { id: scheduled.id },
    });
    expect(re.status).toBe('INACTIVE');
    expect(prices.isNeverEffective(re)).toBe(false);
  });

  it('T44 — controlled same-boundary replacement under lock', async () => {
    const from = new Date(Date.now() + 10 * 86400000);
    const v2 = await draftAndPublish({ from, unitPrice: 10 });
    expect(v2.status).toBe('SCHEDULED');
    await prices.inactivate(actor(), v2.id);
    const draft = await prices.createDraft(actor(), {
      clinicalServiceId: serviceId,
      pricingUnit: 'PER_VISIT',
      currency: 'SYP',
      unitPrice: 15,
      effectiveFrom: from.toISOString(),
    });
    const replaced = await prices.replaceScheduled(actor(), v2.id, draft.id);
    expect(replaced.status).toBe('SCHEDULED');
    expect(Number(replaced.unitPrice)).toBe(15);
  });

  it('T3/T23/T35 — multi-due catch-up materializes chain; final ACTIVE covers now', async () => {
    await draftAndPublish({ from: new Date('2026-01-01T00:00:00.000Z'), unitPrice: 1 });
    const base = Date.now() - 10 * 86400000;
    const windows = [
      { from: new Date(base + 2 * 86400000), to: new Date(base + 3 * 86400000), price: 2 },
      { from: new Date(base + 3 * 86400000), to: new Date(base + 4 * 86400000), price: 3 },
      { from: new Date(base + 4 * 86400000), to: null as Date | null, price: 4 },
    ];
    const ids: string[] = [];
    for (const w of windows) {
      const futureFrom = new Date(Date.now() + (10 + ids.length) * 86400000);
      const d = await prices.createDraft(actor(), {
        clinicalServiceId: serviceId,
        pricingUnit: 'PER_VISIT',
        currency: 'SYP',
        unitPrice: w.price,
        effectiveFrom: futureFrom.toISOString(),
        effectiveTo: w.to
          ? new Date(futureFrom.getTime() + 86400000).toISOString()
          : undefined,
      });
      const s = await prices.publish(actor(), d.id);
      await backdateScheduled(s.id, w.from, w.to);
      ids.push(s.id);
    }
    const live = await prices.lookupActivePrice(actor(), serviceId, null, dims);
    expect(live.price.id).toBe(ids[2]);
    expect(live.price.status).toBe('ACTIVE');
    const r2 = await prisma.clinicalServicePriceVersion.findUniqueOrThrow({ where: { id: ids[0] } });
    const r3 = await prisma.clinicalServicePriceVersion.findUniqueOrThrow({ where: { id: ids[1] } });
    expect(r2.status).toBe('SUPERSEDED');
    expect(r3.status).toBe('SUPERSEDED');
  });

  async function backdateScheduled(
    id: string,
    effectiveFrom: Date,
    effectiveTo: Date | null = null,
  ) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', true)`;
      await tx.clinicalServicePriceVersion.update({
        where: { id },
        data: { effectiveFrom, effectiveTo },
      });
    });
  }

  it('T5 — historical as-of after successor activation returns prior via commercialEnd', async () => {
    const v1 = await draftAndPublish({ from: new Date('2026-01-01T00:00:00.000Z'), unitPrice: 10 });
    const future = new Date(Date.now() + 86400000);
    const d2 = await prices.createDraft(actor(), {
      clinicalServiceId: serviceId,
      pricingUnit: 'PER_VISIT',
      currency: 'SYP',
      unitPrice: 20,
      effectiveFrom: future.toISOString(),
    });
    const v2 = await prices.publish(actor(), d2.id);
    const t2 = new Date(Date.now() - 2 * 86400000);
    await backdateScheduled(v2.id, t2);
    const live = await prices.lookupActivePrice(actor(), serviceId, null, dims);
    expect(live.price.id).toBe(v2.id);
    const hist = await prices.lookupActivePrice(actor(), serviceId, null, {
      ...dims,
      at: new Date(Date.now() - 5 * 86400000),
    });
    expect(hist.price.id).toBe(v1.id);
  });

  it('T8/T24 — same-key concurrent read-triggered reconcile: one ACTIVE, deterministic', async () => {
    const v1 = await draftAndPublish({ from: new Date('2026-01-01T00:00:00.000Z'), unitPrice: 1 });
    const d2 = await prices.createDraft(actor(), {
      clinicalServiceId: serviceId,
      pricingUnit: 'PER_VISIT',
      currency: 'SYP',
      unitPrice: 2,
      effectiveFrom: new Date(Date.now() + 86400000).toISOString(),
    });
    const v2 = await prices.publish(actor(), d2.id);
    await backdateScheduled(v2.id, new Date(Date.now() - 60_000));
    const a = actor();
    const results = await Promise.all([
      prices.lookupActivePrice(a, serviceId, null, dims),
      prices.lookupActivePrice(a, serviceId, null, dims),
      prices.lookupActivePrice(a, serviceId, null, dims),
    ]);
    expect(new Set(results.map((r) => r.price.id))).toEqual(new Set([v2.id]));
    expect(await prisma.clinicalServicePriceVersion.count({
      where: { tenantId, clinicalServiceId: serviceId, status: 'ACTIVE' },
    })).toBe(1);
    const reV1 = await prisma.clinicalServicePriceVersion.findUniqueOrThrow({ where: { id: v1.id } });
    expect(reV1.status).toBe('SUPERSEDED');
  });

  it('T11 — replace future via replaceScheduled while still SCHEDULED', async () => {
    const from = new Date(Date.now() + 12 * 86400000);
    const v2 = await draftAndPublish({ from, unitPrice: 10 });
    const draft = await prices.createDraft(actor(), {
      clinicalServiceId: serviceId,
      pricingUnit: 'PER_VISIT',
      currency: 'SYP',
      unitPrice: 99,
      effectiveFrom: from.toISOString(),
    });
    const replaced = await prices.replaceScheduled(actor(), v2.id, draft.id);
    expect(replaced.status).toBe('SCHEDULED');
    expect(Number(replaced.unitPrice)).toBe(99);
    const prior = await prisma.clinicalServicePriceVersion.findUniqueOrThrow({ where: { id: v2.id } });
    expect(prior.status).toBe('INACTIVE');
    expect(prices.isNeverEffective(prior)).toBe(true);
  });

  it('T15 — invalid transitions rejected', async () => {
    const v1 = await draftAndPublish({ from: new Date('2026-01-01T00:00:00.000Z') });
    await expect(prices.publish(actor(), v1.id)).rejects.toBeTruthy();
    const inactive = await prices.inactivate(actor(), v1.id);
    await expect(prices.inactivate(actor(), inactive.id)).rejects.toBeTruthy();
  });

  it('T16 — audit emits publish/schedule/activate/cancel/inactivate/supersede', async () => {
    audit.entries.length = 0;
    const v1 = await draftAndPublish({ from: new Date('2026-01-01T00:00:00.000Z') });
    const v2 = await draftAndPublish({
      from: new Date(Date.now() + 20 * 86400000),
      unitPrice: 2,
    });
    await prices.inactivate(actor(), v2.id);
    const d3 = await prices.createDraft(actor(), {
      clinicalServiceId: serviceId,
      pricingUnit: 'PER_VISIT',
      currency: 'SYP',
      unitPrice: 3,
      effectiveFrom: new Date(Date.now() + 25 * 86400000).toISOString(),
    });
    const v3 = await prices.publish(actor(), d3.id);
    await backdateScheduled(v3.id, new Date(Date.now() - 30_000));
    await prices.lookupActivePrice(actor(), serviceId, null, dims);
    await prices.inactivate(actor(), v3.id);
    const actions = audit.entries.map((e) => e.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'clinical_catalog.price.publish',
        'clinical_catalog.price.schedule',
        'clinical_catalog.price.cancel_scheduled',
        'clinical_catalog.price.activate',
        'clinical_catalog.price.supersede',
        'clinical_catalog.price.inactivate',
      ]),
    );
    void v1;
  });

  it('T22/T30 — ACTIVE→INACTIVE then later successor leaves gap; historical ends at inactivatedAt', async () => {
    const v1 = await draftAndPublish({ from: new Date('2026-01-01T00:00:00.000Z'), unitPrice: 1 });
    await prices.inactivate(actor(), v1.id);
    const tInactivate = new Date(Date.now() - 5 * 86400000);
    const tGapProbe = new Date(Date.now() - 3 * 86400000);
    const tHist = new Date(Date.now() - 6 * 86400000);
    const tV2 = new Date(Date.now() - 2 * 86400000);
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', true)`;
      await tx.clinicalServicePriceVersion.update({
        where: { id: v1.id },
        data: { inactivatedAt: tInactivate },
      });
    });

    await expect(
      prices.lookupActivePrice(actor(), serviceId, null, { ...dims, at: tGapProbe }),
    ).rejects.toBeInstanceOf(ClinicalPriceLookupFailClosedError);

    const v2 = await draftAndPublish({
      from: new Date(Date.now() + 5 * 86400000),
      unitPrice: 2,
    });
    expect(v2.status).toBe('SCHEDULED');
    await backdateScheduled(v2.id, tV2);
    const live = await prices.lookupActivePrice(actor(), serviceId, null, dims);
    expect(live.price.id).toBe(v2.id);
    const hist = await prices.lookupActivePrice(actor(), serviceId, null, {
      ...dims,
      at: tHist,
    });
    expect(hist.price.id).toBe(v1.id);
  });

  it('T25 — background activator + live reconcile race: one ACTIVE, no duplicate activate', async () => {
    const v1 = await draftAndPublish({ from: new Date('2026-01-01T00:00:00.000Z'), unitPrice: 1 });
    const d2 = await prices.createDraft(actor(), {
      clinicalServiceId: serviceId,
      pricingUnit: 'PER_VISIT',
      currency: 'SYP',
      unitPrice: 2,
      effectiveFrom: new Date(Date.now() + 86400000).toISOString(),
    });
    const v2 = await prices.publish(actor(), d2.id);
    await backdateScheduled(v2.id, new Date(Date.now() - 30_000));
    audit.entries.length = 0;
    const [bg, live] = await Promise.all([
      prices.activateDueSchedules(50),
      prices.lookupActivePrice(actor(), serviceId, null, dims),
    ]);
    expect(bg).toBeGreaterThanOrEqual(0);
    expect(live.price.id).toBe(v2.id);
    const reV2 = await prisma.clinicalServicePriceVersion.findUniqueOrThrow({ where: { id: v2.id } });
    const reV1 = await prisma.clinicalServicePriceVersion.findUniqueOrThrow({ where: { id: v1.id } });
    expect(reV2.status).toBe('ACTIVE');
    expect(reV1.status).toBe('SUPERSEDED');
    expect(reV1.supersededByVersionId).toBe(v2.id);
    expect(
      await prisma.clinicalServicePriceVersion.count({
        where: { tenantId, clinicalServiceId: serviceId, status: 'ACTIVE' },
      }),
    ).toBe(1);
    const activateAudits = audit.entries.filter(
      (e) =>
        e.action === 'clinical_catalog.price.activate' &&
        e.resourceId === v2.id &&
        (e.details as { effectiveEntry?: boolean } | undefined)?.effectiveEntry === true,
    );
    expect(activateAudits.length).toBe(1);
    const supersedeAudits = audit.entries.filter(
      (e) => e.action === 'clinical_catalog.price.supersede' && e.resourceId === v1.id,
    );
    expect(supersedeAudits.length).toBe(1);
    expect(
      audit.entries.filter(
        (e) =>
          e.resourceId === v1.id &&
          (e.action === 'clinical_catalog.price.supersede' ||
            e.action === 'clinical_catalog.price.inactivate'),
      ).length,
    ).toBe(1);
  });

  it('T26 — canceled V2 + later V3: V1 remains until V3 activates', async () => {
    const v1 = await draftAndPublish({ from: new Date('2026-01-01T00:00:00.000Z'), unitPrice: 1 });
    const v2 = await draftAndPublish({
      from: new Date(Date.now() + 10 * 86400000),
      unitPrice: 2,
    });
    await prices.inactivate(actor(), v2.id);
    const v3 = await draftAndPublish({
      from: new Date(Date.now() + 20 * 86400000),
      unitPrice: 3,
    });
    expect(v3.status).toBe('SCHEDULED');
    const live = await prices.lookupActivePrice(actor(), serviceId, null, dims);
    expect(live.price.id).toBe(v1.id);
    await backdateScheduled(v3.id, new Date(Date.now() - 60_000));
    const after = await prices.lookupActivePrice(actor(), serviceId, null, dims);
    expect(after.price.id).toBe(v3.id);
  });

  it('T27/R-PA04-06 — zero ACTIVE legal → deterministic fail-closed', async () => {
    await expect(
      prices.lookupActivePrice(actor(), serviceId, null, dims),
    ).rejects.toBeInstanceOf(ClinicalPriceLookupFailClosedError);
  });

  it('T28 — two ACTIVE corruption → fail closed + conflict', async () => {
    const v1 = await draftAndPublish({ from: new Date('2026-01-01T00:00:00.000Z'), unitPrice: 1 });
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', true)`;
      await tx.clinicalServicePriceVersion.create({
        data: {
          tenantId,
          branchId: null,
          clinicalServiceId: serviceId,
          serviceVariantId: null,
          pricingUnit: 'PER_VISIT',
          currency: 'SYP',
          unitPrice: 99,
          taxPercent: 0,
          effectiveFrom: new Date('2026-02-01T00:00:00.000Z'),
          status: 'ACTIVE',
          publishedAt: new Date(),
          publishedBy: actor().actorId,
        },
      });
    });
    await expect(
      prices.lookupActivePrice(actor(), serviceId, null, dims),
    ).rejects.toBeInstanceOf(ClinicalCatalogConflictError);
    void v1;
  });

  it('T34 — ACTIVE expired without successor → INACTIVE-after-effective; live fail-closed', async () => {
    const v1 = await draftAndPublish({
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: new Date(Date.now() - 86400000),
      unitPrice: 1,
    });
    await expect(
      prices.lookupActivePrice(actor(), serviceId, null, dims),
    ).rejects.toBeInstanceOf(ClinicalPriceLookupFailClosedError);
    const re = await prisma.clinicalServicePriceVersion.findUniqueOrThrow({ where: { id: v1.id } });
    expect(re.status).toBe('INACTIVE');
    expect(prices.isNeverEffective(re)).toBe(false);
  });

  it('T36 — latest due already expired → 0 ACTIVE fail-closed', async () => {
    await draftAndPublish({
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: new Date('2026-02-01T00:00:00.000Z'),
      unitPrice: 1,
    });
    // Force V1 terminal first via lookup
    await expect(
      prices.lookupActivePrice(actor(), serviceId, null, dims),
    ).rejects.toBeInstanceOf(ClinicalPriceLookupFailClosedError);

    const d2 = await prices.createDraft(actor(), {
      clinicalServiceId: serviceId,
      pricingUnit: 'PER_VISIT',
      currency: 'SYP',
      unitPrice: 2,
      effectiveFrom: new Date(Date.now() + 86400000).toISOString(),
      effectiveTo: new Date(Date.now() + 2 * 86400000).toISOString(),
    });
    const v2 = await prices.publish(actor(), d2.id);
    await backdateScheduled(
      v2.id,
      new Date(Date.now() - 3 * 86400000),
      new Date(Date.now() - 86400000),
    );
    await expect(
      prices.lookupActivePrice(actor(), serviceId, null, dims),
    ).rejects.toBeInstanceOf(ClinicalPriceLookupFailClosedError);
    const re = await prisma.clinicalServicePriceVersion.findUniqueOrThrow({ where: { id: v2.id } });
    expect(re.status).toBe('INACTIVE');
  });

  it('T38 — successor-driven terminal SUPERSEDED at shared boundary', async () => {
    const v1 = await draftAndPublish({
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: new Date('2026-06-01T00:00:00.000Z'),
      unitPrice: 1,
    });
    const v2 = await draftAndPublish({
      from: new Date('2026-06-01T00:00:00.000Z'),
      unitPrice: 2,
    });
    // If V2 published as ACTIVE immediately (past/now), V1 should be SUPERSEDED
    if (v2.status === 'ACTIVE') {
      const re = await prisma.clinicalServicePriceVersion.findUniqueOrThrow({ where: { id: v1.id } });
      expect(re.status).toBe('SUPERSEDED');
    } else {
      await backdateScheduled(v2.id, new Date('2026-06-01T00:00:00.000Z'));
      const live = await prices.lookupActivePrice(actor(), serviceId, null, dims);
      expect(live.price.id).toBe(v2.id);
      const re = await prisma.clinicalServicePriceVersion.findUniqueOrThrow({ where: { id: v1.id } });
      expect(re.status).toBe('SUPERSEDED');
    }
  });

  it('T39 — explicit end before later successor → gap + INACTIVE-after-effective', async () => {
    const v1 = await draftAndPublish({
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: new Date(Date.now() - 5 * 86400000),
      unitPrice: 1,
    });
    const d2 = await prices.createDraft(actor(), {
      clinicalServiceId: serviceId,
      pricingUnit: 'PER_VISIT',
      currency: 'SYP',
      unitPrice: 2,
      effectiveFrom: new Date(Date.now() + 86400000).toISOString(),
    });
    const v2 = await prices.publish(actor(), d2.id);
    await expect(
      prices.lookupActivePrice(actor(), serviceId, null, dims),
    ).rejects.toBeInstanceOf(ClinicalPriceLookupFailClosedError);
    const re = await prisma.clinicalServicePriceVersion.findUniqueOrThrow({ where: { id: v1.id } });
    expect(re.status).toBe('INACTIVE');
    expect(v2.status).toBe('SCHEDULED');
  });

  it('T42 — open-ended insertion before future successor valid; effectiveTo not mutated', async () => {
    const v3 = await draftAndPublish({
      from: new Date(Date.now() + 40 * 86400000),
      unitPrice: 3,
    });
    const d2 = await prices.createDraft(actor(), {
      clinicalServiceId: serviceId,
      pricingUnit: 'PER_VISIT',
      currency: 'SYP',
      unitPrice: 2,
      effectiveFrom: new Date(Date.now() + 20 * 86400000).toISOString(),
    });
    const v2 = await prices.publish(actor(), d2.id);
    expect(v2.status).toBe('SCHEDULED');
    expect(v2.effectiveTo).toBeNull();
    const re = await prisma.clinicalServicePriceVersion.findUniqueOrThrow({ where: { id: v2.id } });
    expect(re.effectiveTo).toBeNull();
    void v3;
  });

  it('T43 — open-ended/finite crossing successor rejected', async () => {
    await draftAndPublish({
      from: new Date(Date.now() + 40 * 86400000),
      unitPrice: 3,
    });
    const bad = await prices.createDraft(actor(), {
      clinicalServiceId: serviceId,
      pricingUnit: 'PER_VISIT',
      currency: 'SYP',
      unitPrice: 2,
      effectiveFrom: new Date(Date.now() + 20 * 86400000).toISOString(),
      effectiveTo: new Date(Date.now() + 50 * 86400000).toISOString(),
    });
    await expect(prices.publish(actor(), bad.id)).rejects.toBeInstanceOf(
      ClinicalCatalogConflictError,
    );
  });

  it('R-PA04-02 — overdue cancel reconciles first; cannot be canceled-never-effective', async () => {
    await draftAndPublish({ from: new Date('2026-01-01T00:00:00.000Z'), unitPrice: 1 });
    const d2 = await prices.createDraft(actor(), {
      clinicalServiceId: serviceId,
      pricingUnit: 'PER_VISIT',
      currency: 'SYP',
      unitPrice: 2,
      effectiveFrom: new Date(Date.now() + 86400000).toISOString(),
    });
    const v2 = await prices.publish(actor(), d2.id);
    await backdateScheduled(v2.id, new Date(Date.now() - 60_000));
    const after = await prices.inactivate(actor(), v2.id);
    expect(after.status).toBe('INACTIVE');
    expect(prices.isNeverEffective(after)).toBe(false);
  });

  it('R-PA04-03 — delayed background; live on-demand still correct', async () => {
    await draftAndPublish({ from: new Date('2026-01-01T00:00:00.000Z'), unitPrice: 1 });
    const d2 = await prices.createDraft(actor(), {
      clinicalServiceId: serviceId,
      pricingUnit: 'PER_VISIT',
      currency: 'SYP',
      unitPrice: 2,
      effectiveFrom: new Date(Date.now() + 86400000).toISOString(),
    });
    const v2 = await prices.publish(actor(), d2.id);
    await backdateScheduled(v2.id, new Date(Date.now() - 120_000));
    // Do not call activateDueSchedules — live path must activate
    const live = await prices.lookupActivePrice(actor(), serviceId, null, dims);
    expect(live.price.id).toBe(v2.id);
  });

  it('R-PA04-04 — concurrent reconcile + cancel race yields deterministic timeline', async () => {
    const v1 = await draftAndPublish({ from: new Date('2026-01-01T00:00:00.000Z'), unitPrice: 1 });
    const d2 = await prices.createDraft(actor(), {
      clinicalServiceId: serviceId,
      pricingUnit: 'PER_VISIT',
      currency: 'SYP',
      unitPrice: 2,
      effectiveFrom: new Date(Date.now() + 86400000).toISOString(),
    });
    const v2 = await prices.publish(actor(), d2.id);
    await backdateScheduled(v2.id, new Date(Date.now() - 30_000));
    audit.entries.length = 0;
    const settled = await Promise.allSettled([
      prices.lookupActivePrice(actor(), serviceId, null, dims),
      prices.activateDueSchedules(20),
      prices.inactivate(actor(), v2.id),
    ]);
    const inactivateOutcome = settled[2];
    expect(inactivateOutcome.status).toBe('fulfilled');
    if (inactivateOutcome.status === 'fulfilled') {
      expect((inactivateOutcome.value as { status: string }).status).toBe('INACTIVE');
    }

    const actives = await prisma.clinicalServicePriceVersion.count({
      where: { tenantId, clinicalServiceId: serviceId, status: 'ACTIVE' },
    });
    expect(actives).toBe(0);
    const re = await prisma.clinicalServicePriceVersion.findUniqueOrThrow({ where: { id: v2.id } });
    expect(re.status).toBe('INACTIVE');
    expect(prices.isNeverEffective(re)).toBe(false);
    const reV1 = await prisma.clinicalServicePriceVersion.findUniqueOrThrow({ where: { id: v1.id } });
    expect(reV1.status).toBe('SUPERSEDED');
    expect(reV1.supersededByVersionId).toBe(v2.id);

    const activateAudits = audit.entries.filter(
      (e) =>
        e.action === 'clinical_catalog.price.activate' &&
        e.resourceId === v2.id &&
        (e.details as { effectiveEntry?: boolean } | undefined)?.effectiveEntry === true,
    );
    expect(activateAudits.length).toBe(1);
    const withdrawAudits = audit.entries.filter(
      (e) => e.action === 'clinical_catalog.price.inactivate' && e.resourceId === v2.id,
    );
    expect(withdrawAudits.length).toBe(1);
    expect(
      audit.entries.filter(
        (e) => e.action === 'clinical_catalog.price.supersede' && e.resourceId === v2.id,
      ).length,
    ).toBe(0);
    expect(
      audit.entries.filter(
        (e) => e.action === 'clinical_catalog.price.supersede' && e.resourceId === v1.id,
      ).length,
    ).toBe(1);

    for (const outcome of settled) {
      if (outcome.status === 'rejected') {
        expect(outcome.reason).toBeTruthy();
      }
    }
  });

  it('R-PA04-05 — expired ACTIVE never returned successfully after reconcile', async () => {
    const v1 = await draftAndPublish({
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: new Date(Date.now() - 3600_000),
      unitPrice: 1,
    });
    await expect(
      prices.lookupActivePrice(actor(), serviceId, null, dims),
    ).rejects.toBeInstanceOf(ClinicalPriceLookupFailClosedError);
    const re = await prisma.clinicalServicePriceVersion.findUniqueOrThrow({ where: { id: v1.id } });
    expect(re.status).not.toBe('ACTIVE');
  });

  it('T20 — reconcile failure fails closed (no stale ACTIVE success)', async () => {
    await draftAndPublish({ from: new Date('2026-01-01T00:00:00.000Z'), unitPrice: 1 });
    const d2 = await prices.createDraft(actor(), {
      clinicalServiceId: serviceId,
      pricingUnit: 'PER_VISIT',
      currency: 'SYP',
      unitPrice: 2,
      effectiveFrom: new Date(Date.now() + 86400000).toISOString(),
    });
    const v2 = await prices.publish(actor(), d2.id);
    await backdateScheduled(v2.id, new Date(Date.now() - 60_000));
    const spy = jest
      .spyOn(prices, 'reconcileCommercialTimeline')
      .mockRejectedValueOnce(new Error('forced reconcile failure'));
    await expect(
      prices.lookupActivePrice(actor(), serviceId, null, dims),
    ).rejects.toThrow(/forced reconcile failure/);
    spy.mockRestore();
  });

  it('T18 — additive SCHEDULED posture; background disabled does not disable live gate', async () => {
    // Migration additive (SCHEDULED enum) validated by clean/upgrade scripts separately.
    // Operational background switch must not disable on-demand correctness.
    const prev = process.env.BACKGROUND_SCHEDULERS_ENABLED;
    process.env.BACKGROUND_SCHEDULERS_ENABLED = 'false';
    try {
      const v1 = await draftAndPublish({ from: new Date('2026-01-01T00:00:00.000Z'), unitPrice: 1 });
      expect((await prices.lookupActivePrice(actor(), serviceId, null, dims)).price.id).toBe(v1.id);
      const d2 = await prices.createDraft(actor(), {
        clinicalServiceId: serviceId,
        pricingUnit: 'PER_VISIT',
        currency: 'SYP',
        unitPrice: 2,
        effectiveFrom: new Date(Date.now() + 86400000).toISOString(),
      });
      const v2 = await prices.publish(actor(), d2.id);
      await backdateScheduled(v2.id, new Date(Date.now() - 45_000));
      const live = await prices.lookupActivePrice(actor(), serviceId, null, dims);
      expect(live.price.id).toBe(v2.id);
    } finally {
      if (prev === undefined) delete process.env.BACKGROUND_SCHEDULERS_ENABLED;
      else process.env.BACKGROUND_SCHEDULERS_ENABLED = prev;
    }
  });

  it('PA04-BR-01 — tenant ACTIVE + no branch rows → tenant', async () => {
    const tenant = await draftAndPublish({ from: new Date('2026-01-01T00:00:00.000Z'), unitPrice: 5 });
    const live = await prices.lookupActivePrice(actor(), serviceId, branchId, dims);
    expect(live.scope).toBe('tenant');
    expect(live.price.id).toBe(tenant.id);
  });

  it('PA04-BR-02 — tenant ACTIVE + branch future SCHEDULED not due → tenant', async () => {
    const tenant = await draftAndPublish({ from: new Date('2026-01-01T00:00:00.000Z'), unitPrice: 5 });
    const fut = await draftAndPublish({
      from: new Date(Date.now() + 14 * 86400000),
      unitPrice: 9,
      branchId,
    });
    expect(fut.status).toBe('SCHEDULED');
    const live = await prices.lookupActivePrice(actor(), serviceId, branchId, dims);
    expect(live.scope).toBe('tenant');
    expect(live.price.id).toBe(tenant.id);
  });

  it('PA04-BR-03 — tenant ACTIVE + branch historical/inactive only → tenant', async () => {
    const tenant = await draftAndPublish({ from: new Date('2026-01-01T00:00:00.000Z'), unitPrice: 5 });
    const branch = await draftAndPublish({
      from: new Date('2026-01-01T00:00:00.000Z'),
      unitPrice: 9,
      branchId,
    });
    await prices.inactivate(actor(), branch.id);
    const live = await prices.lookupActivePrice(actor(), serviceId, branchId, dims);
    expect(live.scope).toBe('tenant');
    expect(live.price.id).toBe(tenant.id);
  });

  it('PA04-BR-04 — tenant ACTIVE + branch current ACTIVE → branch', async () => {
    await draftAndPublish({ from: new Date('2026-01-01T00:00:00.000Z'), unitPrice: 5 });
    const branch = await draftAndPublish({
      from: new Date('2026-01-01T00:00:00.000Z'),
      unitPrice: 9,
      branchId,
    });
    const live = await prices.lookupActivePrice(actor(), serviceId, branchId, dims);
    expect(live.scope).toBe('branch');
    expect(live.price.id).toBe(branch.id);
  });

  it('PA04-BR-05 — branch due SCHEDULED reconcile succeeds → branch', async () => {
    await draftAndPublish({ from: new Date('2026-01-01T00:00:00.000Z'), unitPrice: 5 });
    const d = await prices.createDraft(actor(), {
      clinicalServiceId: serviceId,
      branchId,
      pricingUnit: 'PER_VISIT',
      currency: 'SYP',
      unitPrice: 9,
      effectiveFrom: new Date(Date.now() + 86400000).toISOString(),
    });
    const scheduled = await prices.publish(actor(), d.id);
    await backdateScheduled(scheduled.id, new Date(Date.now() - 20_000));
    const live = await prices.lookupActivePrice(actor(), serviceId, branchId, dims);
    expect(live.scope).toBe('branch');
    expect(live.price.id).toBe(scheduled.id);
  });

  it('PA04-BR-07 — tenant ACTIVE + corrupt branch dual ACTIVE → fail closed', async () => {
    await draftAndPublish({ from: new Date('2026-01-01T00:00:00.000Z'), unitPrice: 5 });
    await draftAndPublish({
      from: new Date('2026-01-01T00:00:00.000Z'),
      unitPrice: 9,
      branchId,
    });
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', true)`;
      await tx.clinicalServicePriceVersion.create({
        data: {
          tenantId,
          branchId,
          clinicalServiceId: serviceId,
          serviceVariantId: null,
          pricingUnit: 'PER_VISIT',
          currency: 'SYP',
          unitPrice: 99,
          taxPercent: 0,
          effectiveFrom: new Date('2026-02-01T00:00:00.000Z'),
          status: 'ACTIVE',
          publishedAt: new Date(),
          publishedBy: actor().actorId,
        },
      });
    });
    await expect(
      prices.lookupActivePrice(actor(), serviceId, branchId, dims),
    ).rejects.toBeInstanceOf(ClinicalCatalogConflictError);
  });

  it('PA04-BR-08 — no usable branch + no usable tenant → fail closed', async () => {
    await expect(
      prices.lookupActivePrice(actor(), serviceId, branchId, dims),
    ).rejects.toBeInstanceOf(ClinicalPriceLookupFailClosedError);
  });

  it('PA04-AT-01 — omitted at uses current live path', async () => {
    const v1 = await draftAndPublish({ from: new Date('2026-01-01T00:00:00.000Z'), unitPrice: 1 });
    const live = await prices.lookupActivePrice(actor(), serviceId, null, dims);
    expect(live.price.id).toBe(v1.id);
  });

  it('PA04-AT-02/03 — past and near-now past at are historical read-only', async () => {
    const v1 = await draftAndPublish({ from: new Date('2026-01-01T00:00:00.000Z'), unitPrice: 1 });
    const d2 = await prices.createDraft(actor(), {
      clinicalServiceId: serviceId,
      pricingUnit: 'PER_VISIT',
      currency: 'SYP',
      unitPrice: 2,
      effectiveFrom: new Date(Date.now() + 86400000).toISOString(),
    });
    const v2 = await prices.publish(actor(), d2.id);
    await backdateScheduled(v2.id, new Date(Date.now() - 2 * 86400000));
    await prices.lookupActivePrice(actor(), serviceId, null, dims);
    audit.entries.length = 0;
    const hist = await prices.lookupActivePrice(actor(), serviceId, null, {
      ...dims,
      at: new Date(Date.now() - 5 * 86400000),
    });
    expect(hist.price.id).toBe(v1.id);
    const nearPast = await prices.lookupActivePrice(actor(), serviceId, null, {
      ...dims,
      at: new Date(Date.now() - 500),
    });
    expect(nearPast.price.id).toBe(v2.id);
    expect(audit.entries.filter((e) => e.action.includes('activate')).length).toBe(0);
    const stillV2 = await prisma.clinicalServicePriceVersion.findUniqueOrThrow({ where: { id: v2.id } });
    expect(stillV2.status).toBe('ACTIVE');
  });

  it('PA04-AT-04/05 — future at rejected and does not mutate SCHEDULED', async () => {
    await draftAndPublish({ from: new Date('2026-01-01T00:00:00.000Z'), unitPrice: 1 });
    const fut = await draftAndPublish({
      from: new Date(Date.now() + 10 * 86400000),
      unitPrice: 2,
    });
    await expect(
      prices.lookupActivePrice(actor(), serviceId, null, {
        ...dims,
        at: new Date(Date.now() + 11 * 86400000),
      }),
    ).rejects.toBeInstanceOf(ClinicalCatalogValidationError);
    const re = await prisma.clinicalServicePriceVersion.findUniqueOrThrow({ where: { id: fut.id } });
    expect(re.status).toBe('SCHEDULED');
  });

  it('PA04-AT-06 — historical lookup emits no lifecycle audit transitions', async () => {
    await draftAndPublish({ from: new Date('2026-01-01T00:00:00.000Z'), unitPrice: 1 });
    audit.entries.length = 0;
    await prices.lookupActivePrice(actor(), serviceId, null, {
      ...dims,
      at: new Date('2026-03-01T00:00:00.000Z'),
    });
    expect(
      audit.entries.filter((e) =>
        ['clinical_catalog.price.activate', 'clinical_catalog.price.supersede', 'clinical_catalog.price.inactivate'].includes(
          e.action,
        ),
      ).length,
    ).toBe(0);
  });

  it('PA04-RPL-01 — future canceled V2 + same-boundary replacement before T2 allowed', async () => {
    const from = new Date(Date.now() + 12 * 86400000);
    const v2 = await draftAndPublish({ from, unitPrice: 10 });
    await prices.inactivate(actor(), v2.id);
    const draft = await prices.createDraft(actor(), {
      clinicalServiceId: serviceId,
      pricingUnit: 'PER_VISIT',
      currency: 'SYP',
      unitPrice: 15,
      effectiveFrom: from.toISOString(),
    });
    const replaced = await prices.replaceScheduled(actor(), v2.id, draft.id);
    expect(replaced.status).toBe('SCHEDULED');
    expect(Number(replaced.unitPrice)).toBe(15);
  });

  it('PA04-RPL-02 — canceled-never-effective after boundary passed → reject', async () => {
    const from = new Date(Date.now() + 8 * 86400000);
    const v2 = await draftAndPublish({ from, unitPrice: 10 });
    await prices.inactivate(actor(), v2.id);
    const pastBoundary = new Date(Date.now() - 86400000);
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', true)`;
      await tx.clinicalServicePriceVersion.update({
        where: { id: v2.id },
        data: {
          effectiveFrom: pastBoundary,
          inactivatedAt: new Date(pastBoundary.getTime() - 86400000),
        },
      });
    });
    const draft = await prices.createDraft(actor(), {
      clinicalServiceId: serviceId,
      pricingUnit: 'PER_VISIT',
      currency: 'SYP',
      unitPrice: 15,
      effectiveFrom: pastBoundary.toISOString(),
    });
    await expect(prices.replaceScheduled(actor(), v2.id, draft.id)).rejects.toBeTruthy();
  });

  it('PA04-RPL-03/05 — due SCHEDULED replace reconciles then rejects; history unchanged unitPrice', async () => {
    await draftAndPublish({ from: new Date('2026-01-01T00:00:00.000Z'), unitPrice: 1 });
    const d = await prices.createDraft(actor(), {
      clinicalServiceId: serviceId,
      pricingUnit: 'PER_VISIT',
      currency: 'SYP',
      unitPrice: 10,
      effectiveFrom: new Date(Date.now() + 86400000).toISOString(),
    });
    const v2 = await prices.publish(actor(), d.id);
    const dueFrom = new Date(Date.now() - 10_000);
    await backdateScheduled(v2.id, dueFrom);
    const draft = await prices.createDraft(actor(), {
      clinicalServiceId: serviceId,
      pricingUnit: 'PER_VISIT',
      currency: 'SYP',
      unitPrice: 99,
      effectiveFrom: dueFrom.toISOString(),
    });
    await expect(prices.replaceScheduled(actor(), v2.id, draft.id)).rejects.toBeTruthy();
    const re = await prisma.clinicalServicePriceVersion.findUniqueOrThrow({ where: { id: v2.id } });
    expect(Number(re.unitPrice)).toBe(10);
    expect(re.status).not.toBe('SCHEDULED');
  });

  it('PA04-RPL-04 — due replacement reconcile failure → fail closed', async () => {
    const d = await prices.createDraft(actor(), {
      clinicalServiceId: serviceId,
      pricingUnit: 'PER_VISIT',
      currency: 'SYP',
      unitPrice: 10,
      effectiveFrom: new Date(Date.now() + 86400000).toISOString(),
    });
    const v2 = await prices.publish(actor(), d.id);
    const dueFrom = new Date(Date.now() - 10_000);
    await backdateScheduled(v2.id, dueFrom);
    const draft = await prices.createDraft(actor(), {
      clinicalServiceId: serviceId,
      pricingUnit: 'PER_VISIT',
      currency: 'SYP',
      unitPrice: 11,
      effectiveFrom: dueFrom.toISOString(),
    });
    const spy = jest
      .spyOn(prices, 'reconcileCommercialTimeline')
      .mockRejectedValueOnce(new Error('forced replace reconcile failure'));
    await expect(prices.replaceScheduled(actor(), v2.id, draft.id)).rejects.toThrow(
      /forced replace reconcile failure/,
    );
    spy.mockRestore();
  });

  it('PA04-RPL-06 — unpublished DRAFT→INACTIVE cannot be used as controlled replacement prior', async () => {
    const from = new Date(Date.now() + 14 * 86400000);
    const discarded = await prices.createDraft(actor(), {
      clinicalServiceId: serviceId,
      pricingUnit: 'PER_VISIT',
      currency: 'SYP',
      unitPrice: 10,
      effectiveFrom: from.toISOString(),
    });
    const prior = await prices.inactivate(actor(), discarded.id);
    expect(prior.status).toBe('INACTIVE');
    expect(prior.publishedAt).toBeNull();
    expect(prices.isNeverEffective(prior)).toBe(true);

    const replacement = await prices.createDraft(actor(), {
      clinicalServiceId: serviceId,
      pricingUnit: 'PER_VISIT',
      currency: 'SYP',
      unitPrice: 15,
      effectiveFrom: from.toISOString(),
    });
    audit.entries.length = 0;
    await expect(prices.replaceScheduled(actor(), prior.id, replacement.id)).rejects.toBeTruthy();

    const rePrior = await prisma.clinicalServicePriceVersion.findUniqueOrThrow({
      where: { id: prior.id },
    });
    const reReplacement = await prisma.clinicalServicePriceVersion.findUniqueOrThrow({
      where: { id: replacement.id },
    });
    expect(rePrior.status).toBe('INACTIVE');
    expect(rePrior.publishedAt).toBeNull();
    expect(Number(rePrior.unitPrice)).toBe(10);
    expect(reReplacement.status).toBe('DRAFT');
    expect(
      audit.entries.filter((e) =>
        ['clinical_catalog.price.schedule', 'clinical_catalog.price.cancel_scheduled'].includes(
          e.action,
        ),
      ).length,
    ).toBe(0);
  });

  it('PA04-IMP-02 — ACTIVE withdrawal is INACTIVE; no manual supersede API', async () => {
    const v1 = await draftAndPublish({ from: new Date('2026-01-01T00:00:00.000Z'), unitPrice: 1 });
    expect((prices as { supersede?: unknown }).supersede).toBeUndefined();
    const withdrawn = await prices.inactivate(actor(), v1.id);
    expect(withdrawn.status).toBe('INACTIVE');
  });
});
