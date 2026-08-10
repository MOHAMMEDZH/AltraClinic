/**
 * Step 16 persisted PostgreSQL redaction — dirty-inject RD01–RD13.
 */
import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { createPlansSeedService } from '../../platform-plans/tests/platform-plans-db.harness';
import { PLATFORM_AUDIT_SENTINEL_TENANT_ID } from '../../platform-tenants/platform-tenants.tokens';
import { AuditTrailPlatformSubscriptionsAuditLog } from '../infrastructure/audit-trail-platform-subscriptions-audit-log';
import type {
  PlatformSubscriptionsAuditLog,
  PlatformSubscriptionsAuditRecord,
} from '../application/ports/subscription-audit-log.port';
import {
  assertSubscriptionAuditSerializedClean,
} from '../application/subscription-audit-redaction';
import {
  ALL_SUBSCRIPTION_PERMS,
  cleanupFixtureRuntimeSubscriptions,
  cleanupPlatformSubscriptionCommercialTables,
  createPlatformDbSecurityClient,
  createSubscriptionsPrismaWrapper,
  createSubscriptionsService,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
} from './platform-subscriptions-db.harness';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

const PROHIBITED_KEYS = [
  'accessToken',
  'refreshToken',
  'stepUpToken',
  'sessionId',
  'mfa',
  'idempotencyKey',
  'requestBody',
  'rawAssignment',
  'rawAddOnIds',
  'rawOverrideIds',
  'rawDatesPayload',
  'readiness',
  'preview',
  'description',
  'reasonNote',
  'billing',
  'payment',
  'clinical',
  'usage',
  'licensing',
  'cacheKey',
  'stack',
  'sql',
  'prisma',
  'actorEmail',
  'runtimeSubscription',
  'auditSentinel',
];

function actorClaims(): JwtClaimsVO {
  return {
    sub: randomUUID(),
    sessionId: randomUUID(),
    principalType: 'platform',
  } as JwtClaimsVO;
}

function dirtySentinels(shape: string): Record<string, unknown> {
  const tag = `SENTINEL_${shape}_${randomUUID().slice(0, 8)}`;
  return {
    accessToken: `eyJhbGciOiJIUzI1NiJ9.${tag}.sig`,
    refreshToken: `refresh-${tag}`,
    stepUpToken: `stepup-${tag}`,
    sessionId: randomUUID(),
    mfa: '654321',
    idempotencyKey: `idem-${tag}`,
    requestBody: { raw: true, tag },
    rawAssignment: { addOnVersionIds: [tag], overrideIds: [tag] },
    rawAddOnIds: [tag],
    rawOverrideIds: [tag],
    rawDatesPayload: { commercialStart: tag },
    readiness: { blockers: [{ code: tag }] },
    preview: { modules: [tag] },
    description: `free-form ${tag}`,
    reasonNote: `secret ${tag}`,
    billing: { invoice: tag },
    payment: { card: '4111' },
    clinical: { phi: tag },
    usage: { meter: tag },
    licensing: { canUse: true },
    cacheKey: `cache:${tag}`,
    stack: `Error: ${tag}`,
    sql: `SELECT * FROM ${tag}`,
    prisma: 'P2002',
    actorEmail: `${tag}@example.com`,
    runtimeSubscription: { id: tag },
    auditSentinel: PLATFORM_AUDIT_SENTINEL_TENANT_ID,
    shapeTag: tag,
  };
}

class DirtyWrapAuditLog implements PlatformSubscriptionsAuditLog {
  constructor(
    private readonly inner: AuditTrailPlatformSubscriptionsAuditLog,
    private readonly sentinels: Record<string, unknown>,
  ) {}

  async record(entry: PlatformSubscriptionsAuditRecord): Promise<void> {
    await this.inner.record({
      ...entry,
      details: {
        ...(entry.details ?? {}),
        ...this.sentinels,
      },
    });
  }

  async recordInTransaction(
    client: Parameters<AuditTrailPlatformSubscriptionsAuditLog['recordInTransaction']>[0],
    entry: PlatformSubscriptionsAuditRecord,
  ): Promise<void> {
    await this.inner.recordInTransaction(client, {
      ...entry,
      details: {
        ...(entry.details ?? {}),
        ...this.sentinels,
      },
    });
  }
}

async function ensureFixtures(prisma: PrismaClient) {
  const { ensurePlatformSubscriptionFixtures } = await import('./platform-subscriptions-db.harness');
  const fixtures = await ensurePlatformSubscriptionFixtures(prisma);
  return {
    platformTenantId: fixtures.platformTenantId,
    publishedPlanVersionId: fixtures.publishedPlanVersionId,
  };
}

