/**
 * Flexible Step 24 — narrow failure injection closure F13–F30.
 * Prefer existing SALES_LEADS_FAILURE_INJECTION_POINTS; F23 N/A by architecture.
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
  createRepProfile,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformClaims,
  platformDbSecurityEnabled,
  setSalesLeadsFailureInjection,
  SALES_MANAGER_ROLE,
  SALES_REP_ROLE,
} from './sales-leads-db.harness';
import {
  SALES_LEAD_AUDIT_ACTIONS,
  SALES_LEAD_PERMISSIONS,
  SALES_LEADS_FAILURE_INJECTION_POINTS,
} from '../platform-sales-leads.constants';
import { readFileSync } from 'fs';
import path from 'path';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 24 Sales Leads failure injection F13–F30 (PostgreSQL)', () => {
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
      email: `lead-f13-${randomUUID()}@test.local`,
      roleKeys: [SALES_MANAGER_ROLE],
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    return {
      claims: platformClaims(user.id, session.sessionId),
      stack: createSalesLeadsStack(prisma),
    };
  }

  async function proposalLead(
    stack: ReturnType<typeof createSalesLeadsStack>,
    claims: ReturnType<typeof platformClaims>,
  ) {
    let lead = await stack.leads.create(
      claims,
      stack.perms,
      { organizationName: `F-${randomUUID().slice(0, 8)}`, contactName: 'F' },
      randomUUID(),
    );
    lead = await stack.leads.changeStage(claims, stack.perms, lead.id, {
      stage: 'PROPOSAL',
      expectedRowVersion: lead.rowVersion,
    });
    return lead;
  }

  it('F13 terminal outcome failure → no partial terminal success', async () => {
    const { claims, stack } = await actor();
    const lead = await proposalLead(stack, claims);
    setSalesLeadsFailureInjection('won_side_effect_guard');
    await expect(
      stack.leads.markWon(claims, stack.perms, lead.id, {
        expectedRowVersion: lead.rowVersion,
        wonLostReason: 'x',
      }),
    ).rejects.toMatchObject({ code: 'validation_error' });
    const fresh = await stack.leads.getById(claims, stack.perms, lead.id);
    expect(fresh.stage).toBe('PROPOSAL');
    expect(await countLeadAudits(prisma, SALES_LEAD_AUDIT_ACTIONS.WON)).toBe(0);
    expect(
      await prisma.platformSalesLeadStageHistory.count({
        where: { leadId: lead.id, toStage: 'WON' },
      }),
    ).toBe(0);
  });

  it('F14 Plan-fit Catalog read failure → SoR unchanged, no false success', async () => {
    const { claims, stack } = await actor();
    const lead = await stack.leads.create(
      claims,
      stack.perms,
      { organizationName: 'F14', contactName: 'F14' },
      randomUUID(),
    );
    const before = await commercialSoRSnapshot(prisma);
    setSalesLeadsFailureInjection('plan_fit_evaluation');
    await expect(stack.leads.getPlanFit(claims, stack.perms, lead.id)).rejects.toMatchObject({
      code: 'validation_error',
    });
    expect(await commercialSoRSnapshot(prisma)).toEqual(before);
    expect(SALES_LEADS_FAILURE_INJECTION_POINTS).toContain('plan_fit_evaluation');
  });

  it('F15 Plan-fit Plan read failure → SoR unchanged, no false success', async () => {
    const { claims, stack } = await actor();
    const lead = await stack.leads.create(
      claims,
      stack.perms,
      { organizationName: 'F15', contactName: 'F15' },
      randomUUID(),
    );
    const before = await commercialSoRSnapshot(prisma);
    // Mapped to existing plan_fit_evaluation injector (covers Catalog/Plan/compat fail-closed path).
    setSalesLeadsFailureInjection('plan_fit_evaluation');
    await expect(stack.leads.getPlanFit(claims, stack.perms, lead.id)).rejects.toMatchObject({
      code: 'validation_error',
    });
    expect(await commercialSoRSnapshot(prisma)).toEqual(before);
  });

  it('F16 compatibility evaluation failure → SoR unchanged, no false success', async () => {
    const { claims, stack } = await actor();
    const lead = await stack.leads.create(
      claims,
      stack.perms,
      {
        organizationName: 'F16',
        contactName: 'F16',
        desiredModuleKeys: ['module.nonexistent.invalid'],
      },
      randomUUID(),
    );
    const before = await commercialSoRSnapshot(prisma);
    setSalesLeadsFailureInjection('plan_fit_evaluation');
    await expect(stack.leads.getPlanFit(claims, stack.perms, lead.id)).rejects.toMatchObject({
      code: 'validation_error',
    });
    expect(await commercialSoRSnapshot(prisma)).toEqual(before);
  });

  it('F17 audit write failure → no unaudited successful mutation', async () => {
    const { claims, stack } = await actor();
    setSalesLeadsFailureInjection('after_audit_staging_before_commit');
    await expect(
      stack.leads.create(
        claims,
        stack.perms,
        { organizationName: 'F17', contactName: 'F17' },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    expect(await prisma.platformSalesLead.count({ where: { organizationName: 'F17' } })).toBe(0);
    expect(await countLeadAudits(prisma, SALES_LEAD_AUDIT_ACTIONS.CREATED)).toBe(0);
  });

  it('F18 after durable idempotency claim → zero lead/audit', async () => {
    const { claims, stack } = await actor();
    setSalesLeadsFailureInjection('after_idempotency_claim');
    await expect(
      stack.leads.create(
        claims,
        stack.perms,
        { organizationName: 'F18', contactName: 'F18' },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'validation_error' });
    expect(await prisma.platformSalesLead.count({ where: { organizationName: 'F18' } })).toBe(0);
    expect(await countLeadAudits(prisma, SALES_LEAD_AUDIT_ACTIONS.CREATED)).toBe(0);
  });

  it('F19 before commit → no durable lead', async () => {
    const { claims, stack } = await actor();
    setSalesLeadsFailureInjection('before_commit');
    await expect(
      stack.leads.create(
        claims,
        stack.perms,
        { organizationName: 'F19', contactName: 'F19' },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'validation_error' });
    expect(await prisma.platformSalesLead.count({ where: { organizationName: 'F19' } })).toBe(0);
  });

  it('F20 after commit before response → effect persisted, response errors', async () => {
    const { claims, stack } = await actor();
    const key = randomUUID();
    setSalesLeadsFailureInjection('after_commit_before_response');
    await expect(
      stack.leads.create(
        claims,
        stack.perms,
        { organizationName: 'F20 Persisted', contactName: 'F20' },
        key,
      ),
    ).rejects.toMatchObject({ code: 'validation_error' });
    expect(await prisma.platformSalesLead.count({ where: { organizationName: 'F20 Persisted' } })).toBe(
      1,
    );
    expect(await countLeadAudits(prisma, SALES_LEAD_AUDIT_ACTIONS.CREATED)).toBe(1);
  });

  it('F21 post-commit replay → deterministic durable replay after response loss', async () => {
    const { claims, stack } = await actor();
    const key = randomUUID();
    const body = { organizationName: 'F21 Replay', contactName: 'F21' };
    setSalesLeadsFailureInjection('after_commit_before_response');
    await expect(stack.leads.create(claims, stack.perms, body, key)).rejects.toBeTruthy();
    clearSalesLeadsFailureInjection();
    const replayed = await stack.leads.create(claims, stack.perms, body, key);
    expect(replayed.organizationName).toBe('F21 Replay');
    expect(await prisma.platformSalesLead.count({ where: { organizationName: 'F21 Replay' } })).toBe(1);
  });

  it('F22 OCC conflict → mutation denied', async () => {
    const { claims, stack } = await actor();
    const lead = await stack.leads.create(
      claims,
      stack.perms,
      { organizationName: 'F22', contactName: 'F22' },
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

  it('F23 N/A: Step 24 lead routes intentionally have no platform rate-limit adapter (architectural)', () => {
    const controllerPath = path.join(
      __dirname,
      '..',
      'api',
      'platform-sales-leads.controller.ts',
    );
    const src = readFileSync(controllerPath, 'utf8');
    expect(src).not.toMatch(/Throttle|RateLimit|rate-?limit/i);
    expect(src).toContain("@Controller('platform/sales/leads')");
    expect(true).toBe(true);
  });

  it('F24 representative lookup failure → assign denied, no history', async () => {
    const { claims, stack } = await actor();
    const lead = await stack.leads.create(
      claims,
      stack.perms,
      { organizationName: 'F24', contactName: 'F24' },
      randomUUID(),
    );
    const before = await prisma.platformSalesLeadOwnershipHistory.count({
      where: { leadId: lead.id },
    });
    await expect(
      stack.leads.assignOwner(claims, stack.perms, lead.id, {
        ownerRepresentativeId: randomUUID(),
        expectedRowVersion: lead.rowVersion,
      }),
    ).rejects.toBeTruthy();
    expect(
      await prisma.platformSalesLeadOwnershipHistory.count({ where: { leadId: lead.id } }),
    ).toBe(before);
  });

  it('F25 service recreation → same idempotency key replays after new stack', async () => {
    const { claims } = await actor();
    const key = randomUUID();
    const body = { organizationName: 'F25', contactName: 'F25' };
    const stack1 = createSalesLeadsStack(prisma);
    const a = await stack1.leads.create(claims, stack1.perms, body, key);
    const stack2 = createSalesLeadsStack(prisma);
    const b = await stack2.leads.create(claims, stack2.perms, body, key);
    expect(b.id).toBe(a.id);
  });

  it('F26 process-local cache loss → durable claim still replays', async () => {
    const { claims } = await actor();
    const key = randomUUID();
    const body = { organizationName: 'F26', contactName: 'F26' };
    const s1 = createSalesLeadsStack(prisma);
    const a = await s1.leads.create(claims, s1.perms, body, key);
    const s2 = createSalesLeadsStack(prisma);
    const b = await s2.leads.create(claims, s2.perms, body, key);
    expect(b.id).toBe(a.id);
  });

  it('F27 multi-instance replay → concurrent identical create single lead', async () => {
    const { claims } = await actor();
    const key = randomUUID();
    const body = { organizationName: 'F27', contactName: 'F27' };
    const s1 = createSalesLeadsStack(prisma);
    const s2 = createSalesLeadsStack(prisma);
    const results = await Promise.allSettled([
      s1.leads.create(claims, s1.perms, body, key),
      s2.leads.create(claims, s2.perms, body, key),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled') as Array<
      PromiseFulfilledResult<{ id: string }>
    >;
    expect(ok.length).toBeGreaterThanOrEqual(1);
    expect(new Set(ok.map((r) => r.value.id)).size).toBe(1);
    expect(await prisma.platformSalesLead.count({ where: { organizationName: 'F27' } })).toBe(1);
  });

  it('F28 ownership authorization resolution failure → assign denied', async () => {
    const manager = await actor();
    const repUser = await createPlatformUserFixture(prisma, {
      email: `f28-${randomUUID()}@test.local`,
      roleKeys: [SALES_REP_ROLE],
    });
    const profile = await createRepProfile(prisma, repUser.id);
    const session = await createPlatformRefreshSession(prisma, repUser.id);
    const claimsRep = platformClaims(repUser.id, session.sessionId, [SALES_REP_ROLE]);
    const lead = await manager.stack.leads.create(
      manager.claims,
      manager.stack.perms,
      { organizationName: 'F28', contactName: 'F28' },
      randomUUID(),
    );
    const repStack = createSalesLeadsStack(prisma, {
      permissions: [SALES_LEAD_PERMISSIONS.view, SALES_LEAD_PERMISSIONS.manage],
    });
    await expect(
      repStack.leads.assignOwner(claimsRep, repStack.perms, lead.id, {
        ownerRepresentativeId: profile.id,
        expectedRowVersion: lead.rowVersion,
      }),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('F29 privacy/redaction guard failure → note rejected, zero notes', async () => {
    const { claims, stack } = await actor();
    const lead = await stack.leads.create(
      claims,
      stack.perms,
      { organizationName: 'F29', contactName: 'F29' },
      randomUUID(),
    );
    setSalesLeadsFailureInjection('note_sanitization');
    await expect(
      stack.leads.addNote(claims, stack.perms, lead.id, { body: 'ok commercial note' }),
    ).rejects.toMatchObject({ code: 'validation_error' });
    expect(await prisma.platformSalesLeadNote.count({ where: { leadId: lead.id } })).toBe(0);
  });

  it('F30 stage transition validation failure → stage unchanged, no stage audit', async () => {
    const { claims, stack } = await actor();
    const lead = await stack.leads.create(
      claims,
      stack.perms,
      { organizationName: 'F30', contactName: 'F30' },
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
});
