/**
 * Flexible Step 24 — narrow concurrency closure C11–C24.
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { createSalesLeadsStack } from './sales-leads-stack';
import {
  assertSafePlatformTestDatabaseUrl,
  cleanupSalesLeadTables,
  clearSalesLeadsFailureInjection,
  countLeadAudits,
  createPlatformDbSecurityClient,
  createPlatformRefreshSession,
  createPlatformUserFixture,
  createRepProfile,
  commercialSoRSnapshot,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformClaims,
  platformDbSecurityEnabled,
  setSalesLeadsFailureInjection,
  SALES_MANAGER_ROLE,
  SALES_REP_ROLE,
} from './sales-leads-db.harness';
import { SALES_LEAD_AUDIT_ACTIONS, SALES_LEAD_PERMISSIONS } from '../platform-sales-leads.constants';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 24 Sales Leads concurrency C11–C24 (PostgreSQL)', () => {
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

  async function managerActor() {
    const user = await createPlatformUserFixture(prisma, {
      email: `lead-c11-${randomUUID()}@test.local`,
      roleKeys: [SALES_MANAGER_ROLE],
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    const claims = platformClaims(user.id, session.sessionId);
    const stack = createSalesLeadsStack(prisma);
    return { user, claims, stack };
  }

  async function toProposal(
    stack: ReturnType<typeof createSalesLeadsStack>,
    claims: ReturnType<typeof platformClaims>,
    leadId: string,
    rowVersion: number,
  ) {
    return stack.leads.changeStage(claims, stack.perms, leadId, {
      stage: 'PROPOSAL',
      expectedRowVersion: rowVersion,
    });
  }

  it('C11 won vs lost race → exactly one coherent terminal stage', async () => {
    const { claims, stack } = await managerActor();
    let lead = await stack.leads.create(
      claims,
      stack.perms,
      { organizationName: 'C11 Org', contactName: 'C11' },
      randomUUID(),
    );
    lead = await toProposal(stack, claims, lead.id, lead.rowVersion);
    const rv = lead.rowVersion;
    const results = await Promise.allSettled([
      stack.leads.markWon(claims, stack.perms, lead.id, {
        expectedRowVersion: rv,
        wonLostReason: 'signed',
      }),
      stack.leads.markLost(claims, stack.perms, lead.id, {
        expectedRowVersion: rv,
        wonLostReason: 'no budget',
      }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    const fresh = await stack.leads.getById(claims, stack.perms, lead.id);
    expect(['WON', 'LOST']).toContain(fresh.stage);
    const hist = await prisma.platformSalesLeadStageHistory.count({
      where: { leadId: lead.id, toStage: { in: ['WON', 'LOST'] } },
    });
    expect(hist).toBe(1);
  });

  it('C12 requirements update vs Plan-fit read (concurrent) → SoR unchanged, plan-fit succeeds or safely fails without mutation', async () => {
    const { claims, stack } = await managerActor();
    const lead = await stack.leads.create(
      claims,
      stack.perms,
      {
        organizationName: 'C12 Org',
        contactName: 'C12',
        desiredModuleKeys: ['module.scheduling'],
      },
      randomUUID(),
    );
    const before = await commercialSoRSnapshot(prisma);
    const results = await Promise.allSettled([
      stack.leads.update(claims, stack.perms, lead.id, {
        desiredModuleKeys: ['module.scheduling', 'module.billing'],
        specialtyKeys: ['specialty.general'],
        expectedRowVersion: lead.rowVersion,
      }),
      stack.leads.getPlanFit(claims, stack.perms, lead.id),
    ]);
    const after = await commercialSoRSnapshot(prisma);
    expect(after).toEqual(before);
    const fit = results[1];
    if (fit.status === 'fulfilled') {
      expect(fit.value.disclaimer.doesNotMutateCommercialSoR).toBe(true);
    } else {
      expect(fit.reason).toBeTruthy();
    }
    expect(await commercialSoRSnapshot(prisma)).toEqual(before);
  });

  it('C13 desired-module concurrent update → OCC one winner', async () => {
    const { claims, stack } = await managerActor();
    const lead = await stack.leads.create(
      claims,
      stack.perms,
      { organizationName: 'C13 Org', contactName: 'C13' },
      randomUUID(),
    );
    const results = await Promise.allSettled([
      stack.leads.update(claims, stack.perms, lead.id, {
        desiredModuleKeys: ['module.a'],
        expectedRowVersion: lead.rowVersion,
      }),
      stack.leads.update(claims, stack.perms, lead.id, {
        desiredModuleKeys: ['module.b'],
        expectedRowVersion: lead.rowVersion,
      }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    const fresh = await stack.leads.getById(claims, stack.perms, lead.id);
    expect(fresh.desiredModuleKeys).toHaveLength(1);
  });

  it('C14 estimated-size concurrent update → OCC one winner', async () => {
    const { claims, stack } = await managerActor();
    const lead = await stack.leads.create(
      claims,
      stack.perms,
      { organizationName: 'C14 Org', contactName: 'C14' },
      randomUUID(),
    );
    const results = await Promise.allSettled([
      stack.leads.update(claims, stack.perms, lead.id, {
        estimatedUsers: 10,
        estimatedProviders: 2,
        estimatedLocations: 1,
        expectedRowVersion: lead.rowVersion,
      }),
      stack.leads.update(claims, stack.perms, lead.id, {
        estimatedUsers: 99,
        estimatedProviders: 9,
        estimatedLocations: 5,
        expectedRowVersion: lead.rowVersion,
      }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    const fresh = await stack.leads.getById(claims, stack.perms, lead.id);
    expect([10, 99]).toContain(fresh.estimatedUsers);
  });

  it('C15 post-commit response-loss exact replay (use durable idempotency: create with same key after "lost response")', async () => {
    const { claims, stack } = await managerActor();
    const key = randomUUID();
    const body = { organizationName: 'C15 Org', contactName: 'C15' };
    setSalesLeadsFailureInjection('after_commit_before_response');
    await expect(stack.leads.create(claims, stack.perms, body, key)).rejects.toMatchObject({
      code: 'validation_error',
    });
    expect(await prisma.platformSalesLead.count({ where: { organizationName: 'C15 Org' } })).toBe(1);
    clearSalesLeadsFailureInjection();
    const replayed = await stack.leads.create(claims, stack.perms, body, key);
    expect(replayed.organizationName).toBe('C15 Org');
    expect(await prisma.platformSalesLead.count({ where: { organizationName: 'C15 Org' } })).toBe(1);
  });

  it('C16 service recreation replay (createSalesStack twice, same idempotency key)', async () => {
    const { claims } = await managerActor();
    const key = randomUUID();
    const body = { organizationName: 'C16 Org', contactName: 'C16' };
    const stack1 = createSalesLeadsStack(prisma);
    const a = await stack1.leads.create(claims, stack1.perms, body, key);
    const stack2 = createSalesLeadsStack(prisma);
    const b = await stack2.leads.create(claims, stack2.perms, body, key);
    expect(b.id).toBe(a.id);
    expect(await prisma.platformSalesLead.count({ where: { organizationName: 'C16 Org' } })).toBe(1);
  });

  it('C17 process-local cache loss (new stack, same durable claim)', async () => {
    const { claims } = await managerActor();
    const key = randomUUID();
    const body = { organizationName: 'C17 Org', contactName: 'C17' };
    const stack1 = createSalesLeadsStack(prisma);
    const a = await stack1.leads.create(claims, stack1.perms, body, key);
    // New stack has no process-local memory; durable claim must replay.
    const stack2 = createSalesLeadsStack(prisma);
    const b = await stack2.leads.create(claims, stack2.perms, body, key);
    expect(b.id).toBe(a.id);
    expect(await prisma.platformSalesIdempotencyRecord.count()).toBeGreaterThanOrEqual(1);
  });

  it('C18 multi-instance exact duplicate (two stacks concurrent identical create)', async () => {
    const { claims } = await managerActor();
    const key = randomUUID();
    const body = { organizationName: 'C18 Org', contactName: 'C18' };
    const s1 = createSalesLeadsStack(prisma);
    const s2 = createSalesLeadsStack(prisma);
    const results = await Promise.allSettled([
      s1.leads.create(claims, s1.perms, body, key),
      s2.leads.create(claims, s2.perms, body, key),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled') as Array<
      PromiseFulfilledResult<{ id: string }>
    >;
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    expect(new Set(fulfilled.map((r) => r.value.id)).size).toBe(1);
    expect(await prisma.platformSalesLead.count({ where: { organizationName: 'C18 Org' } })).toBe(1);
  });

  it('C19 stale rowVersion mutation denied', async () => {
    const { claims, stack } = await managerActor();
    const lead = await stack.leads.create(
      claims,
      stack.perms,
      { organizationName: 'C19 Org', contactName: 'C19' },
      randomUUID(),
    );
    await stack.leads.update(claims, stack.perms, lead.id, {
      contactJobTitle: 'Director',
      expectedRowVersion: lead.rowVersion,
    });
    await expect(
      stack.leads.update(claims, stack.perms, lead.id, {
        contactJobTitle: 'Stale',
        expectedRowVersion: lead.rowVersion,
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('C20 representative A/B isolation under race (rep A cannot win update on B\'s lead)', async () => {
    const manager = await managerActor();
    const repAUser = await createPlatformUserFixture(prisma, {
      email: `c20a-${randomUUID()}@test.local`,
      roleKeys: [SALES_REP_ROLE],
    });
    const repBUser = await createPlatformUserFixture(prisma, {
      email: `c20b-${randomUUID()}@test.local`,
      roleKeys: [SALES_REP_ROLE],
    });
    const profileA = await createRepProfile(prisma, repAUser.id);
    const profileB = await createRepProfile(prisma, repBUser.id);
    const sessionA = await createPlatformRefreshSession(prisma, repAUser.id);
    const claimsA = platformClaims(repAUser.id, sessionA.sessionId, [SALES_REP_ROLE]);
    const lead = await manager.stack.leads.create(
      manager.claims,
      manager.stack.perms,
      {
        organizationName: 'C20 B Org',
        contactName: 'OwnedByB',
        ownerRepresentativeId: profileB.id,
      },
      randomUUID(),
    );
    const repStack = createSalesLeadsStack(prisma, {
      permissions: [SALES_LEAD_PERMISSIONS.view, SALES_LEAD_PERMISSIONS.manage],
    });
    const results = await Promise.allSettled([
      repStack.leads.update(claimsA, repStack.perms, lead.id, {
        organizationName: 'Hijacked',
        expectedRowVersion: lead.rowVersion,
      }),
      manager.stack.leads.update(manager.claims, manager.stack.perms, lead.id, {
        organizationName: 'ManagerWins',
        expectedRowVersion: lead.rowVersion,
      }),
    ]);
    const aResult = results[0];
    expect(aResult.status).toBe('rejected');
    const fresh = await manager.stack.leads.getById(manager.claims, manager.stack.perms, lead.id);
    expect(fresh.organizationName).not.toBe('Hijacked');
    expect(fresh.ownerRepresentativeId).toBe(profileB.id);
    void profileA;
  });

  it('C21 manager reassignment vs direct representative update race', async () => {
    const manager = await managerActor();
    const repUser = await createPlatformUserFixture(prisma, {
      email: `c21r-${randomUUID()}@test.local`,
      roleKeys: [SALES_REP_ROLE],
    });
    const otherRep = await createPlatformUserFixture(prisma, {
      email: `c21o-${randomUUID()}@test.local`,
      roleKeys: [SALES_REP_ROLE],
    });
    const profile = await createRepProfile(prisma, repUser.id);
    const otherProfile = await createRepProfile(prisma, otherRep.id);
    const session = await createPlatformRefreshSession(prisma, repUser.id);
    const claimsRep = platformClaims(repUser.id, session.sessionId, [SALES_REP_ROLE]);
    const lead = await manager.stack.leads.create(
      manager.claims,
      manager.stack.perms,
      {
        organizationName: 'C21 Org',
        contactName: 'C21',
        ownerRepresentativeId: profile.id,
      },
      randomUUID(),
    );
    const repStack = createSalesLeadsStack(prisma, {
      permissions: [SALES_LEAD_PERMISSIONS.view, SALES_LEAD_PERMISSIONS.manage],
    });
    const results = await Promise.allSettled([
      manager.stack.leads.assignOwner(manager.claims, manager.stack.perms, lead.id, {
        ownerRepresentativeId: otherProfile.id,
        expectedRowVersion: lead.rowVersion,
      }),
      repStack.leads.update(claimsRep, repStack.perms, lead.id, {
        contactJobTitle: 'RepUpdate',
        expectedRowVersion: lead.rowVersion,
      }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    const fresh = await manager.stack.leads.getById(manager.claims, manager.stack.perms, lead.id);
    // Exactly one mutation applied; owner is either still original or reassigned.
    expect([profile.id, otherProfile.id]).toContain(fresh.ownerRepresentativeId);
  });

  it('C22 stage-history exact cardinality under concurrency (measure history count)', async () => {
    const { claims, stack } = await managerActor();
    const lead = await stack.leads.create(
      claims,
      stack.perms,
      { organizationName: 'C22 Org', contactName: 'C22' },
      randomUUID(),
    );
    const before = await prisma.platformSalesLeadStageHistory.count({ where: { leadId: lead.id } });
    const results = await Promise.allSettled([
      stack.leads.changeStage(claims, stack.perms, lead.id, {
        stage: 'CONTACTED',
        expectedRowVersion: lead.rowVersion,
      }),
      stack.leads.changeStage(claims, stack.perms, lead.id, {
        stage: 'QUALIFIED',
        expectedRowVersion: lead.rowVersion,
      }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const after = await prisma.platformSalesLeadStageHistory.count({ where: { leadId: lead.id } });
    expect(after - before).toBe(1);
  });

  it('C23 ownership-history exact cardinality under concurrency', async () => {
    const { claims, stack } = await managerActor();
    const u1 = await createPlatformUserFixture(prisma, {
      email: `c23a-${randomUUID()}@test.local`,
      roleKeys: [SALES_REP_ROLE],
    });
    const u2 = await createPlatformUserFixture(prisma, {
      email: `c23b-${randomUUID()}@test.local`,
      roleKeys: [SALES_REP_ROLE],
    });
    const r1 = await createRepProfile(prisma, u1.id);
    const r2 = await createRepProfile(prisma, u2.id);
    const lead = await stack.leads.create(
      claims,
      stack.perms,
      { organizationName: 'C23 Org', contactName: 'C23' },
      randomUUID(),
    );
    const before = await prisma.platformSalesLeadOwnershipHistory.count({
      where: { leadId: lead.id },
    });
    const results = await Promise.allSettled([
      stack.leads.assignOwner(claims, stack.perms, lead.id, {
        ownerRepresentativeId: r1.id,
        expectedRowVersion: lead.rowVersion,
      }),
      stack.leads.assignOwner(claims, stack.perms, lead.id, {
        ownerRepresentativeId: r2.id,
        expectedRowVersion: lead.rowVersion,
      }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const after = await prisma.platformSalesLeadOwnershipHistory.count({
      where: { leadId: lead.id },
    });
    expect(after - before).toBe(1);
  });

  it('C24 audit exact cardinality under concurrency', async () => {
    const { claims, stack } = await managerActor();
    const lead = await stack.leads.create(
      claims,
      stack.perms,
      { organizationName: 'C24 Org', contactName: 'C24' },
      randomUUID(),
    );
    const before = await countLeadAudits(prisma, SALES_LEAD_AUDIT_ACTIONS.UPDATED);
    const results = await Promise.allSettled([
      stack.leads.update(claims, stack.perms, lead.id, {
        organizationName: 'C24 A',
        expectedRowVersion: lead.rowVersion,
      }),
      stack.leads.update(claims, stack.perms, lead.id, {
        organizationName: 'C24 B',
        expectedRowVersion: lead.rowVersion,
      }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const after = await countLeadAudits(prisma, SALES_LEAD_AUDIT_ACTIONS.UPDATED);
    expect(after - before).toBe(1);
  });
});
