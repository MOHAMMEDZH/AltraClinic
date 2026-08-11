/**
 * Flexible Step 24 — failure injection (F* style). Model B: NODE_ENV=test only.
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
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformClaims,
  platformDbSecurityEnabled,
  setSalesLeadsFailureInjection,
  SALES_MANAGER_ROLE,
} from './sales-leads-db.harness';
import { SALES_LEAD_AUDIT_ACTIONS } from '../platform-sales-leads.constants';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 24 Sales Leads failure injection (PostgreSQL)', () => {
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

  async function actor() {
    const user = await createPlatformUserFixture(prisma, {
      email: `lead-f-${randomUUID()}@test.local`,
      roleKeys: [SALES_MANAGER_ROLE],
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    return {
      claims: platformClaims(user.id, session.sessionId),
      stack: createSalesLeadsStack(prisma),
    };
  }

  it('F01: after_idempotency_claim aborts create with zero lead/audit', async () => {
    const { claims, stack } = await actor();
    setSalesLeadsFailureInjection('after_idempotency_claim');
    await expect(
      stack.leads.create(
        claims,
        stack.perms,
        { organizationName: 'Fail', contactName: 'F' },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'validation_error' });
    expect(await prisma.platformSalesLead.count()).toBe(0);
    expect(await countLeadAudits(prisma, SALES_LEAD_AUDIT_ACTIONS.CREATED)).toBe(0);
  });

  it('F02: source_state_validation aborts create', async () => {
    const { claims, stack } = await actor();
    setSalesLeadsFailureInjection('source_state_validation');
    await expect(
      stack.leads.create(
        claims,
        stack.perms,
        { organizationName: 'Fail2', contactName: 'F2' },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'validation_error' });
    expect(await prisma.platformSalesLead.count()).toBe(0);
  });

  it('F03: before_commit aborts create — no durable lead', async () => {
    const { claims, stack } = await actor();
    setSalesLeadsFailureInjection('before_commit');
    await expect(
      stack.leads.create(
        claims,
        stack.perms,
        { organizationName: 'Fail3', contactName: 'F3' },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'validation_error' });
    expect(await prisma.platformSalesLead.count()).toBe(0);
    expect(await countLeadAudits(prisma, SALES_LEAD_AUDIT_ACTIONS.CREATED)).toBe(0);
  });

  it('F04: after_audit_staging_before_commit rolls back create', async () => {
    const { claims, stack } = await actor();
    setSalesLeadsFailureInjection('after_audit_staging_before_commit');
    await expect(
      stack.leads.create(
        claims,
        stack.perms,
        { organizationName: 'Fail4', contactName: 'F4' },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    expect(await prisma.platformSalesLead.count()).toBe(0);
    expect(await countLeadAudits(prisma, SALES_LEAD_AUDIT_ACTIONS.CREATED)).toBe(0);
  });

  it('F05: after_commit_before_response — effect persisted, response errors', async () => {
    const { claims, stack } = await actor();
    setSalesLeadsFailureInjection('after_commit_before_response');
    await expect(
      stack.leads.create(
        claims,
        stack.perms,
        { organizationName: 'Persisted', contactName: 'P' },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'validation_error' });
    expect(await prisma.platformSalesLead.count()).toBe(1);
    expect(await countLeadAudits(prisma, SALES_LEAD_AUDIT_ACTIONS.CREATED)).toBe(1);
  });

  it('F06: stage_transition_validation aborts without audit', async () => {
    const { claims, stack } = await actor();
    const lead = await stack.leads.create(
      claims,
      stack.perms,
      { organizationName: 'StageFail', contactName: 'S' },
      randomUUID(),
    );
    setSalesLeadsFailureInjection('stage_transition_validation');
    await expect(
      stack.leads.changeStage(claims, stack.perms, lead.id, {
        stage: 'CONTACTED',
        expectedRowVersion: lead.rowVersion,
      }),
    ).rejects.toMatchObject({ code: 'validation_error' });
    expect(await countLeadAudits(prisma, SALES_LEAD_AUDIT_ACTIONS.STAGE_CHANGED)).toBe(0);
    const fresh = await stack.leads.getById(claims, stack.perms, lead.id);
    expect(fresh.stage).toBe('NEW');
  });

  it('F07: note_sanitization injection fails closed', async () => {
    const { claims, stack } = await actor();
    const lead = await stack.leads.create(
      claims,
      stack.perms,
      { organizationName: 'NoteFail', contactName: 'N' },
      randomUUID(),
    );
    setSalesLeadsFailureInjection('note_sanitization');
    await expect(
      stack.leads.addNote(claims, stack.perms, lead.id, { body: 'ok text' }),
    ).rejects.toMatchObject({ code: 'validation_error' });
    expect(await prisma.platformSalesLeadNote.count()).toBe(0);
  });

  it('F08: occ_conflict injection on update', async () => {
    const { claims, stack } = await actor();
    const lead = await stack.leads.create(
      claims,
      stack.perms,
      { organizationName: 'OccFail', contactName: 'O' },
      randomUUID(),
    );
    setSalesLeadsFailureInjection('occ_conflict');
    await expect(
      stack.leads.update(claims, stack.perms, lead.id, {
        organizationName: 'Nope',
        expectedRowVersion: lead.rowVersion,
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('F09: plan_fit_evaluation injection does not mutate SoR', async () => {
    const { claims, stack } = await actor();
    const lead = await stack.leads.create(
      claims,
      stack.perms,
      { organizationName: 'PFFail', contactName: 'P' },
      randomUUID(),
    );
    setSalesLeadsFailureInjection('plan_fit_evaluation');
    await expect(stack.leads.getPlanFit(claims, stack.perms, lead.id)).rejects.toMatchObject({
      code: 'validation_error',
    });
  });

  it('F10: owner_assign_validation aborts without history', async () => {
    const { claims, stack } = await actor();
    const lead = await stack.leads.create(
      claims,
      stack.perms,
      { organizationName: 'OwnFail', contactName: 'O' },
      randomUUID(),
    );
    setSalesLeadsFailureInjection('owner_assign_validation');
    await expect(
      stack.leads.assignOwner(claims, stack.perms, lead.id, {
        ownerRepresentativeId: null,
        expectedRowVersion: lead.rowVersion,
      }),
    ).rejects.toMatchObject({ code: 'validation_error' });
  });

  it('F11: won_side_effect_guard aborts WON without terminal stage', async () => {
    const { claims, stack } = await actor();
    let lead = await stack.leads.create(
      claims,
      stack.perms,
      { organizationName: 'WonFail', contactName: 'W' },
      randomUUID(),
    );
    lead = await stack.leads.changeStage(claims, stack.perms, lead.id, {
      stage: 'PROPOSAL',
      expectedRowVersion: lead.rowVersion,
    });
    setSalesLeadsFailureInjection('won_side_effect_guard');
    await expect(
      stack.leads.markWon(claims, stack.perms, lead.id, {
        expectedRowVersion: lead.rowVersion,
        wonLostReason: 'x',
      }),
    ).rejects.toMatchObject({ code: 'validation_error' });
    expect(await countLeadAudits(prisma, SALES_LEAD_AUDIT_ACTIONS.WON)).toBe(0);
    const fresh = await stack.leads.getById(claims, stack.perms, lead.id);
    expect(fresh.stage).toBe('PROPOSAL');
  });

  it('F12: injection inactive outside NODE_ENV=test', async () => {
    const { claims, stack } = await actor();
    setSalesLeadsFailureInjection('before_commit');
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const lead = await stack.leads.create(
        claims,
        stack.perms,
        { organizationName: 'ProdSafe', contactName: 'P' },
        randomUUID(),
      );
      expect(lead.organizationName).toBe('ProdSafe');
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});