async function assertPersistedRedaction(
  prisma: PrismaClient,
  action: string,
  resourceId: string,
  sentinels: Record<string, unknown>,
) {
  const rows = await prisma.auditEntry.findMany({
    where: { action, resourceId },
    orderBy: { createdAt: 'desc' },
  });
  expect(rows.length).toBeGreaterThanOrEqual(1);
  const row = rows[0]!;
  const serialized = JSON.stringify(row.details ?? {});
  for (const key of PROHIBITED_KEYS) {
    expect(serialized).not.toContain(key);
  }
  const tag = String(sentinels.shapeTag ?? '');
  if (tag) {
    expect(serialized).not.toContain(tag);
    expect(serialized).not.toContain('SENTINEL_');
  }
  expect(serialized).not.toContain('eyJ');
  assertSubscriptionAuditSerializedClean(serialized);
  expect((row.details as Record<string, string>).result).toBe('success');
  expect((row.details as Record<string, string>).runtimeEffective).toBe('false');
}

describeDb('Step 16 persisted PostgreSQL redaction RD01–RD13', () => {
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

  function dirtyService(shape: string) {
    const wrapper = createSubscriptionsPrismaWrapper(prisma);
    const inner = new AuditTrailPlatformSubscriptionsAuditLog({
      withPlatformBypass: wrapper.withPlatformBypass,
    } as unknown as PrismaService);
    const sentinels = dirtySentinels(shape);
    const audit = new DirtyWrapAuditLog(inner, sentinels);
    const service = createSubscriptionsService({
      prisma,
      permissions: ALL_SUBSCRIPTION_PERMS,
      audit,
      stepUpFresh: true,
    });
    return { service, sentinels };
  }

  async function seedDraftWithPlan(service: ReturnType<typeof createSubscriptionsService>) {
    const actor = actorClaims();
    const c = await service.create(actor, { platformTenantId: fixtures.platformTenantId });
    return service.assignPlanVersion(actor, c.id, {
      expectedRowVersion: c.rowVersion,
      planVersionId: fixtures.publishedPlanVersionId,
    });
  }

  it('RD01: create and correlation redacts dirty inject', async () => {
    const { service, sentinels } = dirtyService('create');
    const actor = actorClaims();
    const created = await service.create(
      actor,
      { platformTenantId: fixtures.platformTenantId, reasonCode: 'RD01' },
      `idem-rd01-${randomUUID().slice(0, 6)}`,
    );
    await assertPersistedRedaction(
      prisma,
      'platform_subscription_commercial.created',
      created.id,
      sentinels,
    );
  });

  it('RD02: general update redacts dirty inject', async () => {
    const { service, sentinels } = dirtyService('update');
    const actor = actorClaims();
    const created = await service.create(actor, { platformTenantId: fixtures.platformTenantId });
    const updated = await service.update(
      actor,
      created.id,
      { expectedRowVersion: created.rowVersion, reasonCode: 'RD02' },
      `idem-rd02-${randomUUID().slice(0, 6)}`,
    );
    await assertPersistedRedaction(
      prisma,
      'platform_subscription_commercial.updated',
      updated.id,
      sentinels,
    );
  });

  it('RD03: Plan assignment redacts dirty inject', async () => {
    const { service, sentinels } = dirtyService('plan');
    const actor = actorClaims();
    const created = await service.create(actor, { platformTenantId: fixtures.platformTenantId });
    await service.assignPlanVersion(
      actor,
      created.id,
      {
        expectedRowVersion: created.rowVersion,
        planVersionId: fixtures.publishedPlanVersionId,
      },
      `idem-rd03-${randomUUID().slice(0, 6)}`,
    );
    await assertPersistedRedaction(
      prisma,
      'platform_subscription_commercial.plan_version_assigned',
      created.id,
      sentinels,
    );
  });

  it('RD04: Add-on replacement redacts dirty inject', async () => {
    const { service, sentinels } = dirtyService('addons');
    const actor = actorClaims();
    const draft = await seedDraftWithPlan(service);
    await service.replaceAddOns(
      actor,
      draft.id,
      { expectedRowVersion: draft.rowVersion, addOnVersionIds: [] },
      `idem-rd04-${randomUUID().slice(0, 6)}`,
    );
    await assertPersistedRedaction(
      prisma,
      'platform_subscription_commercial.addons_replaced',
      draft.id,
      sentinels,
    );
  });

  it('RD05: Override replacement redacts dirty inject', async () => {
    const { service, sentinels } = dirtyService('overrides');
    const actor = actorClaims();
    const draft = await seedDraftWithPlan(service);
    await service.replaceOverrides(
      actor,
      draft.id,
      { expectedRowVersion: draft.rowVersion, overrideIds: [] },
      `idem-rd05-${randomUUID().slice(0, 6)}`,
    );
    await assertPersistedRedaction(
      prisma,
      'platform_subscription_commercial.overrides_replaced',
      draft.id,
      sentinels,
    );
  });

  it('RD06: dates update redacts dirty inject', async () => {
    const { service, sentinels } = dirtyService('dates');
    const actor = actorClaims();
    const draft = await seedDraftWithPlan(service);
    await service.updateDates(
      actor,
      draft.id,
      {
        expectedRowVersion: draft.rowVersion,
        commercialStart: '2026-01-01T00:00:00.000Z',
        commercialEnd: '2027-01-01T00:00:00.000Z',
      },
      `idem-rd06-${randomUUID().slice(0, 6)}`,
    );
    await assertPersistedRedaction(
      prisma,
      'platform_subscription_commercial.dates_updated',
      draft.id,
      sentinels,
    );
  });

  it('RD07: schedule redacts dirty inject', async () => {
    const { service, sentinels } = dirtyService('schedule');
    const actor = actorClaims();
    const draft = await seedDraftWithPlan(service);
    await service.schedule(
      actor,
      draft.id,
      {
        expectedRowVersion: draft.rowVersion,
        scheduledActivationAt: '2030-01-01T00:00:00.000Z',
        reason: 'RD07 schedule',
      },
      `idem-rd07-${randomUUID().slice(0, 6)}`,
    );
    await assertPersistedRedaction(
      prisma,
      'platform_subscription_commercial.scheduled',
      draft.id,
      sentinels,
    );
  });

  it('RD08: activate and fingerprint redacts dirty inject', async () => {
    const { service, sentinels } = dirtyService('activate');
    const actor = actorClaims();
    const draft = await seedDraftWithPlan(service);
    await service.activate(
      actor,
      draft.id,
      { expectedRowVersion: draft.rowVersion, reason: 'RD08 activate' },
      `idem-rd08-${randomUUID().slice(0, 6)}`,
    );
    await assertPersistedRedaction(
      prisma,
      'platform_subscription_commercial.active_commercial',
      draft.id,
      sentinels,
    );
  });

  it('RD09: suspend redacts dirty inject', async () => {
    const { service, sentinels } = dirtyService('suspend');
    const actor = actorClaims();
    const draft = await seedDraftWithPlan(service);
    const active = await service.activate(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      reason: 'RD09 prep',
    });
    await service.suspend(
      actor,
      active.id,
      { expectedRowVersion: active.rowVersion, reason: 'RD09 suspend' },
      `idem-rd09-${randomUUID().slice(0, 6)}`,
    );
    await assertPersistedRedaction(
      prisma,
      'platform_subscription_commercial.suspended',
      active.id,
      sentinels,
    );
  });

  it('RD10: resume redacts dirty inject', async () => {
    const { service, sentinels } = dirtyService('resume');
    const actor = actorClaims();
    const draft = await seedDraftWithPlan(service);
    const active = await service.activate(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      reason: 'RD10 prep',
    });
    const suspended = await service.suspend(actor, active.id, {
      expectedRowVersion: active.rowVersion,
      reason: 'RD10 pause',
    });
    await service.resume(
      actor,
      suspended.id,
      { expectedRowVersion: suspended.rowVersion, reason: 'RD10 resume' },
      `idem-rd10-${randomUUID().slice(0, 6)}`,
    );
    const rows = await prisma.auditEntry.findMany({
      where: {
        action: 'platform_subscription_commercial.active_commercial',
        resourceId: active.id,
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(rows.length).toBeGreaterThanOrEqual(1);
    await assertPersistedRedaction(
      prisma,
      'platform_subscription_commercial.active_commercial',
      active.id,
      sentinels,
    );
    expect((rows[0]!.details as Record<string, string>).transitionCommand).toBe('RESUME');
  });

  it('RD11: cancel redacts dirty inject', async () => {
    const { service, sentinels } = dirtyService('cancel');
    const actor = actorClaims();
    const draft = await seedDraftWithPlan(service);
    const active = await service.activate(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      reason: 'RD11 prep',
    });
    const cancelled = await service.cancel(
      actor,
      active.id,
      { expectedRowVersion: active.rowVersion, reason: 'RD11 cancel' },
      `idem-rd11-${randomUUID().slice(0, 6)}`,
    );
    await assertPersistedRedaction(
      prisma,
      'platform_subscription_commercial.cancelled',
      cancelled.id,
      sentinels,
    );
  });

  it('RD12: supersede and current transfer redacts dirty inject', async () => {
    const { service, sentinels } = dirtyService('supersede');
    const actor = actorClaims();
    const draft = await seedDraftWithPlan(service);
    const active = await service.activate(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      reason: 'RD12 prep',
    });
    const successor = await service.supersede(
      actor,
      active.id,
      { expectedRowVersion: active.rowVersion, reason: 'RD12 supersede' },
      `idem-rd12-${randomUUID().slice(0, 6)}`,
    );
    await assertPersistedRedaction(
      prisma,
      'platform_subscription_commercial.superseded',
      successor.id,
      sentinels,
    );
  });

  it('RD13: renew, current transfer, and renewal provenance redacts dirty inject', async () => {
    const { service, sentinels } = dirtyService('renew');
    const actor = actorClaims();
    const draft = await seedDraftWithPlan(service);
    const active = await service.activate(actor, draft.id, {
      expectedRowVersion: draft.rowVersion,
      reason: 'RD13 prep',
    });
    const renewed = await service.renew(
      actor,
      active.id,
      {
        expectedRowVersion: active.rowVersion,
        reason: 'RD13 renew',
        renewalEffectiveAt: '2035-01-01T00:00:00.000Z',
      },
      `idem-rd13-${randomUUID().slice(0, 6)}`,
    );
    await assertPersistedRedaction(
      prisma,
      'platform_subscription_commercial.renewed',
      renewed.id,
      sentinels,
    );
  });
});
