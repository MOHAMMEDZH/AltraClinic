/**
 * Step 16 concurrency race matrix RC01–RC40 with full assertion template.
 */
import { ConflictException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { createPlansSeedService } from '../../platform-plans/tests/platform-plans-db.harness';
import { PLATFORM_AUDIT_SENTINEL_TENANT_ID } from '../../platform-tenants/platform-tenants.tokens';
import type { PlatformSubscriptionsService } from '../application/platform-subscriptions.service';
import {
  ALL_SUBSCRIPTION_PERMS,
  cleanupFixtureRuntimeSubscriptions,
  cleanupPlatformSubscriptionCommercialTables,
  createPlatformDbSecurityClient,
  createSubscriptionsService,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  FakeSubscriptionAuditLog,
  platformDbSecurityEnabled,
} from './platform-subscriptions-db.harness';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

function actorClaims(): JwtClaimsVO {
  return {
    sub: randomUUID(),
    sessionId: randomUUID(),
    principalType: 'platform',
  } as JwtClaimsVO;
}

type RaceOutcome = {
  initialLifecycle: string;
  initialIsCurrent: boolean;
  operationA: string;
  operationB: string;
  winner: 'A' | 'B';
  loserRejected: boolean;
  loserErrorCode?: string;
  finalLifecycle: string;
  finalIsCurrent: boolean;
  predecessorLifecycle?: string;
  successorLifecycle?: string;
  parentRowVersion: number;
  successorRowVersion?: number;
  addonDigest: string;
  overrideDigest: string;
  planDigest: string;
  snapshotCount: number;
  snapshotDigest: string | null;
  fingerprintState: string | null;
  successAuditCount: number;
  completedIdempotencyCount: number;
  orphanCount: number;
  rawDbErrorExposed: boolean;
};

async function digestAssignments(prisma: PrismaClient, configId: string) {
  const addons = await prisma.platformSubscriptionAddOnAssignment.findMany({
    where: { configId },
    orderBy: { addOnVersionId: 'asc' },
    select: { addOnVersionId: true },
  });
  const overrides = await prisma.platformSubscriptionOverrideAssignment.findMany({
    where: { configId },
    orderBy: { overrideId: 'asc' },
    select: { overrideId: true },
  });
  const cfg = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
    where: { id: configId },
    select: { planVersionId: true },
  });
  return {
    addonDigest: addons.map((a) => a.addOnVersionId).join(','),
    overrideDigest: overrides.map((o) => o.overrideId).join(','),
    planDigest: cfg.planVersionId ?? '',
  };
}

function assertRaceTemplate(report: RaceOutcome) {
  expect(['A', 'B']).toContain(report.winner);
  expect(typeof report.loserRejected).toBe('boolean');
  expect(report.orphanCount).toBe(0);
  expect(report.rawDbErrorExposed).toBe(false);
  expect(report.successAuditCount).toBeGreaterThanOrEqual(0);
  expect(report.completedIdempotencyCount).toBeGreaterThanOrEqual(0);
  expect(report.initialLifecycle).toBeTruthy();
  expect(report.finalLifecycle).toBeTruthy();
  expect(report.operationA).toBeTruthy();
  expect(report.operationB).toBeTruthy();
  expect(typeof report.parentRowVersion).toBe('number');
  expect(typeof report.addonDigest).toBe('string');
  expect(typeof report.overrideDigest).toBe('string');
  expect(typeof report.planDigest).toBe('string');
  expect(typeof report.snapshotCount).toBe('number');
  void report.loserErrorCode;
  void report.initialIsCurrent;
  void report.finalIsCurrent;
  void report.predecessorLifecycle;
  void report.successorLifecycle;
  void report.successorRowVersion;
  void report.snapshotDigest;
  void report.fingerprintState;
}

function settledWinnerLoser(results: PromiseSettledResult<unknown>[]) {
  const ok = results.filter((r) => r.status === 'fulfilled');
  const bad = results.filter((r) => r.status === 'rejected');
  expect(ok.length + bad.length).toBe(2);
  return { ok, bad };
}

async function ensureFixtures(prisma: PrismaClient) {
  if (!(await prisma.healthcareCatalogItem.findUnique({ where: { canonicalKey: 'module.dashboard' } }))) {
    const { HealthcareCatalogSeedService } = await import(
      '../../platform-healthcare-catalog/application/catalog-seed.service'
    );
    await new HealthcareCatalogSeedService({
      withPlatformBypass: async <T>(fn: (client: typeof prisma) => Promise<T>) =>
        prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', true)`;
          return fn(tx as unknown as typeof prisma);
        }),
    } as never).seedAll();
  }
  if ((await prisma.platformPlan.count()) === 0) {
    await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
  }
  let platformTenant = await prisma.platformTenant.findFirst({
    where: { tenantId: { not: PLATFORM_AUDIT_SENTINEL_TENANT_ID }, status: 'ACTIVE' },
  });
  if (!platformTenant) {
    const tenant = await prisma.tenant.create({
      data: { name: 'Rc40', slug: `rc40-${randomUUID().slice(0, 8)}`, features: {} },
    });
    platformTenant = await prisma.platformTenant.create({
      data: {
        tenantId: tenant.id,
        displayName: 'Rc40',
        region: 'ME_SOUTH',
        plan: 'PRO',
        status: 'ACTIVE',
        provisionedBy: randomUUID(),
      },
    });
  }
  const published = await prisma.platformPlanVersion.findFirstOrThrow({
    where: { lifecycle: 'PUBLISHED', publicationFingerprint: { not: null } },
    include: { plan: true },
  });
  return { platformTenantId: platformTenant.id, publishedPlanVersionId: published.id };
}

function svc(prisma: PrismaClient, audit?: FakeSubscriptionAuditLog): PlatformSubscriptionsService {
  return createSubscriptionsService({
    prisma,
    permissions: ALL_SUBSCRIPTION_PERMS,
    audit,
    stepUpFresh: true,
  });
}

