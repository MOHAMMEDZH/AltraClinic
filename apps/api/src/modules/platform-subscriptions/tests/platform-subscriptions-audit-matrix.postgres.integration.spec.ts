/**
 * Step 16 persisted audit + serialized redaction matrix (PostgreSQL Source of Record).
 */
import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { createPlansSeedService } from '../../platform-plans/tests/platform-plans-db.harness';
import { PLATFORM_AUDIT_SENTINEL_TENANT_ID } from '../../platform-tenants/platform-tenants.tokens';
import { AuditTrailPlatformSubscriptionsAuditLog } from '../infrastructure/audit-trail-platform-subscriptions-audit-log';
import {
  assertSubscriptionAuditSerializedClean,
  redactSubscriptionAuditDetails,
} from '../application/subscription-audit-redaction';
import {
  ALL_SUBSCRIPTION_PERMS,
  cleanupPlatformSubscriptionCommercialTables,
  cleanupFixtureRuntimeSubscriptions,
  createPlatformDbSecurityClient,
  createSubscriptionsPrismaWrapper,
  createSubscriptionsService,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
} from './platform-subscriptions-db.harness';

const ACTOR = '00000000-0000-4000-8000-000000000016';
const CLAIMS = {
  sub: ACTOR,
  sessionId: '11111111-1111-4111-8111-111111111116',
} as JwtClaimsVO;

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

const PROHIBITED = [
  'reasonNote',
  'Idempotency-Key',
  'Bearer',
  'password',
  'accessToken',
  'refreshToken',
  'sessionId',
  'mfa',
  'requestBody',
  'stack',
  'SELECT ',
  'billing',
  'invoice',
  'payment',
  'licensing',
  'rawAssignment',
];

function actorClaims(): JwtClaimsVO {
  return { ...CLAIMS, sessionId: randomUUID() } as JwtClaimsVO;
}

function durableAudit(prisma: PrismaClient) {
  const wrapper = createSubscriptionsPrismaWrapper(prisma);
  return new AuditTrailPlatformSubscriptionsAuditLog({
    withPlatformBypass: wrapper.withPlatformBypass,
  } as unknown as PrismaService);
}

async function assertCleanAudit(prisma: PrismaClient, action: string, resourceId: string) {
  const rows = await prisma.auditEntry.findMany({ where: { action, resourceId } });
  expect(rows.length).toBe(1);
  const latest = rows[0]!;
  const serialized = JSON.stringify(latest.details ?? {});
  for (const p of PROHIBITED) {
    expect(serialized.toLowerCase()).not.toContain(p.toLowerCase());
  }
  assertSubscriptionAuditSerializedClean(serialized);
  return latest;
}

