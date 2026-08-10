/**
 * Flexible Step 21 — A08-D11.1–D11.10 deterministic Add-on replace concurrency.
 * Exact duplicate concurrent ops must yield durable success audit delta = 1.
 */
import { randomUUID } from 'crypto';
import { ConflictException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { PrismaService } from '../../../infrastructure/prisma.service';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import {
  createPlatformDbSecurityClient,
  createPlatformUserFixture,
  enableAuditCenter,
  ensureSentinel,
  platformClaims,
  platformDbSecurityEnabled,
} from './audit-center-db.harness';
import { createPlatformRefreshSession } from '../../auth/tests/platform-db-security.harness';
import { createPlansSeedService } from '../../platform-plans/tests/platform-plans-db.harness';
import { createSeedService } from '../../platform-healthcare-catalog/tests/platform-healthcare-catalog-db.harness';
import {
  ALL_SUBSCRIPTION_PERMS,
  cleanupFixtureRuntimeSubscriptions,
  cleanupPlatformSubscriptionCommercialTables,
  createSubscriptionsPrismaWrapper,
  createSubscriptionsService,
  ensurePlatformSubscriptionFixtures,
} from '../../platform-subscriptions/tests/platform-subscriptions-db.harness';
import { AuditTrailPlatformSubscriptionsAuditLog } from '../../platform-subscriptions/infrastructure/audit-trail-platform-subscriptions-audit-log';
import type { SubscriptionTxFailurePoint } from '../../platform-subscriptions/platform-subscriptions.tokens';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

const ACTION = 'platform_subscription_commercial.addons_replaced';
const OP = 'subscription.replaceAddOns';

function report(row: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.log(`A08_D11 ${JSON.stringify(row)}`);
}

async function countAudits(prisma: PrismaClient, resourceId: string) {
  return prisma.auditEntry.count({ where: { action: ACTION, resourceId } });
}

async function completedIdemCount(
  prisma: PrismaClient,
  actorId: string,
  key: string,
): Promise<number> {
  return prisma.platformSubscriptionCommercialIdempotencyRecord.count({
    where: {
      actorId,
      operation: OP,
      idempotencyKey: key,
      status: 'completed',
    },
  });
}

async function assignmentCount(prisma: PrismaClient, configId: string) {
  return prisma.platformSubscriptionAddOnAssignment.count({ where: { configId } });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

describeDb('Step 21 A08-D11 replaceAddOns concurrency cardinality (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let restoreAudit: () => void;

  beforeAll(async () => {
    prisma = createPlatformDbSecurityClient();
    restoreAudit = enableAuditCenter();
    await ensureSentinel(prisma);
    await createSeedService(prisma).seedAll();
    await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
  });

  afterAll(async () => {
    restoreAudit();
    await prisma.$disconnect();
  });

  async function actorClaims(tag: string): Promise<JwtClaimsVO> {
    const actor = await createPlatformUserFixture(prisma, {
      email: `a08d11-${tag}-${randomUUID()}@test.local`,
      roleKeys: ['platform_owner'],
    });
    const session = await createPlatformRefreshSession(prisma, actor.id, {
      stepUpVerifiedAt: new Date(),
    });
    return platformClaims(actor.id, session.sessionId);
  }

  function durableSvc(failureHook?: (p: SubscriptionTxFailurePoint) => void | Promise<void>) {
    const wrapper = createSubscriptionsPrismaWrapper(prisma);
    const audit = new AuditTrailPlatformSubscriptionsAuditLog(
      Object.assign(prisma, wrapper) as unknown as PrismaService,
    );
    return createSubscriptionsService({
      prisma,
      permissions: ALL_SUBSCRIPTION_PERMS,
      audit,
      stepUpFresh: true,
      failureHook,
    });
  }

  async function seedReadyDraft(claims: JwtClaimsVO, platformTenantId: string, planVersionId: string) {
    const svc = durableSvc();
    const created = await svc.create(
      claims,
      { platformTenantId },
      `a08d11-c-${randomUUID()}`,
    );
    return svc.assignPlanVersion(
      claims,
      created.id,
      { expectedRowVersion: created.rowVersion, planVersionId },
      `a08d11-p-${randomUUID()}`,
    );
  }

  async function extraPlatformTenant(): Promise<string> {
    const tenant = await prisma.tenant.create({
      data: {
        name: `A08D11 ${randomUUID().slice(0, 8)}`,
        slug: `a08d11-${randomUUID().slice(0, 8)}`,
        features: {},
      },
    });
    const pt = await prisma.platformTenant.create({
      data: {
        tenantId: tenant.id,
        displayName: 'A08D11 Extra',
        region: 'ME_SOUTH',
        plan: 'PRO',
        status: 'ACTIVE',
        provisionedBy: randomUUID(),
      },
    });
    return pt.id;
  }

  it('A08-D11.1 same key + same payload + simultaneous start → audit delta 1', async () => {
    const fixtures = await ensurePlatformSubscriptionFixtures(prisma);
    await cleanupPlatformSubscriptionCommercialTables(prisma);
    await cleanupFixtureRuntimeSubscriptions(prisma, fixtures.platformTenantId);
    const claims = await actorClaims('d111');
    const draft = await seedReadyDraft(
      claims,
      fixtures.platformTenantId,
      fixtures.publishedPlanVersionId,
    );
    const key = `a08-d11-1-${randomUUID()}`;
    const body = { expectedRowVersion: draft.rowVersion, addOnVersionIds: [] as string[] };
    const before = await countAudits(prisma, draft.id);
    const a = durableSvc();
    const b = durableSvc();
    const settled = await Promise.allSettled([
      a.replaceAddOns(claims, draft.id, body, key),
      b.replaceAddOns(claims, draft.id, body, key),
    ]);
    const ok = settled.filter((s) => s.status === 'fulfilled');
    expect(ok.length).toBe(2);
    expect(await completedIdemCount(prisma, claims.sub, key)).toBe(1);
    expect(await countAudits(prisma, draft.id)).toBe(before + 1);
    expect(await assignmentCount(prisma, draft.id)).toBe(0);
    const reloaded = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(reloaded.rowVersion).toBe(draft.rowVersion + 1);
    report({
      id: 'A08-D11.1',
      businessEffect: 1,
      completedIdem: 1,
      auditDelta: 1,
      duplicates: 0,
      orphans: 0,
      result: 'PASS',
    });
  }, 180_000);

  it('A08-D11.2 same key + delayed second while first in progress → audit delta 1', async () => {
    const fixtures = await ensurePlatformSubscriptionFixtures(prisma);
    await cleanupPlatformSubscriptionCommercialTables(prisma);
    await cleanupFixtureRuntimeSubscriptions(prisma, fixtures.platformTenantId);
    const claims = await actorClaims('d112');
    const draft = await seedReadyDraft(
      claims,
      fixtures.platformTenantId,
      fixtures.publishedPlanVersionId,
    );
    const key = `a08-d11-2-${randomUUID()}`;
    const body = { expectedRowVersion: draft.rowVersion, addOnVersionIds: [] as string[] };
    let release!: () => void;
    const hold = new Promise<void>((r) => {
      release = r;
    });
    let entered = false;
    const a = durableSvc(async (point) => {
      if (point === 'after_addon_delete') {
        entered = true;
        await hold;
      }
    });
    const b = durableSvc();
    const before = await countAudits(prisma, draft.id);
    const firstP = a.replaceAddOns(claims, draft.id, body, key);
    for (let i = 0; i < 400 && !entered; i++) await sleep(25);
    expect(entered).toBe(true);
    // Start waiter while winner still holds the open transaction claim.
    const secondP = b.replaceAddOns(claims, draft.id, body, key);
    await sleep(50);
    release();
    const settled = await Promise.allSettled([firstP, secondP]);
    const rejected = settled.filter((s) => s.status === 'rejected') as PromiseRejectedResult[];
    if (rejected.length) {
      // eslint-disable-next-line no-console
      console.error(
        'A08-D11.2 rejections',
        rejected.map((r) => String(r.reason?.message ?? r.reason)),
      );
    }
    expect(settled.filter((s) => s.status === 'fulfilled').length).toBe(2);
    expect(await completedIdemCount(prisma, claims.sub, key)).toBe(1);
    expect(await countAudits(prisma, draft.id)).toBe(before + 1);
    report({
      id: 'A08-D11.2',
      winnerWaiter: true,
      businessEffect: 1,
      completedIdem: 1,
      auditDelta: 1,
      result: 'PASS',
    });
  }, 180_000);

  it('A08-D11.3 same key after first commit → exact replay, audit delta 0', async () => {
    const fixtures = await ensurePlatformSubscriptionFixtures(prisma);
    await cleanupPlatformSubscriptionCommercialTables(prisma);
    await cleanupFixtureRuntimeSubscriptions(prisma, fixtures.platformTenantId);
    const claims = await actorClaims('d113');
    const draft = await seedReadyDraft(
      claims,
      fixtures.platformTenantId,
      fixtures.publishedPlanVersionId,
    );
    const key = `a08-d11-3-${randomUUID()}`;
    const body = { expectedRowVersion: draft.rowVersion, addOnVersionIds: [] as string[] };
    const svc = durableSvc();
    const first = await svc.replaceAddOns(claims, draft.id, body, key);
    const afterFirst = await countAudits(prisma, draft.id);
    const replay = await svc.replaceAddOns(claims, draft.id, body, key);
    expect(replay.id).toBe(first.id);
    expect(replay.rowVersion).toBe(first.rowVersion);
    expect(await completedIdemCount(prisma, claims.sub, key)).toBe(1);
    expect(await countAudits(prisma, draft.id)).toBe(afterFirst);
    report({
      id: 'A08-D11.3',
      businessEffect: 1,
      completedIdem: 1,
      auditDeltaReplay: 0,
      result: 'PASS',
    });
  }, 180_000);

  it('A08-D11.4 same key with conflicting payload → no second business/audit success', async () => {
    const fixtures = await ensurePlatformSubscriptionFixtures(prisma);
    await cleanupPlatformSubscriptionCommercialTables(prisma);
    await cleanupFixtureRuntimeSubscriptions(prisma, fixtures.platformTenantId);
    const claims = await actorClaims('d114');
    const draft = await seedReadyDraft(
      claims,
      fixtures.platformTenantId,
      fixtures.publishedPlanVersionId,
    );
    const key = `a08-d11-4-${randomUUID()}`;
    const svc = durableSvc();
    await svc.replaceAddOns(
      claims,
      draft.id,
      { expectedRowVersion: draft.rowVersion, addOnVersionIds: [] },
      key,
    );
    const afterFirst = await countAudits(prisma, draft.id);
    const addon = await prisma.platformAddOnVersion.findFirst({
      where: { lifecycle: 'PUBLISHED' },
    });
    await expect(
      svc.replaceAddOns(
        claims,
        draft.id,
        {
          expectedRowVersion: draft.rowVersion,
          addOnVersionIds: addon ? [addon.id] : ['00000000-0000-4000-8000-000000009999'],
        },
        key,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(await completedIdemCount(prisma, claims.sub, key)).toBe(1);
    expect(await countAudits(prisma, draft.id)).toBe(afterFirst);
    report({
      id: 'A08-D11.4',
      conflict: true,
      auditDelta: 0,
      completedIdem: 1,
      result: 'PASS',
    });
  }, 180_000);

  it('A08-D11.5 different keys, same semantic target → one business winner, no duplicate SoR', async () => {
    const fixtures = await ensurePlatformSubscriptionFixtures(prisma);
    await cleanupPlatformSubscriptionCommercialTables(prisma);
    await cleanupFixtureRuntimeSubscriptions(prisma, fixtures.platformTenantId);
    const claims = await actorClaims('d115');
    const draft = await seedReadyDraft(
      claims,
      fixtures.platformTenantId,
      fixtures.publishedPlanVersionId,
    );
    const body = { expectedRowVersion: draft.rowVersion, addOnVersionIds: [] as string[] };
    const keyA = `a08-d11-5a-${randomUUID()}`;
    const keyB = `a08-d11-5b-${randomUUID()}`;
    const before = await countAudits(prisma, draft.id);
    const a = durableSvc();
    const b = durableSvc();
    const settled = await Promise.allSettled([
      a.replaceAddOns(claims, draft.id, body, keyA),
      b.replaceAddOns(claims, draft.id, body, keyB),
    ]);
    const fulfilled = settled.filter((s) => s.status === 'fulfilled').length;
    const rejected = settled.filter((s) => s.status === 'rejected').length;
    expect(fulfilled).toBe(1);
    expect(rejected).toBe(1);
    expect(await completedIdemCount(prisma, claims.sub, keyA) + await completedIdemCount(prisma, claims.sub, keyB)).toBe(1);
    expect(await countAudits(prisma, draft.id)).toBe(before + 1);
    const reloaded = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(reloaded.rowVersion).toBe(draft.rowVersion + 1);
    report({
      id: 'A08-D11.5',
      independentKeys: true,
      businessEffect: 1,
      auditDelta: 1,
      result: 'PASS',
    });
  }, 180_000);

  it('A08-D11.6 same operation after service recreation → replay safe, audit delta 0', async () => {
    const fixtures = await ensurePlatformSubscriptionFixtures(prisma);
    await cleanupPlatformSubscriptionCommercialTables(prisma);
    await cleanupFixtureRuntimeSubscriptions(prisma, fixtures.platformTenantId);
    const claims = await actorClaims('d116');
    const draft = await seedReadyDraft(
      claims,
      fixtures.platformTenantId,
      fixtures.publishedPlanVersionId,
    );
    const key = `a08-d11-6-${randomUUID()}`;
    const body = { expectedRowVersion: draft.rowVersion, addOnVersionIds: [] as string[] };
    const first = await durableSvc().replaceAddOns(claims, draft.id, body, key);
    const afterFirst = await countAudits(prisma, draft.id);
    const replay = await durableSvc().replaceAddOns(claims, draft.id, body, key);
    expect(replay.id).toBe(first.id);
    expect(replay.rowVersion).toBe(first.rowVersion);
    expect(await completedIdemCount(prisma, claims.sub, key)).toBe(1);
    expect(await countAudits(prisma, draft.id)).toBe(afterFirst);
    report({ id: 'A08-D11.6', serviceRecreate: true, auditDeltaReplay: 0, result: 'PASS' });
  }, 180_000);

  it('A08-D11.7 first fails before commit, second retries → audit delta 1', async () => {
    const fixtures = await ensurePlatformSubscriptionFixtures(prisma);
    await cleanupPlatformSubscriptionCommercialTables(prisma);
    await cleanupFixtureRuntimeSubscriptions(prisma, fixtures.platformTenantId);
    const claims = await actorClaims('d117');
    const draft = await seedReadyDraft(
      claims,
      fixtures.platformTenantId,
      fixtures.publishedPlanVersionId,
    );
    const key = `a08-d11-7-${randomUUID()}`;
    const body = { expectedRowVersion: draft.rowVersion, addOnVersionIds: [] as string[] };
    const before = await countAudits(prisma, draft.id);
    const failing = durableSvc(async (point) => {
      if (point === 'before_transaction_commit') {
        throw new Error('injected_before_commit');
      }
    });
    await expect(failing.replaceAddOns(claims, draft.id, body, key)).rejects.toThrow(
      /injected_before_commit/,
    );
    expect(await completedIdemCount(prisma, claims.sub, key)).toBe(0);
    expect(await countAudits(prisma, draft.id)).toBe(before);
    await durableSvc().replaceAddOns(claims, draft.id, body, key);
    expect(await completedIdemCount(prisma, claims.sub, key)).toBe(1);
    expect(await countAudits(prisma, draft.id)).toBe(before + 1);
    report({
      id: 'A08-D11.7',
      firstFailed: true,
      retryAuditDelta: 1,
      completedIdem: 1,
      result: 'PASS',
    });
  }, 180_000);

  it('A08-D11.8 first fails after audit staging before commit → rollback then retry audit 1', async () => {
    const fixtures = await ensurePlatformSubscriptionFixtures(prisma);
    await cleanupPlatformSubscriptionCommercialTables(prisma);
    await cleanupFixtureRuntimeSubscriptions(prisma, fixtures.platformTenantId);
    const claims = await actorClaims('d118');
    const draft = await seedReadyDraft(
      claims,
      fixtures.platformTenantId,
      fixtures.publishedPlanVersionId,
    );
    const key = `a08-d11-8-${randomUUID()}`;
    const body = { expectedRowVersion: draft.rowVersion, addOnVersionIds: [] as string[] };
    const before = await countAudits(prisma, draft.id);
    const failing = durableSvc(async (point) => {
      if (point === 'after_addon_success_audit') {
        throw new Error('injected_after_audit_before_commit');
      }
    });
    await expect(failing.replaceAddOns(claims, draft.id, body, key)).rejects.toThrow(
      /injected_after_audit_before_commit/,
    );
    expect(await completedIdemCount(prisma, claims.sub, key)).toBe(0);
    expect(await countAudits(prisma, draft.id)).toBe(before);
    const reloaded = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(reloaded.rowVersion).toBe(draft.rowVersion);
    await durableSvc().replaceAddOns(claims, draft.id, body, key);
    expect(await completedIdemCount(prisma, claims.sub, key)).toBe(1);
    expect(await countAudits(prisma, draft.id)).toBe(before + 1);
    report({
      id: 'A08-D11.8',
      modelARollback: true,
      retryAuditDelta: 1,
      result: 'PASS',
    });
  }, 180_000);

  it('A08-D11.9 two tenants mutate Add-ons concurrently → each audit 1', async () => {
    const fixtures = await ensurePlatformSubscriptionFixtures(prisma);
    await cleanupPlatformSubscriptionCommercialTables(prisma);
    await cleanupFixtureRuntimeSubscriptions(prisma, fixtures.platformTenantId);
    const tenantB = await extraPlatformTenant();
    const claims = await actorClaims('d119');
    const draftA = await seedReadyDraft(
      claims,
      fixtures.platformTenantId,
      fixtures.publishedPlanVersionId,
    );
    const draftB = await seedReadyDraft(claims, tenantB, fixtures.publishedPlanVersionId);
    const beforeA = await countAudits(prisma, draftA.id);
    const beforeB = await countAudits(prisma, draftB.id);
    const a = durableSvc();
    const b = durableSvc();
    const settled = await Promise.allSettled([
      a.replaceAddOns(
        claims,
        draftA.id,
        { expectedRowVersion: draftA.rowVersion, addOnVersionIds: [] },
        `a08-d11-9a-${randomUUID()}`,
      ),
      b.replaceAddOns(
        claims,
        draftB.id,
        { expectedRowVersion: draftB.rowVersion, addOnVersionIds: [] },
        `a08-d11-9b-${randomUUID()}`,
      ),
    ]);
    expect(settled.every((s) => s.status === 'fulfilled')).toBe(true);
    expect(await countAudits(prisma, draftA.id)).toBe(beforeA + 1);
    expect(await countAudits(prisma, draftB.id)).toBe(beforeB + 1);
    report({ id: 'A08-D11.9', tenantIsolation: true, auditEach: 1, result: 'PASS' });
  }, 180_000);

  it('A08-D11.10 two unrelated subscriptions mutate Add-ons concurrently → each audit 1', async () => {
    const fixtures = await ensurePlatformSubscriptionFixtures(prisma);
    await cleanupPlatformSubscriptionCommercialTables(prisma);
    await cleanupFixtureRuntimeSubscriptions(prisma, fixtures.platformTenantId);
    // One ACTIVE current per tenant — use two tenants so both drafts are current-eligible.
    const tenantB = await extraPlatformTenant();
    const claims = await actorClaims('d1110');
    const draftA = await seedReadyDraft(
      claims,
      fixtures.platformTenantId,
      fixtures.publishedPlanVersionId,
    );
    const draftB = await seedReadyDraft(claims, tenantB, fixtures.publishedPlanVersionId);
    const beforeA = await countAudits(prisma, draftA.id);
    const beforeB = await countAudits(prisma, draftB.id);
    const settled = await Promise.allSettled([
      durableSvc().replaceAddOns(
        claims,
        draftA.id,
        { expectedRowVersion: draftA.rowVersion, addOnVersionIds: [] },
        `a08-d11-10a-${randomUUID()}`,
      ),
      durableSvc().replaceAddOns(
        claims,
        draftB.id,
        { expectedRowVersion: draftB.rowVersion, addOnVersionIds: [] },
        `a08-d11-10b-${randomUUID()}`,
      ),
    ]);
    expect(settled.every((s) => s.status === 'fulfilled')).toBe(true);
    expect(await countAudits(prisma, draftA.id)).toBe(beforeA + 1);
    expect(await countAudits(prisma, draftB.id)).toBe(beforeB + 1);
    report({ id: 'A08-D11.10', subscriptionIsolation: true, auditEach: 1, result: 'PASS' });
  }, 180_000);
});