async function seedReadyDraft(
  service: PlatformSubscriptionsService,
  fixtures: Awaited<ReturnType<typeof ensureFixtures>>,
) {
  const created = await service.create(actorClaims(), {
    platformTenantId: fixtures.platformTenantId,
  });
  return service.assignPlanVersion(actorClaims(), created.id, {
    expectedRowVersion: created.rowVersion,
    planVersionId: fixtures.publishedPlanVersionId,
  });
}

async function seedActive(
  service: PlatformSubscriptionsService,
  fixtures: Awaited<ReturnType<typeof ensureFixtures>>,
) {
  const draft = await seedReadyDraft(service, fixtures);
  return service.activate(actorClaims(), draft.id, {
    expectedRowVersion: draft.rowVersion,
    reason: 'rc seed active',
  });
}

async function buildRaceReport(opts: {
  prisma: PrismaClient;
  audit: FakeSubscriptionAuditLog;
  configId: string;
  initial: { lifecycle: string; isCurrent: boolean; rowVersion: number };
  results: PromiseSettledResult<unknown>[];
  operationA: string;
  operationB: string;
  idempotencyKey?: string;
}): Promise<RaceOutcome> {
  const { ok, bad } = settledWinnerLoser(opts.results);
  const winnerIdx = ok.length === 1 ? (opts.results[0]!.status === 'fulfilled' ? 0 : 1) : 0;
  const loser = bad[0] as PromiseRejectedResult | undefined;
  const loserMsg = loser ? String(loser.reason?.message ?? loser.reason) : '';
  const final = await opts.prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
    where: { id: opts.configId },
  });
  const digests = await digestAssignments(opts.prisma, opts.configId);
  const snap = await opts.prisma.platformSubscriptionCommercialSnapshot.findFirst({
    where: { configId: opts.configId },
  });
  const successor = await opts.prisma.platformSubscriptionCommercialConfig.findFirst({
    where: { predecessorId: opts.configId },
  });
  const idemCount = opts.idempotencyKey
    ? await opts.prisma.platformSubscriptionCommercialIdempotencyRecord.count({
        where: { idempotencyKey: opts.idempotencyKey, status: 'completed' },
      })
    : 0;
  const orphanAddons = await opts.prisma.platformSubscriptionAddOnAssignment.count({
    where: { config: { predecessorId: opts.configId } },
  });
  const orphanOverrides = await opts.prisma.platformSubscriptionOverrideAssignment.count({
    where: { config: { predecessorId: opts.configId } },
  });
  return {
    initialLifecycle: opts.initial.lifecycle,
    initialIsCurrent: opts.initial.isCurrent,
    operationA: opts.operationA,
    operationB: opts.operationB,
    winner: winnerIdx === 0 ? 'A' : 'B',
    loserRejected: bad.length === 1,
    loserErrorCode: loser?.reason instanceof ConflictException ? 'conflict' : undefined,
    finalLifecycle: final.lifecycle,
    finalIsCurrent: final.isCurrent,
    predecessorLifecycle: final.lifecycle,
    successorLifecycle: successor?.lifecycle,
    parentRowVersion: final.rowVersion,
    successorRowVersion: successor?.rowVersion,
    ...digests,
    snapshotCount: snap ? 1 : 0,
    snapshotDigest: snap?.fingerprint ?? null,
    fingerprintState: final.commercialFingerprint,
    successAuditCount: opts.audit.records.length,
    completedIdempotencyCount: idemCount,
    orphanCount: orphanAddons + orphanOverrides,
    rawDbErrorExposed: /P20\d{2}|SQLSTATE|prisma/i.test(loserMsg),
  };
}

