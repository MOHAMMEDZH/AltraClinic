/**
 * Flexible Step 24 — WON/LOST safety: never auto-create Tenant/Trial/Subscription/Entitlement.
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { createSalesLeadsStack } from './sales-leads-stack';
import {
  assertSafePlatformTestDatabaseUrl,
  cleanupSalesLeadTables,
  clearSalesLeadsFailureInjection,
  commercialSoRSnapshot,
  countLeadAudits,
  createPlatformDbSecurityClient,
  createPlatformRefreshSession,
  createPlatformUserFixture,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformClaims,
  platformDbSecurityEnabled,
  SALES_MANAGER_ROLE,
} from './sales-leads-db.harness';
import { SALES_LEAD_AUDIT_ACTIONS } from '../platform-sales-leads.constants';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 24 Sales Leads won/lost safety (PostgreSQL)', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
    prisma = createPlatformDbSecurityClient();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    clearSalesLeadsFailureInjection();
    process.env.NODE_ENV = 'test';
    await cleanupSalesLeadTables(prisma);
    await prisma.platformRefreshToken.deleteMany({});
    await prisma.platformUserRole.deleteMany({});
    await prisma.platformUser.deleteMany({});
  });

  async function advanceToProposal() {
    const user = await createPlatformUserFixture(prisma, {
      email: `lead-won-${randomUUID()}@test.local`,
      roleKeys: [SALES_MANAGER_ROLE],
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    const claims = platformClaims(user.id, session.sessionId);
    const stack = createSalesLeadsStack(prisma);
    let lead = await stack.leads.create(
      claims,
      stack.perms,
      { organizationName: 'Won Org', contactName: 'Winner' },
      randomUUID(),
    );
    lead = await stack.leads.changeStage(claims, stack.perms, lead.id, {
      stage: 'PROPOSAL',
      expectedRowVersion: lead.rowVersion,
    });
    return { claims, stack, lead };
  }

  it('WON01: markWon audits once and leaves commercial SoR unchanged', async () => {
    const before = await commercialSoRSnapshot(prisma);
    const { claims, stack, lead } = await advanceToProposal();
    const won = await stack.leads.markWon(claims, stack.perms, lead.id, {
      expectedRowVersion: lead.rowVersion,
      wonLostReason: 'Contract signed',
    });
    expect(won.stage).toBe('WON');
    expect(await countLeadAudits(prisma, SALES_LEAD_AUDIT_ACTIONS.WON)).toBe(1);
    expect(await commercialSoRSnapshot(prisma)).toEqual(before);
  });

  it('WON02: markWon does not create platform tenants', async () => {
    const before = await prisma.platformTenant.count();
    const { claims, stack, lead } = await advanceToProposal();
    await stack.leads.markWon(claims, stack.perms, lead.id, {
      expectedRowVersion: lead.rowVersion,
      wonLostReason: 'ok',
    });
    expect(await prisma.platformTenant.count()).toBe(before);
  });

  it('WON03: markWon does not create subscriptions', async () => {
    const before = await prisma.platformSubscription.count();
    const { claims, stack, lead } = await advanceToProposal();
    await stack.leads.markWon(claims, stack.perms, lead.id, {
      expectedRowVersion: lead.rowVersion,
      wonLostReason: 'ok',
    });
    expect(await prisma.platformSubscription.count()).toBe(before);
  });

  it('WON04: markWon does not create provisioning requests', async () => {
    const before = await prisma.platformTenantProvisioningRequest.count();
    const { claims, stack, lead } = await advanceToProposal();
    await stack.leads.markWon(claims, stack.perms, lead.id, {
      expectedRowVersion: lead.rowVersion,
      wonLostReason: 'ok',
    });
    expect(await prisma.platformTenantProvisioningRequest.count()).toBe(before);
  });

  it('WON05: markWon does not invent trials table rows (table absent)', async () => {
    const { claims, stack, lead } = await advanceToProposal();
    await stack.leads.markWon(claims, stack.perms, lead.id, {
      expectedRowVersion: lead.rowVersion,
      wonLostReason: 'ok',
    });
    const trials = await prisma.$queryRawUnsafe<Array<{ present: boolean }>>(
      `SELECT to_regclass('public.platform_sales_trials') IS NOT NULL AS present`,
    );
    expect(trials[0]?.present).toBe(false);
  });

  it('WON06: exact idempotent replay of won does not double-audit', async () => {
    const { claims, stack, lead } = await advanceToProposal();
    const key = randomUUID();
    await stack.leads.markWon(
      claims,
      stack.perms,
      lead.id,
      { expectedRowVersion: lead.rowVersion, wonLostReason: 'ok' },
      key,
    );
    const afterFirst = await countLeadAudits(prisma, SALES_LEAD_AUDIT_ACTIONS.WON);
    await stack.leads.markWon(
      claims,
      stack.perms,
      lead.id,
      { expectedRowVersion: lead.rowVersion, wonLostReason: 'ok' },
      key,
    );
    expect(await countLeadAudits(prisma, SALES_LEAD_AUDIT_ACTIONS.WON)).toBe(afterFirst);
  });

  it('LOST01: markLost audits and preserves SoR', async () => {
    const before = await commercialSoRSnapshot(prisma);
    const user = await createPlatformUserFixture(prisma, {
      email: `lead-lost-${randomUUID()}@test.local`,
      roleKeys: [SALES_MANAGER_ROLE],
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    const claims = platformClaims(user.id, session.sessionId);
    const stack = createSalesLeadsStack(prisma);
    const lead = await stack.leads.create(
      claims,
      stack.perms,
      { organizationName: 'Lost Org', contactName: 'L' },
      randomUUID(),
    );
    await stack.leads.markLost(claims, stack.perms, lead.id, {
      expectedRowVersion: lead.rowVersion,
      wonLostReason: 'No budget',
    });
    expect(await countLeadAudits(prisma, SALES_LEAD_AUDIT_ACTIONS.LOST)).toBe(1);
    expect(await commercialSoRSnapshot(prisma)).toEqual(before);
  });

  it('LOST02: lost lead has history entry', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `lead-lost2-${randomUUID()}@test.local`,
      roleKeys: [SALES_MANAGER_ROLE],
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    const claims = platformClaims(user.id, session.sessionId);
    const stack = createSalesLeadsStack(prisma);
    const lead = await stack.leads.create(
      claims,
      stack.perms,
      { organizationName: 'Lost2', contactName: 'L2' },
      randomUUID(),
    );
    await stack.leads.markLost(claims, stack.perms, lead.id, {
      expectedRowVersion: lead.rowVersion,
      wonLostReason: 'timing',
    });
    const history = await stack.leads.listStageHistory(claims, stack.perms, lead.id);
    expect(history.some((h) => h.toStage === 'LOST')).toBe(true);
  });
});
