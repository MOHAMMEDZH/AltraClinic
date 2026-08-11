/**
 * Flexible Step 24 — stage transitions + ownership history (R01–R20 style).
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
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformClaims,
  platformDbSecurityEnabled,
  SALES_MANAGER_ROLE,
} from './sales-leads-db.harness';
import { SALES_LEAD_AUDIT_ACTIONS } from '../platform-sales-leads.constants';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

const FORWARD: Array<
  'CONTACTED' | 'QUALIFIED' | 'DEMO_SCHEDULED' | 'PROPOSAL'
> = ['CONTACTED', 'QUALIFIED', 'DEMO_SCHEDULED', 'PROPOSAL'];

describeDb('Step 24 Sales Leads stage + ownership (PostgreSQL)', () => {
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

  async function manager() {
    const user = await createPlatformUserFixture(prisma, {
      email: `lead-stage-${randomUUID()}@test.local`,
      roleKeys: [SALES_MANAGER_ROLE],
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    return { user, claims: platformClaims(user.id, session.sessionId) };
  }

  async function seedLead() {
    const m = await manager();
    const stack = createSalesLeadsStack(prisma);
    const lead = await stack.leads.create(
      m.claims,
      stack.perms,
      { organizationName: 'Stage Org', contactName: 'Contact' },
      randomUUID(),
    );
    return { m, stack, lead };
  }

  it('R01: create starts at NEW with stage history', async () => {
    const { m, stack, lead } = await seedLead();
    expect(lead.stage).toBe('NEW');
    const history = await stack.leads.listStageHistory(m.claims, stack.perms, lead.id);
    expect(history[0].toStage).toBe('NEW');
    expect(history[0].fromStage).toBeNull();
  });

  it('R02-R05: forward path NEW→CONTACTED→QUALIFIED→DEMO_SCHEDULED→PROPOSAL', async () => {
    let { m, stack, lead } = await seedLead();
    for (const stage of FORWARD) {
      lead = await stack.leads.changeStage(m.claims, stack.perms, lead.id, {
        stage,
        expectedRowVersion: lead.rowVersion,
      });
      expect(lead.stage).toBe(stage);
    }
    const audits = await countLeadAudits(prisma, SALES_LEAD_AUDIT_ACTIONS.STAGE_CHANGED);
    expect(audits).toBe(4);
  });

  it('R06: LOST allowed from NEW', async () => {
    const { m, stack, lead } = await seedLead();
    const lost = await stack.leads.markLost(m.claims, stack.perms, lead.id, {
      expectedRowVersion: lead.rowVersion,
      wonLostReason: 'Not interested',
    });
    expect(lost.stage).toBe('LOST');
    expect(lost.wonLostReason).toBe('Not interested');
  });

  it('R07: LOST allowed from QUALIFIED', async () => {
    let { m, stack, lead } = await seedLead();
    lead = await stack.leads.changeStage(m.claims, stack.perms, lead.id, {
      stage: 'CONTACTED',
      expectedRowVersion: lead.rowVersion,
    });
    lead = await stack.leads.changeStage(m.claims, stack.perms, lead.id, {
      stage: 'QUALIFIED',
      expectedRowVersion: lead.rowVersion,
    });
    const lost = await stack.leads.markLost(m.claims, stack.perms, lead.id, {
      expectedRowVersion: lead.rowVersion,
      wonLostReason: 'Budget',
    });
    expect(lost.stage).toBe('LOST');
  });

  it('R08: WON allowed from PROPOSAL', async () => {
    let { m, stack, lead } = await seedLead();
    for (const stage of FORWARD) {
      lead = await stack.leads.changeStage(m.claims, stack.perms, lead.id, {
        stage,
        expectedRowVersion: lead.rowVersion,
      });
    }
    const won = await stack.leads.markWon(m.claims, stack.perms, lead.id, {
      expectedRowVersion: lead.rowVersion,
      wonLostReason: 'Signed',
    });
    expect(won.stage).toBe('WON');
  });

  it('R09: WON allowed from DEMO_SCHEDULED', async () => {
    let { m, stack, lead } = await seedLead();
    for (const stage of ['CONTACTED', 'QUALIFIED', 'DEMO_SCHEDULED'] as const) {
      lead = await stack.leads.changeStage(m.claims, stack.perms, lead.id, {
        stage,
        expectedRowVersion: lead.rowVersion,
      });
    }
    const won = await stack.leads.markWon(m.claims, stack.perms, lead.id, {
      expectedRowVersion: lead.rowVersion,
      wonLostReason: 'Fast close',
    });
    expect(won.stage).toBe('WON');
  });

  it('R10: WON rejected from NEW', async () => {
    const { m, stack, lead } = await seedLead();
    await expect(
      stack.leads.markWon(m.claims, stack.perms, lead.id, {
        expectedRowVersion: lead.rowVersion,
        wonLostReason: 'Too early',
      }),
    ).rejects.toMatchObject({ code: 'validation_error' });
  });

  it('R11: reverse CONTACTED→NEW rejected', async () => {
    let { m, stack, lead } = await seedLead();
    lead = await stack.leads.changeStage(m.claims, stack.perms, lead.id, {
      stage: 'CONTACTED',
      expectedRowVersion: lead.rowVersion,
    });
    await expect(
      stack.leads.changeStage(m.claims, stack.perms, lead.id, {
        stage: 'NEW',
        expectedRowVersion: lead.rowVersion,
      }),
    ).rejects.toMatchObject({ code: 'validation_error' });
  });

  it('R12: terminal WON cannot transition further', async () => {
    let { m, stack, lead } = await seedLead();
    for (const stage of FORWARD) {
      lead = await stack.leads.changeStage(m.claims, stack.perms, lead.id, {
        stage,
        expectedRowVersion: lead.rowVersion,
      });
    }
    lead = await stack.leads.markWon(m.claims, stack.perms, lead.id, {
      expectedRowVersion: lead.rowVersion,
      wonLostReason: 'Done',
    });
    await expect(
      stack.leads.markLost(m.claims, stack.perms, lead.id, {
        expectedRowVersion: lead.rowVersion,
        wonLostReason: 'Nope',
      }),
    ).rejects.toMatchObject({ code: 'validation_error' });
  });

  it('R13: terminal requires wonLostReason', async () => {
    const { m, stack, lead } = await seedLead();
    await expect(
      stack.leads.changeStage(m.claims, stack.perms, lead.id, {
        stage: 'LOST',
        expectedRowVersion: lead.rowVersion,
      }),
    ).rejects.toMatchObject({ code: 'validation_error' });
  });

  it('R14: stage change writes history', async () => {
    let { m, stack, lead } = await seedLead();
    lead = await stack.leads.changeStage(m.claims, stack.perms, lead.id, {
      stage: 'CONTACTED',
      expectedRowVersion: lead.rowVersion,
      reason: 'called',
    });
    const history = await stack.leads.listStageHistory(m.claims, stack.perms, lead.id);
    expect(history.some((h) => h.fromStage === 'NEW' && h.toStage === 'CONTACTED')).toBe(true);
  });

  it('R15: skip-ahead NEW→PROPOSAL allowed', async () => {
    const { m, stack, lead } = await seedLead();
    const advanced = await stack.leads.changeStage(m.claims, stack.perms, lead.id, {
      stage: 'PROPOSAL',
      expectedRowVersion: lead.rowVersion,
    });
    expect(advanced.stage).toBe('PROPOSAL');
  });

  it('R16: same-stage change rejected', async () => {
    const { m, stack, lead } = await seedLead();
    await expect(
      stack.leads.changeStage(m.claims, stack.perms, lead.id, {
        stage: 'NEW',
        expectedRowVersion: lead.rowVersion,
      }),
    ).rejects.toMatchObject({ code: 'validation_error' });
  });

  it('R17: update blocked on terminal', async () => {
    const { m, stack, lead } = await seedLead();
    const lost = await stack.leads.markLost(m.claims, stack.perms, lead.id, {
      expectedRowVersion: lead.rowVersion,
      wonLostReason: 'gone',
    });
    await expect(
      stack.leads.update(m.claims, stack.perms, lost.id, {
        organizationName: 'Nope',
        expectedRowVersion: lost.rowVersion,
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('R18: demo update increments rowVersion and audits', async () => {
    const { m, stack, lead } = await seedLead();
    const updated = await stack.leads.updateDemo(m.claims, stack.perms, lead.id, {
      demoStatus: 'SCHEDULED',
      demoScheduledAt: new Date().toISOString(),
      demoTimezone: 'UTC',
      expectedRowVersion: lead.rowVersion,
    });
    expect(updated.demoStatus).toBe('SCHEDULED');
    expect(updated.rowVersion).toBe(lead.rowVersion + 1);
    expect(await countLeadAudits(prisma, SALES_LEAD_AUDIT_ACTIONS.DEMO_UPDATED)).toBe(1);
  });

  it('R19: notes reject HTML/script and accept plain text', async () => {
    const { m, stack, lead } = await seedLead();
    await expect(
      stack.leads.addNote(m.claims, stack.perms, lead.id, { body: '<script>x</script>' }),
    ).rejects.toMatchObject({ code: 'validation_error' });
    const note = await stack.leads.addNote(m.claims, stack.perms, lead.id, {
      body: 'Follow up next week',
    });
    expect(note.body).toBe('Follow up next week');
    const notes = await stack.leads.listNotes(m.claims, stack.perms, lead.id);
    expect(notes).toHaveLength(1);
  });

  it('R20: ownership history records assign on create when owner set', async () => {
    const m = await manager();
    const repUser = await createPlatformUserFixture(prisma, {
      email: `own-${randomUUID()}@test.local`,
      roleKeys: ['sales_representative'],
    });
    const rep = await createRepProfile(prisma, repUser.id);
    const stack = createSalesLeadsStack(prisma);
    const lead = await stack.leads.create(
      m.claims,
      stack.perms,
      {
        organizationName: 'Owned',
        contactName: 'O',
        ownerRepresentativeId: rep.id,
      },
      randomUUID(),
    );
    const history = await stack.leads.listOwnershipHistory(m.claims, stack.perms, lead.id);
    expect(history[0].toOwnerRepresentativeId).toBe(rep.id);
  });
});