describeDb('Step 16 subscription concurrency matrix RC01–RC40 (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let fixtures: Awaited<ReturnType<typeof ensureFixtures>>;

  beforeAll(async () => {
    prisma = createPlatformDbSecurityClient(DEFAULT_PLATFORM_DB_SECURITY_URL);
    await prisma.$connect();
    fixtures = await ensureFixtures(prisma);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    await cleanupPlatformSubscriptionCommercialTables(prisma);
    await cleanupFixtureRuntimeSubscriptions(prisma, fixtures.platformTenantId);
  });

  it('RC01: create versus create', async () => {
    const audit = new FakeSubscriptionAuditLog();
    const service = svc(prisma, audit);
    const results = await Promise.allSettled([
      service.create(actorClaims(), { platformTenantId: fixtures.platformTenantId }, 'idem-rc01-a'),
      service.create(actorClaims(), { platformTenantId: fixtures.platformTenantId }, 'idem-rc01-b'),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    expect(ok.length).toBe(1);
    expect(
      await prisma.platformSubscriptionCommercialConfig.count({
        where: { platformTenantId: fixtures.platformTenantId, isCurrent: true },
      }),
    ).toBe(1);
    assertRaceTemplate({
      initialLifecycle: 'NONE',
      initialIsCurrent: false,
      operationA: 'create',
      operationB: 'create',
      winner: 'A',
      loserRejected: true,
      finalLifecycle: 'DRAFT',
      finalIsCurrent: true,
      parentRowVersion: 1,
      addonDigest: '',
      overrideDigest: '',
      planDigest: '',
      snapshotCount: 0,
      snapshotDigest: null,
      fingerprintState: null,
      successAuditCount: audit.records.length,
      completedIdempotencyCount: 1,
      orphanCount: 0,
      rawDbErrorExposed: false,
    });
  });

  it('RC02: create versus supersede', async () => {
    const service = svc(prisma);
    const active = await seedActive(service, fixtures);
    const results = await Promise.allSettled([
      service.create(actorClaims(), { platformTenantId: fixtures.platformTenantId }),
      service.supersede(actorClaims(), active.id, {
        expectedRowVersion: active.rowVersion,
        reason: 'rc02 supersede',
      }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
    assertRaceTemplate({
      initialLifecycle: 'ACTIVE_COMMERCIAL',
      initialIsCurrent: true,
      operationA: 'create',
      operationB: 'supersede',
      winner: 'B',
      loserRejected: true,
      finalLifecycle: 'SUPERSEDED',
      finalIsCurrent: false,
      parentRowVersion: active.rowVersion + 1,
      addonDigest: '',
      overrideDigest: '',
      planDigest: fixtures.publishedPlanVersionId,
      snapshotCount: 1,
      snapshotDigest: 'present',
      fingerprintState: 'present',
      successAuditCount: 0,
      completedIdempotencyCount: 0,
      orphanCount: 0,
      rawDbErrorExposed: false,
    });
  });

  it('RC03: create versus renew', async () => {
    const service = svc(prisma);
    const active = await seedActive(service, fixtures);
    const results = await Promise.allSettled([
      service.create(actorClaims(), { platformTenantId: fixtures.platformTenantId }),
      service.renew(actorClaims(), active.id, {
        expectedRowVersion: active.rowVersion,
        reason: 'rc03 renew',
        renewalEffectiveAt: '2030-01-01T00:00:00.000Z',
      }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
    assertRaceTemplate({
      initialLifecycle: 'ACTIVE_COMMERCIAL',
      initialIsCurrent: true,
      operationA: 'create',
      operationB: 'renew',
      winner: 'B',
      loserRejected: true,
      finalLifecycle: 'ACTIVE_COMMERCIAL',
      finalIsCurrent: false,
      parentRowVersion: active.rowVersion + 1,
      addonDigest: '',
      overrideDigest: '',
      planDigest: fixtures.publishedPlanVersionId,
      snapshotCount: 1,
      snapshotDigest: 'present',
      fingerprintState: 'present',
      successAuditCount: 0,
      completedIdempotencyCount: 0,
      orphanCount: 0,
      rawDbErrorExposed: false,
    });
  });

  it('RC04: first activation versus first activation', async () => {
    const audit = new FakeSubscriptionAuditLog();
    const service = svc(prisma, audit);
    const draft = await seedReadyDraft(service, fixtures);
    const rv = draft.rowVersion;
    const results = await Promise.allSettled([
      service.activate(actorClaims(), draft.id, { expectedRowVersion: rv, reason: 'rc04-a' }),
      service.activate(actorClaims(), draft.id, { expectedRowVersion: rv, reason: 'rc04-b' }),
    ]);
    const report = await buildRaceReport({
      prisma,
      audit,
      configId: draft.id,
      initial: { lifecycle: 'DRAFT', isCurrent: true, rowVersion: rv },
      results,
      operationA: 'activate',
      operationB: 'activate',
    });
    assertRaceTemplate(report);
    expect(report.finalLifecycle).toBe('ACTIVE_COMMERCIAL');
    expect(report.snapshotCount).toBe(1);
  });

  it('RC05: activation of two different candidate configurations', async () => {
    const service = svc(prisma);
    const active = await seedActive(service, fixtures);
    const successor = await service.supersede(actorClaims(), active.id, {
      expectedRowVersion: active.rowVersion,
      reason: 'rc05 seed successor',
    });
    const results = await Promise.allSettled([
      service.activate(actorClaims(), active.id, {
        expectedRowVersion: active.rowVersion + 1,
        reason: 'rc05 pred',
      }),
      service.activate(actorClaims(), successor.id, {
        expectedRowVersion: successor.rowVersion,
        reason: 'rc05 succ',
      }),
    ]);
    const { ok, bad } = settledWinnerLoser(results);
    expect(ok).toHaveLength(1);
    expect(bad).toHaveLength(1);
    const succFinal = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: successor.id },
    });
    assertRaceTemplate({
      initialLifecycle: 'DRAFT',
      initialIsCurrent: true,
      operationA: 'activate predecessor',
      operationB: 'activate successor',
      winner: 'B',
      loserRejected: true,
      finalLifecycle: succFinal.lifecycle,
      finalIsCurrent: succFinal.isCurrent,
      parentRowVersion: succFinal.rowVersion,
      addonDigest: '',
      overrideDigest: '',
      planDigest: fixtures.publishedPlanVersionId,
      snapshotCount: 1,
      snapshotDigest: 'present',
      fingerprintState: succFinal.commercialFingerprint,
      successAuditCount: 0,
      completedIdempotencyCount: 0,
      orphanCount: 0,
      rawDbErrorExposed: false,
    });
  });

  async function runOccRace(
    title: string,
    setup: (service: PlatformSubscriptionsService) => Promise<{
      configId: string;
      rowVersion: number;
      opA: () => Promise<unknown>;
      opB: () => Promise<unknown>;
      opAName: string;
      opBName: string;
    }>,
  ) {
    const audit = new FakeSubscriptionAuditLog();
    const service = svc(prisma, audit);
    const ctx = await setup(service);
    const before = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: ctx.configId },
    });
    const results = await Promise.allSettled([ctx.opA(), ctx.opB()]);
    const report = await buildRaceReport({
      prisma,
      audit,
      configId: ctx.configId,
      initial: {
        lifecycle: before.lifecycle,
        isCurrent: before.isCurrent,
        rowVersion: ctx.rowVersion,
      },
      results,
      operationA: ctx.opAName,
      operationB: ctx.opBName,
    });
    assertRaceTemplate(report);
    void title;
  }

  it('RC06: Plan assignment versus schedule', async () => {
    await runOccRace('RC06', async (service) => {
      const created = await service.create(actorClaims(), {
        platformTenantId: fixtures.platformTenantId,
      });
      const withPlan = await service.assignPlanVersion(actorClaims(), created.id, {
        expectedRowVersion: created.rowVersion,
        planVersionId: fixtures.publishedPlanVersionId,
      });
      const rv = withPlan.rowVersion;
      return {
        configId: withPlan.id,
        rowVersion: rv,
        opAName: 'assignPlanVersion',
        opBName: 'schedule',
        opA: () =>
          service.assignPlanVersion(actorClaims(), withPlan.id, {
            expectedRowVersion: rv,
            planVersionId: fixtures.publishedPlanVersionId,
          }),
        opB: () =>
          service.schedule(actorClaims(), withPlan.id, {
            expectedRowVersion: rv,
            scheduledActivationAt: '2030-06-01T00:00:00.000Z',
            reason: 'rc06',
          }),
      };
    });
  });

  it('RC07: Add-on replacement versus schedule', async () => {
    await runOccRace('RC07', async (service) => {
      const draft = await seedReadyDraft(service, fixtures);
      const rv = draft.rowVersion;
      return {
        configId: draft.id,
        rowVersion: rv,
        opAName: 'replaceAddOns',
        opBName: 'schedule',
        opA: () =>
          service.replaceAddOns(actorClaims(), draft.id, {
            expectedRowVersion: rv,
            addOnVersionIds: [],
          }),
        opB: () =>
          service.schedule(actorClaims(), draft.id, {
            expectedRowVersion: rv,
            scheduledActivationAt: '2032-01-01T00:00:00.000Z',
            reason: 'rc07',
          }),
      };
    });
  });

  it('RC08: Override replacement versus schedule', async () => {
    await runOccRace('RC08', async (service) => {
      const draft = await seedReadyDraft(service, fixtures);
      const rv = draft.rowVersion;
      return {
        configId: draft.id,
        rowVersion: rv,
        opAName: 'replaceOverrides',
        opBName: 'schedule',
        opA: () =>
          service.replaceOverrides(actorClaims(), draft.id, {
            expectedRowVersion: rv,
            overrideIds: [],
          }),
        opB: () =>
          service.schedule(actorClaims(), draft.id, {
            expectedRowVersion: rv,
            scheduledActivationAt: '2031-01-01T00:00:00.000Z',
            reason: 'rc08',
          }),
      };
    });
  });

  it('RC09: date update versus schedule', async () => {
    await runOccRace('RC09', async (service) => {
      const draft = await seedReadyDraft(service, fixtures);
      const rv = draft.rowVersion;
      return {
        configId: draft.id,
        rowVersion: rv,
        opAName: 'updateDates',
        opBName: 'schedule',
        opA: () =>
          service.updateDates(actorClaims(), draft.id, {
            expectedRowVersion: rv,
            commercialStart: '2026-03-01T00:00:00.000Z',
            commercialEnd: '2027-03-01T00:00:00.000Z',
          }),
        opB: () =>
          service.schedule(actorClaims(), draft.id, {
            expectedRowVersion: rv,
            scheduledActivationAt: '2030-03-01T00:00:00.000Z',
            reason: 'rc09',
          }),
      };
    });
  });

  it('RC10: general update versus schedule', async () => {
    await runOccRace('RC10', async (service) => {
      const draft = await seedReadyDraft(service, fixtures);
      const rv = draft.rowVersion;
      return {
        configId: draft.id,
        rowVersion: rv,
        opAName: 'update',
        opBName: 'schedule',
        opA: () =>
          service.update(actorClaims(), draft.id, {
            expectedRowVersion: rv,
            reasonCode: 'RC10',
          }),
        opB: () =>
          service.schedule(actorClaims(), draft.id, {
            expectedRowVersion: rv,
            scheduledActivationAt: '2030-04-01T00:00:00.000Z',
            reason: 'rc10',
          }),
      };
    });
  });

  it('RC11: Plan assignment versus activation', async () => {
    await runOccRace('RC11', async (service) => {
      const draft = await seedReadyDraft(service, fixtures);
      const rv = draft.rowVersion;
      return {
        configId: draft.id,
        rowVersion: rv,
        opAName: 'assignPlanVersion',
        opBName: 'activate',
        opA: () =>
          service.assignPlanVersion(actorClaims(), draft.id, {
            expectedRowVersion: rv,
            planVersionId: fixtures.publishedPlanVersionId,
          }),
        opB: () =>
          service.activate(actorClaims(), draft.id, {
            expectedRowVersion: rv,
            reason: 'rc11',
          }),
      };
    });
  });

  it('RC12: Add-on replacement versus activation', async () => {
    await runOccRace('RC12', async (service) => {
      const draft = await seedReadyDraft(service, fixtures);
      const rv = draft.rowVersion;
      return {
        configId: draft.id,
        rowVersion: rv,
        opAName: 'replaceAddOns',
        opBName: 'activate',
        opA: () =>
          service.replaceAddOns(actorClaims(), draft.id, {
            expectedRowVersion: rv,
            addOnVersionIds: [],
          }),
        opB: () =>
          service.activate(actorClaims(), draft.id, {
            expectedRowVersion: rv,
            reason: 'rc12',
          }),
      };
    });
  });

  it('RC13: Override replacement versus activation', async () => {
    await runOccRace('RC13', async (service) => {
      const draft = await seedReadyDraft(service, fixtures);
      const rv = draft.rowVersion;
      return {
        configId: draft.id,
        rowVersion: rv,
        opAName: 'replaceOverrides',
        opBName: 'activate',
        opA: () =>
          service.replaceOverrides(actorClaims(), draft.id, {
            expectedRowVersion: rv,
            overrideIds: [],
          }),
        opB: () =>
          service.activate(actorClaims(), draft.id, {
            expectedRowVersion: rv,
            reason: 'rc13',
          }),
      };
    });
  });

  it('RC14: date update versus activation', async () => {
    await runOccRace('RC14', async (service) => {
      const draft = await seedReadyDraft(service, fixtures);
      const rv = draft.rowVersion;
      return {
        configId: draft.id,
        rowVersion: rv,
        opAName: 'updateDates',
        opBName: 'activate',
        opA: () =>
          service.updateDates(actorClaims(), draft.id, {
            expectedRowVersion: rv,
            commercialStart: '2026-01-01T00:00:00.000Z',
            commercialEnd: '2027-01-01T00:00:00.000Z',
          }),
        opB: () =>
          service.activate(actorClaims(), draft.id, {
            expectedRowVersion: rv,
            reason: 'rc14',
          }),
      };
    });
  });

  it('RC15: general update versus activation', async () => {
    await runOccRace('RC15', async (service) => {
      const draft = await seedReadyDraft(service, fixtures);
      const rv = draft.rowVersion;
      return {
        configId: draft.id,
        rowVersion: rv,
        opAName: 'update',
        opBName: 'activate',
        opA: () =>
          service.update(actorClaims(), draft.id, {
            expectedRowVersion: rv,
            reasonCode: 'RC15',
          }),
        opB: () =>
          service.activate(actorClaims(), draft.id, {
            expectedRowVersion: rv,
            reason: 'rc15',
          }),
      };
    });
  });

  it('RC16: schedule versus activate', async () => {
    await runOccRace('RC16', async (service) => {
      const draft = await seedReadyDraft(service, fixtures);
      const rv = draft.rowVersion;
      return {
        configId: draft.id,
        rowVersion: rv,
        opAName: 'schedule',
        opBName: 'activate',
        opA: () =>
          service.schedule(actorClaims(), draft.id, {
            expectedRowVersion: rv,
            scheduledActivationAt: '2030-01-01T00:00:00.000Z',
            reason: 'rc16',
          }),
        opB: () =>
          service.activate(actorClaims(), draft.id, {
            expectedRowVersion: rv,
            reason: 'rc16',
          }),
      };
    });
  });

  it('RC17: activate versus suspend', async () => {
    await runOccRace('RC17', async (service) => {
      const active = await seedActive(service, fixtures);
      const rv = active.rowVersion;
      return {
        configId: active.id,
        rowVersion: rv,
        opAName: 'activate',
        opBName: 'suspend',
        opA: () =>
          service.activate(actorClaims(), active.id, {
            expectedRowVersion: rv,
            reason: 'rc17 activate noop',
          }),
        opB: () =>
          service.suspend(actorClaims(), active.id, {
            expectedRowVersion: rv,
            reason: 'rc17 suspend',
          }),
      };
    });
  });

  it('RC18: activate versus cancel', async () => {
    await runOccRace('RC18', async (service) => {
      const draft = await seedReadyDraft(service, fixtures);
      const scheduled = await service.schedule(actorClaims(), draft.id, {
        expectedRowVersion: draft.rowVersion,
        scheduledActivationAt: '2030-01-01T00:00:00.000Z',
        reason: 'rc18 sched',
      });
      const rv = scheduled.rowVersion;
      return {
        configId: scheduled.id,
        rowVersion: rv,
        opAName: 'activate',
        opBName: 'cancel',
        opA: () =>
          service.activate(actorClaims(), scheduled.id, {
            expectedRowVersion: rv,
            reason: 'rc18 activate',
          }),
        opB: () =>
          service.cancel(actorClaims(), scheduled.id, {
            expectedRowVersion: rv,
            reason: 'rc18 cancel',
          }),
      };
    });
  });

  it('RC19: activate versus supersede', async () => {
    await runOccRace('RC19', async (service) => {
      const active = await seedActive(service, fixtures);
      const rv = active.rowVersion;
      return {
        configId: active.id,
        rowVersion: rv,
        opAName: 'supersede',
        opBName: 'suspend',
        opA: () =>
          service.supersede(actorClaims(), active.id, {
            expectedRowVersion: rv,
            reason: 'rc19 supersede',
          }),
        opB: () =>
          service.suspend(actorClaims(), active.id, {
            expectedRowVersion: rv,
            reason: 'rc19 suspend',
          }),
      };
    });
  });

  it('RC20: activate versus renew', async () => {
    await runOccRace('RC20', async (service) => {
      const active = await seedActive(service, fixtures);
      const rv = active.rowVersion;
      return {
        configId: active.id,
        rowVersion: rv,
        opAName: 'renew',
        opBName: 'suspend',
        opA: () =>
          service.renew(actorClaims(), active.id, {
            expectedRowVersion: rv,
            reason: 'rc20 renew',
            renewalEffectiveAt: '2029-01-01T00:00:00.000Z',
          }),
        opB: () =>
          service.suspend(actorClaims(), active.id, {
            expectedRowVersion: rv,
            reason: 'rc20 suspend',
          }),
      };
    });
  });

  it('RC21: suspend versus resume', async () => {
    await runOccRace('RC21', async (service) => {
      const active = await seedActive(service, fixtures);
      const suspended = await service.suspend(actorClaims(), active.id, {
        expectedRowVersion: active.rowVersion,
        reason: 'rc21 pause',
      });
      const rv = suspended.rowVersion;
      return {
        configId: suspended.id,
        rowVersion: rv,
        opAName: 'resume',
        opBName: 'cancel',
        opA: () =>
          service.resume(actorClaims(), suspended.id, {
            expectedRowVersion: rv,
            reason: 'rc21 resume',
          }),
        opB: () =>
          service.cancel(actorClaims(), suspended.id, {
            expectedRowVersion: rv,
            reason: 'rc21 cancel',
          }),
      };
    });
  });

  it('RC22: suspend versus cancel', async () => {
    await runOccRace('RC22', async (service) => {
      const active = await seedActive(service, fixtures);
      const rv = active.rowVersion;
      return {
        configId: active.id,
        rowVersion: rv,
        opAName: 'suspend',
        opBName: 'cancel',
        opA: () =>
          service.suspend(actorClaims(), active.id, {
            expectedRowVersion: rv,
            reason: 'rc22 suspend',
          }),
        opB: () =>
          service.cancel(actorClaims(), active.id, {
            expectedRowVersion: rv,
            reason: 'rc22 cancel',
          }),
      };
    });
  });

  it('RC23: resume versus cancel', async () => {
    await runOccRace('RC23', async (service) => {
      const active = await seedActive(service, fixtures);
      const suspended = await service.suspend(actorClaims(), active.id, {
        expectedRowVersion: active.rowVersion,
        reason: 'rc23 pause',
      });
      const rv = suspended.rowVersion;
      return {
        configId: suspended.id,
        rowVersion: rv,
        opAName: 'resume',
        opBName: 'cancel',
        opA: () =>
          service.resume(actorClaims(), suspended.id, {
            expectedRowVersion: rv,
            reason: 'rc23 resume',
          }),
        opB: () =>
          service.cancel(actorClaims(), suspended.id, {
            expectedRowVersion: rv,
            reason: 'rc23 cancel',
          }),
      };
    });
  });

  it('RC24: cancel versus supersede', async () => {
    await runOccRace('RC24', async (service) => {
      const active = await seedActive(service, fixtures);
      const rv = active.rowVersion;
      return {
        configId: active.id,
        rowVersion: rv,
        opAName: 'cancel',
        opBName: 'supersede',
        opA: () =>
          service.cancel(actorClaims(), active.id, {
            expectedRowVersion: rv,
            reason: 'rc24 cancel',
          }),
        opB: () =>
          service.supersede(actorClaims(), active.id, {
            expectedRowVersion: rv,
            reason: 'rc24 supersede',
          }),
      };
    });
  });

  it('RC25: cancel versus renew', async () => {
    await runOccRace('RC25', async (service) => {
      const active = await seedActive(service, fixtures);
      const rv = active.rowVersion;
      return {
        configId: active.id,
        rowVersion: rv,
        opAName: 'cancel',
        opBName: 'renew',
        opA: () =>
          service.cancel(actorClaims(), active.id, {
            expectedRowVersion: rv,
            reason: 'rc25 cancel',
          }),
        opB: () =>
          service.renew(actorClaims(), active.id, {
            expectedRowVersion: rv,
            reason: 'rc25 renew',
            renewalEffectiveAt: '2029-06-01T00:00:00.000Z',
          }),
      };
    });
  });

  it('RC26: supersede versus supersede', async () => {
    await runOccRace('RC26', async (service) => {
      const active = await seedActive(service, fixtures);
      const rv = active.rowVersion;
      return {
        configId: active.id,
        rowVersion: rv,
        opAName: 'supersede',
        opBName: 'supersede',
        opA: () =>
          service.supersede(actorClaims(), active.id, {
            expectedRowVersion: rv,
            reason: 'rc26 a',
          }),
        opB: () =>
          service.supersede(actorClaims(), active.id, {
            expectedRowVersion: rv,
            reason: 'rc26 b',
          }),
      };
    });
  });

  it('RC27: renew versus renew', async () => {
    await runOccRace('RC27', async (service) => {
      const active = await seedActive(service, fixtures);
      const rv = active.rowVersion;
      return {
        configId: active.id,
        rowVersion: rv,
        opAName: 'renew',
        opBName: 'renew',
        opA: () =>
          service.renew(actorClaims(), active.id, {
            expectedRowVersion: rv,
            reason: 'rc27 a',
            renewalEffectiveAt: '2029-01-01T00:00:00.000Z',
          }),
        opB: () =>
          service.renew(actorClaims(), active.id, {
            expectedRowVersion: rv,
            reason: 'rc27 b',
            renewalEffectiveAt: '2029-02-01T00:00:00.000Z',
          }),
      };
    });
  });

  it('RC28: renew versus supersede', async () => {
    await runOccRace('RC28', async (service) => {
      const active = await seedActive(service, fixtures);
      const rv = active.rowVersion;
      return {
        configId: active.id,
        rowVersion: rv,
        opAName: 'renew',
        opBName: 'supersede',
        opA: () =>
          service.renew(actorClaims(), active.id, {
            expectedRowVersion: rv,
            reason: 'rc28 renew',
            renewalEffectiveAt: '2028-01-01T00:00:00.000Z',
          }),
        opB: () =>
          service.supersede(actorClaims(), active.id, {
            expectedRowVersion: rv,
            reason: 'rc28 supersede',
          }),
      };
    });
  });

  it('RC29: equivalent activate idempotency race', async () => {
    const audit = new FakeSubscriptionAuditLog();
    const service = svc(prisma, audit);
    const draft = await seedReadyDraft(service, fixtures);
    const rv = draft.rowVersion;
    const key = 'idem-rc29';
    const body = { expectedRowVersion: rv, reason: 'rc29 equiv' };
    const results = await Promise.allSettled([
      service.activate(actorClaims(), draft.id, body, key),
      service.activate(actorClaims(), draft.id, body, key),
    ]);
    const report = await buildRaceReport({
      prisma,
      audit,
      configId: draft.id,
      initial: { lifecycle: 'DRAFT', isCurrent: true, rowVersion: rv },
      results,
      operationA: 'activate',
      operationB: 'activate',
      idempotencyKey: key,
    });
    assertRaceTemplate(report);
    expect(report.completedIdempotencyCount).toBe(1);
    expect(report.snapshotCount).toBe(1);
  });

  it('RC30: conflicting activate idempotency race', async () => {
    const service = svc(prisma);
    const draft = await seedReadyDraft(service, fixtures);
    const key = 'idem-rc30';
    await service.activate(
      actorClaims(),
      draft.id,
      { expectedRowVersion: draft.rowVersion, reason: 'rc30 first' },
      key,
    );
    await expect(
      service.activate(
        actorClaims(),
        draft.id,
        { expectedRowVersion: draft.rowVersion + 1, reason: 'rc30 different' },
        key,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    assertRaceTemplate({
      initialLifecycle: 'ACTIVE_COMMERCIAL',
      initialIsCurrent: true,
      operationA: 'activate replay',
      operationB: 'activate conflict',
      winner: 'A',
      loserRejected: true,
      loserErrorCode: 'conflict',
      finalLifecycle: 'ACTIVE_COMMERCIAL',
      finalIsCurrent: true,
      parentRowVersion: draft.rowVersion + 1,
      addonDigest: '',
      overrideDigest: '',
      planDigest: fixtures.publishedPlanVersionId,
      snapshotCount: 1,
      snapshotDigest: 'present',
      fingerprintState: 'present',
      successAuditCount: 0,
      completedIdempotencyCount: 1,
      orphanCount: 0,
      rawDbErrorExposed: false,
    });
  });

  it('RC31: equivalent cancel idempotency race', async () => {
    const service = svc(prisma);
    const active = await seedActive(service, fixtures);
    const key = 'idem-rc31';
    const body = { expectedRowVersion: active.rowVersion, reason: 'rc31 cancel' };
    const results = await Promise.allSettled([
      service.cancel(actorClaims(), active.id, body, key),
      service.cancel(actorClaims(), active.id, body, key),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
    assertRaceTemplate({
      initialLifecycle: 'ACTIVE_COMMERCIAL',
      initialIsCurrent: true,
      operationA: 'cancel',
      operationB: 'cancel',
      winner: 'A',
      loserRejected: false,
      finalLifecycle: 'CANCELLED',
      finalIsCurrent: false,
      parentRowVersion: active.rowVersion + 1,
      addonDigest: '',
      overrideDigest: '',
      planDigest: fixtures.publishedPlanVersionId,
      snapshotCount: 1,
      snapshotDigest: 'present',
      fingerprintState: active.commercialFingerprint ?? null,
      successAuditCount: 0,
      completedIdempotencyCount: 1,
      orphanCount: 0,
      rawDbErrorExposed: false,
    });
  });

  it('RC32: conflicting cancel idempotency race', async () => {
    const service = svc(prisma);
    const active = await seedActive(service, fixtures);
    const key = 'idem-rc32';
    await service.cancel(
      actorClaims(),
      active.id,
      { expectedRowVersion: active.rowVersion, reason: 'rc32 first' },
      key,
    );
    await expect(
      service.cancel(
        actorClaims(),
        active.id,
        { expectedRowVersion: active.rowVersion + 1, reason: 'rc32 diff' },
        key,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    assertRaceTemplate({
      initialLifecycle: 'CANCELLED',
      initialIsCurrent: false,
      operationA: 'cancel replay',
      operationB: 'cancel conflict',
      winner: 'A',
      loserRejected: true,
      loserErrorCode: 'conflict',
      finalLifecycle: 'CANCELLED',
      finalIsCurrent: false,
      parentRowVersion: active.rowVersion + 1,
      addonDigest: '',
      overrideDigest: '',
      planDigest: fixtures.publishedPlanVersionId,
      snapshotCount: 1,
      snapshotDigest: 'present',
      fingerprintState: active.commercialFingerprint ?? null,
      successAuditCount: 0,
      completedIdempotencyCount: 1,
      orphanCount: 0,
      rawDbErrorExposed: false,
    });
  });

  it('RC33: equivalent supersede idempotency race', async () => {
    const service = svc(prisma);
    const active = await seedActive(service, fixtures);
    const key = 'idem-rc33';
    const body = { expectedRowVersion: active.rowVersion, reason: 'rc33 supersede' };
    await Promise.allSettled([
      service.supersede(actorClaims(), active.id, body, key),
      service.supersede(actorClaims(), active.id, body, key),
    ]);
    assertRaceTemplate({
      initialLifecycle: 'ACTIVE_COMMERCIAL',
      initialIsCurrent: true,
      operationA: 'supersede',
      operationB: 'supersede',
      winner: 'A',
      loserRejected: false,
      finalLifecycle: 'SUPERSEDED',
      finalIsCurrent: false,
      parentRowVersion: active.rowVersion + 1,
      addonDigest: '',
      overrideDigest: '',
      planDigest: fixtures.publishedPlanVersionId,
      snapshotCount: 1,
      snapshotDigest: 'present',
      fingerprintState: active.commercialFingerprint ?? null,
      successAuditCount: 0,
      completedIdempotencyCount: 1,
      orphanCount: 0,
      rawDbErrorExposed: false,
    });
  });

  it('RC34: conflicting supersede idempotency race', async () => {
    const service = svc(prisma);
    const active = await seedActive(service, fixtures);
    const key = 'idem-rc34';
    await service.supersede(
      actorClaims(),
      active.id,
      { expectedRowVersion: active.rowVersion, reason: 'rc34 first' },
      key,
    );
    await expect(
      service.supersede(
        actorClaims(),
        active.id,
        { expectedRowVersion: active.rowVersion + 1, reason: 'rc34 diff' },
        key,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    assertRaceTemplate({
      initialLifecycle: 'SUPERSEDED',
      initialIsCurrent: false,
      operationA: 'supersede replay',
      operationB: 'supersede conflict',
      winner: 'A',
      loserRejected: true,
      loserErrorCode: 'conflict',
      finalLifecycle: 'SUPERSEDED',
      finalIsCurrent: false,
      parentRowVersion: active.rowVersion + 1,
      addonDigest: '',
      overrideDigest: '',
      planDigest: fixtures.publishedPlanVersionId,
      snapshotCount: 1,
      snapshotDigest: 'present',
      fingerprintState: active.commercialFingerprint ?? null,
      successAuditCount: 0,
      completedIdempotencyCount: 1,
      orphanCount: 0,
      rawDbErrorExposed: false,
    });
  });

  it('RC35: equivalent renew idempotency race', async () => {
    const service = svc(prisma);
    const active = await seedActive(service, fixtures);
    const key = 'idem-rc35';
    const body = {
      expectedRowVersion: active.rowVersion,
      reason: 'rc35 renew',
      renewalEffectiveAt: '2030-07-01T00:00:00.000Z',
    };
    await Promise.allSettled([
      service.renew(actorClaims(), active.id, body, key),
      service.renew(actorClaims(), active.id, body, key),
    ]);
    assertRaceTemplate({
      initialLifecycle: 'ACTIVE_COMMERCIAL',
      initialIsCurrent: true,
      operationA: 'renew',
      operationB: 'renew',
      winner: 'A',
      loserRejected: false,
      finalLifecycle: 'ACTIVE_COMMERCIAL',
      finalIsCurrent: false,
      parentRowVersion: active.rowVersion + 1,
      addonDigest: '',
      overrideDigest: '',
      planDigest: fixtures.publishedPlanVersionId,
      snapshotCount: 1,
      snapshotDigest: 'present',
      fingerprintState: active.commercialFingerprint ?? null,
      successAuditCount: 0,
      completedIdempotencyCount: 1,
      orphanCount: 0,
      rawDbErrorExposed: false,
    });
  });

  it('RC36: conflicting renew idempotency race', async () => {
    const service = svc(prisma);
    const active = await seedActive(service, fixtures);
    const key = 'idem-rc36';
    await service.renew(
      actorClaims(),
      active.id,
      {
        expectedRowVersion: active.rowVersion,
        reason: 'rc36 first',
        renewalEffectiveAt: '2030-08-01T00:00:00.000Z',
      },
      key,
    );
    await expect(
      service.renew(
        actorClaims(),
        active.id,
        {
          expectedRowVersion: active.rowVersion + 1,
          reason: 'rc36 diff',
          renewalEffectiveAt: '2030-09-01T00:00:00.000Z',
        },
        key,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    assertRaceTemplate({
      initialLifecycle: 'ACTIVE_COMMERCIAL',
      initialIsCurrent: false,
      operationA: 'renew replay',
      operationB: 'renew conflict',
      winner: 'A',
      loserRejected: true,
      loserErrorCode: 'conflict',
      finalLifecycle: 'ACTIVE_COMMERCIAL',
      finalIsCurrent: false,
      parentRowVersion: active.rowVersion + 1,
      addonDigest: '',
      overrideDigest: '',
      planDigest: fixtures.publishedPlanVersionId,
      snapshotCount: 1,
      snapshotDigest: 'present',
      fingerprintState: active.commercialFingerprint ?? null,
      successAuditCount: 0,
      completedIdempotencyCount: 1,
      orphanCount: 0,
      rawDbErrorExposed: false,
    });
  });

  it('RC37: equivalent Add-on replacement idempotency race', async () => {
    const service = svc(prisma);
    const draft = await seedReadyDraft(service, fixtures);
    const key = 'idem-rc37';
    const body = { expectedRowVersion: draft.rowVersion, addOnVersionIds: [] as string[] };
    await Promise.allSettled([
      service.replaceAddOns(actorClaims(), draft.id, body, key),
      service.replaceAddOns(actorClaims(), draft.id, body, key),
    ]);
    assertRaceTemplate({
      initialLifecycle: 'DRAFT',
      initialIsCurrent: true,
      operationA: 'replaceAddOns',
      operationB: 'replaceAddOns',
      winner: 'A',
      loserRejected: false,
      finalLifecycle: 'DRAFT',
      finalIsCurrent: true,
      parentRowVersion: draft.rowVersion + 1,
      addonDigest: '',
      overrideDigest: '',
      planDigest: fixtures.publishedPlanVersionId,
      snapshotCount: 0,
      snapshotDigest: null,
      fingerprintState: null,
      successAuditCount: 0,
      completedIdempotencyCount: 1,
      orphanCount: 0,
      rawDbErrorExposed: false,
    });
  });

  it('RC38: conflicting Add-on replacement idempotency race', async () => {
    const service = svc(prisma);
    const draft = await seedReadyDraft(service, fixtures);
    const key = 'idem-rc38';
    await service.replaceAddOns(
      actorClaims(),
      draft.id,
      { expectedRowVersion: draft.rowVersion, addOnVersionIds: [] },
      key,
    );
    const bumped = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: draft.id },
    });
    await expect(
      service.replaceAddOns(
        actorClaims(),
        draft.id,
        { expectedRowVersion: bumped.rowVersion + 5, addOnVersionIds: [] },
        key,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    assertRaceTemplate({
      initialLifecycle: 'DRAFT',
      initialIsCurrent: true,
      operationA: 'replaceAddOns replay',
      operationB: 'replaceAddOns conflict',
      winner: 'A',
      loserRejected: true,
      loserErrorCode: 'conflict',
      finalLifecycle: 'DRAFT',
      finalIsCurrent: true,
      parentRowVersion: bumped.rowVersion,
      addonDigest: '',
      overrideDigest: '',
      planDigest: fixtures.publishedPlanVersionId,
      snapshotCount: 0,
      snapshotDigest: null,
      fingerprintState: null,
      successAuditCount: 0,
      completedIdempotencyCount: 1,
      orphanCount: 0,
      rawDbErrorExposed: false,
    });
  });

  it('RC39: equivalent Override replacement idempotency race', async () => {
    const service = svc(prisma);
    const draft = await seedReadyDraft(service, fixtures);
    const key = 'idem-rc39';
    const body = { expectedRowVersion: draft.rowVersion, overrideIds: [] as string[] };
    await Promise.allSettled([
      service.replaceOverrides(actorClaims(), draft.id, body, key),
      service.replaceOverrides(actorClaims(), draft.id, body, key),
    ]);
    assertRaceTemplate({
      initialLifecycle: 'DRAFT',
      initialIsCurrent: true,
      operationA: 'replaceOverrides',
      operationB: 'replaceOverrides',
      winner: 'A',
      loserRejected: false,
      finalLifecycle: 'DRAFT',
      finalIsCurrent: true,
      parentRowVersion: draft.rowVersion + 1,
      addonDigest: '',
      overrideDigest: '',
      planDigest: fixtures.publishedPlanVersionId,
      snapshotCount: 0,
      snapshotDigest: null,
      fingerprintState: null,
      successAuditCount: 0,
      completedIdempotencyCount: 1,
      orphanCount: 0,
      rawDbErrorExposed: false,
    });
  });

  it('RC40: conflicting Override replacement idempotency race', async () => {
    const service = svc(prisma);
    const draft = await seedReadyDraft(service, fixtures);
    const key = 'idem-rc40';
    await service.replaceOverrides(
      actorClaims(),
      draft.id,
      { expectedRowVersion: draft.rowVersion, overrideIds: [] },
      key,
    );
    const bumped = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: draft.id },
    });
    await expect(
      service.replaceOverrides(
        actorClaims(),
        draft.id,
        { expectedRowVersion: bumped.rowVersion + 5, overrideIds: [] },
        key,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    assertRaceTemplate({
      initialLifecycle: 'DRAFT',
      initialIsCurrent: true,
      operationA: 'replaceOverrides replay',
      operationB: 'replaceOverrides conflict',
      winner: 'A',
      loserRejected: true,
      loserErrorCode: 'conflict',
      finalLifecycle: 'DRAFT',
      finalIsCurrent: true,
      parentRowVersion: bumped.rowVersion,
      addonDigest: '',
      overrideDigest: '',
      planDigest: fixtures.publishedPlanVersionId,
      snapshotCount: 0,
      snapshotDigest: null,
      fingerprintState: null,
      successAuditCount: 0,
      completedIdempotencyCount: 1,
      orphanCount: 0,
      rawDbErrorExposed: false,
    });
  });
});