async function ensureFixtures(prisma: PrismaClient) {
  let dash = await prisma.healthcareCatalogItem.findUnique({
    where: { canonicalKey: 'module.dashboard' },
  });
  if (!dash) {
    const { HealthcareCatalogSeedService } = await import(
      '../../platform-healthcare-catalog/application/catalog-seed.service'
    );
    const catalogSeed = new HealthcareCatalogSeedService({
      withPlatformBypass: async <T>(fn: (client: typeof prisma) => Promise<T>) =>
        prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', true)`;
          return fn(tx as unknown as typeof prisma);
        }),
    } as never);
    await catalogSeed.seedAll();
  }
  if ((await prisma.platformPlan.count()) === 0) {
    await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
  }
  let platformTenant = await prisma.platformTenant.findFirst({
    where: { tenantId: { not: PLATFORM_AUDIT_SENTINEL_TENANT_ID }, status: 'ACTIVE' },
  });
  if (!platformTenant) {
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Audit Matrix Tenant',
        slug: `audit-matrix-${randomUUID().slice(0, 8)}`,
        features: {},
      },
    });
    platformTenant = await prisma.platformTenant.create({
      data: {
        tenantId: tenant.id,
        displayName: 'Audit Matrix Tenant',
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
  if (published.plan.canonicalKey === 'plan.business') {
    throw new Error('Published Plan Version fixture required.');
  }
  return { platformTenantId: platformTenant.id, publishedPlanVersionId: published.id };
}

describeDb('Step 16 subscription audit persistence + serialized redaction matrix', () => {
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

  it('covers create/update/assign/addons/overrides/dates/schedule/activate/suspend/resume/cancel/supersede/renew with clean details', async () => {
    const audit = durableAudit(prisma);
    const service = createSubscriptionsService({
      prisma,
      permissions: ALL_SUBSCRIPTION_PERMS,
      audit,
      stepUpFresh: true,
    });
    const actor = actorClaims();

    const created = await service.create(
      actor,
      { platformTenantId: fixtures.platformTenantId, reasonCode: 'AUDIT_CREATE' },
      'idem-audit-create',
    );
    await assertCleanAudit(prisma, 'platform_subscription_commercial.created', created.id);

    const updated = await service.update(
      actor,
      created.id,
      { expectedRowVersion: created.rowVersion, reasonCode: 'AUDIT_UPD' },
      'idem-audit-update',
    );
    await assertCleanAudit(prisma, 'platform_subscription_commercial.updated', created.id);

    const assigned = await service.assignPlanVersion(
      actor,
      created.id,
      {
        expectedRowVersion: updated.rowVersion,
        planVersionId: fixtures.publishedPlanVersionId,
      },
      'idem-audit-plan',
    );
    await assertCleanAudit(prisma, 'platform_subscription_commercial.plan_version_assigned', created.id);

    const addons = await service.replaceAddOns(
      actor,
      created.id,
      { expectedRowVersion: assigned.rowVersion, addOnVersionIds: [] },
      'idem-audit-addons',
    );
    await assertCleanAudit(prisma, 'platform_subscription_commercial.addons_replaced', created.id);

    const overrides = await service.replaceOverrides(
      actor,
      created.id,
      { expectedRowVersion: addons.rowVersion, overrideIds: [] },
      'idem-audit-overrides',
    );
    await assertCleanAudit(prisma, 'platform_subscription_commercial.overrides_replaced', created.id);

    const dates = await service.updateDates(
      actor,
      created.id,
      {
        expectedRowVersion: overrides.rowVersion,
        commercialStart: '2026-01-01T00:00:00.000Z',
        commercialEnd: '2027-01-01T00:00:00.000Z',
      },
      'idem-audit-dates',
    );
    await assertCleanAudit(prisma, 'platform_subscription_commercial.dates_updated', created.id);

    const scheduled = await service.schedule(
      actor,
      created.id,
      {
        expectedRowVersion: dates.rowVersion,
        scheduledActivationAt: '2030-01-01T00:00:00.000Z',
        reason: 'audit schedule — secret reason note should not persist',
      },
      'idem-audit-schedule',
    );
    await assertCleanAudit(prisma, 'platform_subscription_commercial.scheduled', created.id);

    const activated = await service.activate(
      actor,
      scheduled.id,
      { expectedRowVersion: scheduled.rowVersion, reason: 'audit activate' },
      'idem-audit-activate',
    );
    await assertCleanAudit(prisma, 'platform_subscription_commercial.active_commercial', created.id);

    const suspended = await service.suspend(
      actor,
      activated.id,
      { expectedRowVersion: activated.rowVersion, reason: 'audit suspend' },
      'idem-audit-suspend',
    );
    await assertCleanAudit(prisma, 'platform_subscription_commercial.suspended', activated.id);

    const resumed = await service.resume(
      actor,
      suspended.id,
      { expectedRowVersion: suspended.rowVersion, reason: 'audit resume' },
      'idem-audit-resume',
    );
    const activateAudits = await prisma.auditEntry.findMany({
      where: {
        action: 'platform_subscription_commercial.active_commercial',
        resourceId: created.id,
      },
      orderBy: { createdAt: 'asc' },
    });
    expect(activateAudits.length).toBe(2);
    expect((activateAudits[0]!.details as Record<string, string>).transitionCommand).toBe(
      'ACTIVATE',
    );
    expect((activateAudits[1]!.details as Record<string, string>).transitionCommand).toBe('RESUME');
    expect((activateAudits[1]!.details as Record<string, string>).lifecycleBefore).toBe('SUSPENDED');
    const resumeSerialized = JSON.stringify(activateAudits[1]!.details ?? {});
    for (const p of PROHIBITED) {
      expect(resumeSerialized.toLowerCase()).not.toContain(p.toLowerCase());
    }
    assertSubscriptionAuditSerializedClean(resumeSerialized);
    const cancelled = await service.cancel(
      actor,
      resumed.id,
      { expectedRowVersion: resumed.rowVersion, reason: 'audit cancel' },
      'idem-audit-cancel',
    );
    await assertCleanAudit(prisma, 'platform_subscription_commercial.cancelled', cancelled.id);

    await cleanupPlatformSubscriptionCommercialTables(prisma);
    const active2 = await (async () => {
      const c = await service.create(actor, { platformTenantId: fixtures.platformTenantId });
      const a = await service.assignPlanVersion(actor, c.id, {
        expectedRowVersion: c.rowVersion,
        planVersionId: fixtures.publishedPlanVersionId,
      });
      return service.activate(
        actor,
        a.id,
        { expectedRowVersion: a.rowVersion, reason: 'prep supersede' },
        'idem-audit-act2',
      );
    })();

    const superseded = await service.supersede(
      actor,
      active2.id,
      { expectedRowVersion: active2.rowVersion, reason: 'audit supersede' },
      'idem-audit-supersede',
    );
    await assertCleanAudit(
      prisma,
      'platform_subscription_commercial.superseded',
      superseded.id,
    );

    await cleanupPlatformSubscriptionCommercialTables(prisma);
    const active3 = await (async () => {
      const c = await service.create(actor, { platformTenantId: fixtures.platformTenantId });
      const a = await service.assignPlanVersion(actor, c.id, {
        expectedRowVersion: c.rowVersion,
        planVersionId: fixtures.publishedPlanVersionId,
      });
      return service.activate(
        actor,
        a.id,
        { expectedRowVersion: a.rowVersion, reason: 'prep renew' },
        'idem-audit-act3',
      );
    })();

    const renewed = await service.renew(
      actor,
      active3.id,
      { expectedRowVersion: active3.rowVersion, reason: 'audit renew', renewalEffectiveAt: '2028-01-01T00:00:00.000Z' },
      'idem-audit-renew',
    );
    await assertCleanAudit(prisma, 'platform_subscription_commercial.renewed', renewed.id);
  });

  it('redactSubscriptionAuditDetails strips non-allowlisted fields', () => {
    const redacted = redactSubscriptionAuditDetails({
      result: 'success',
      lifecycleAfter: 'DRAFT',
      reasonNote: 'must not appear',
      requestBody: { secret: true },
      password: 'x',
      runtimeEffective: 'false',
    });
    expect(redacted.result).toBe('success');
    expect(redacted.lifecycleAfter).toBe('DRAFT');
    expect(redacted.reasonNote).toBeUndefined();
    expect(redacted.requestBody).toBeUndefined();
    expect(redacted.password).toBeUndefined();
    expect(redacted.runtimeEffective).toBe('false');
  });
});
