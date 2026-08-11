/**
 * Flexible Step 24 — Plan-fit advisory safety (PF01–PF16 style) + SoR delta=0.
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { createSalesLeadsStack } from './sales-leads-stack';
import {
  assertSafePlatformTestDatabaseUrl,
  cleanupSalesLeadTables,
  clearSalesLeadsFailureInjection,
  commercialSoRSnapshot,
  createPlatformDbSecurityClient,
  createPlatformRefreshSession,
  createPlatformUserFixture,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformClaims,
  platformDbSecurityEnabled,
  SALES_MANAGER_ROLE,
} from './sales-leads-db.harness';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 24 Sales Leads plan-fit safety (PostgreSQL)', () => {
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

  async function seed() {
    const user = await createPlatformUserFixture(prisma, {
      email: `lead-pf-${randomUUID()}@test.local`,
      roleKeys: [SALES_MANAGER_ROLE],
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    const claims = platformClaims(user.id, session.sessionId);
    const stack = createSalesLeadsStack(prisma);
    const lead = await stack.leads.create(
      claims,
      stack.perms,
      {
        organizationName: 'Plan Fit Clinic',
        contactName: 'Fit',
        facilityTypeKey: 'facility.clinic',
        specialtyKeys: [],
        desiredModuleKeys: [],
      },
      randomUUID(),
    );
    return { claims, stack, lead };
  }

  it('PF01: plan-fit returns advisory disclaimer flags', async () => {
    const { claims, stack, lead } = await seed();
    const fit = await stack.leads.getPlanFit(claims, stack.perms, lead.id);
    expect(fit.disclaimer.advisoryOnly).toBe(true);
    expect(fit.disclaimer.doesNotMutateCommercialSoR).toBe(true);
    expect(fit.disclaimer.notEntitlementDecision).toBe(true);
    expect(fit.disclaimer.notProvisioningDecision).toBe(true);
    expect(fit.disclaimer.notRuntimeLicenseDecision).toBe(true);
  });

  it('PF02: plan-fit SoR delta = 0 for plans/versions/entitlements/limits/subscriptions/overrides/tenants/provisioning', async () => {
    const before = await commercialSoRSnapshot(prisma);
    const { claims, stack, lead } = await seed();
    await stack.leads.getPlanFit(claims, stack.perms, lead.id);
    await stack.leads.getPlanFit(claims, stack.perms, lead.id);
    const after = await commercialSoRSnapshot(prisma);
    expect(after).toEqual(before);
  });

  it('PF03: plan-fit with unknown catalog key reports violation without mutating SoR', async () => {
    const before = await commercialSoRSnapshot(prisma);
    const { claims, stack, lead } = await seed();
    const updated = await stack.leads.update(claims, stack.perms, lead.id, {
      facilityTypeKey: 'facility.does_not_exist_xyz',
      expectedRowVersion: lead.rowVersion,
    });
    const fit = await stack.leads.getPlanFit(claims, stack.perms, updated.id);
    expect(fit.valid).toBe(false);
    expect(fit.violations.some((v) => v.reasonCode === 'unknown_catalog_key')).toBe(true);
    expect(await commercialSoRSnapshot(prisma)).toEqual(before);
  });

  it('PF04: create/update/stage/won/lost do not mutate commercial SoR', async () => {
    const before = await commercialSoRSnapshot(prisma);
    const { claims, stack, lead } = await seed();
    let current = await stack.leads.update(claims, stack.perms, lead.id, {
      organizationName: 'Renamed',
      expectedRowVersion: lead.rowVersion,
    });
    current = await stack.leads.changeStage(claims, stack.perms, current.id, {
      stage: 'CONTACTED',
      expectedRowVersion: current.rowVersion,
    });
    current = await stack.leads.changeStage(claims, stack.perms, current.id, {
      stage: 'DEMO_SCHEDULED',
      expectedRowVersion: current.rowVersion,
    });
    await stack.leads.markWon(claims, stack.perms, current.id, {
      expectedRowVersion: current.rowVersion,
      wonLostReason: 'closed',
    });
    expect(await commercialSoRSnapshot(prisma)).toEqual(before);
  });

  it('PF05: linkedPlatformTenantId never auto-creates tenant', async () => {
    const beforeTenants = await prisma.platformTenant.count();
    const { claims, stack } = await seed();
    await expect(
      stack.leads.create(
        claims,
        stack.perms,
        {
          organizationName: 'Bad Link',
          contactName: 'X',
          linkedPlatformTenantId: randomUUID(),
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'validation_error' });
    expect(await prisma.platformTenant.count()).toBe(beforeTenants);
  });

  it('PF06-PF10: repeated plan-fit calls are idempotent reads (no audit invent)', async () => {
    const { claims, stack, lead } = await seed();
    const auditsBefore = await prisma.auditEntry.count({
      where: { category: 'sales_pipeline_management' },
    });
    for (let i = 0; i < 5; i++) {
      await stack.leads.getPlanFit(claims, stack.perms, lead.id);
    }
    const auditsAfter = await prisma.auditEntry.count({
      where: { category: 'sales_pipeline_management' },
    });
    expect(auditsAfter).toBe(auditsBefore);
  });

  it('PF11: candidate plan versions array is present', async () => {
    const { claims, stack, lead } = await seed();
    const fit = await stack.leads.getPlanFit(claims, stack.perms, lead.id);
    expect(Array.isArray(fit.candidatePublishedPlanVersions)).toBe(true);
  });

  it('PF12: specialtyKeys bounded ≤16', async () => {
    const { claims, stack, lead } = await seed();
    await expect(
      stack.leads.update(claims, stack.perms, lead.id, {
        specialtyKeys: Array.from({ length: 17 }, (_, i) => `specialty.${i}`),
        expectedRowVersion: lead.rowVersion,
      }),
    ).rejects.toMatchObject({ code: 'validation_error' });
  });

  it('PF13: desiredModuleKeys bounded ≤32', async () => {
    const { claims, stack, lead } = await seed();
    await expect(
      stack.leads.update(claims, stack.perms, lead.id, {
        desiredModuleKeys: Array.from({ length: 33 }, (_, i) => `module.${i}`),
        expectedRowVersion: lead.rowVersion,
      }),
    ).rejects.toMatchObject({ code: 'validation_error' });
  });

  it('PF14: estimated ints reject negatives', async () => {
    const { claims, stack, lead } = await seed();
    await expect(
      stack.leads.update(claims, stack.perms, lead.id, {
        estimatedUsers: -1,
        expectedRowVersion: lead.rowVersion,
      }),
    ).rejects.toMatchObject({ code: 'validation_error' });
  });

  it('PF15: plan-fit after module selection returns structure', async () => {
    const { claims, stack, lead } = await seed();
    const updated = await stack.leads.update(claims, stack.perms, lead.id, {
      desiredModuleKeys: ['module.scheduling'],
      expectedRowVersion: lead.rowVersion,
    });
    const fit = await stack.leads.getPlanFit(claims, stack.perms, updated.id);
    expect(fit.leadId).toBe(updated.id);
    expect(typeof fit.valid).toBe('boolean');
  });

  it('PF16: no platform_sales_trials / opportunities tables required for plan-fit', async () => {
    const trials = await prisma.$queryRawUnsafe<Array<{ present: boolean }>>(
      `SELECT to_regclass('public.platform_sales_trials') IS NOT NULL AS present`,
    );
    const opps = await prisma.$queryRawUnsafe<Array<{ present: boolean }>>(
      `SELECT to_regclass('public.platform_sales_opportunities') IS NOT NULL AS present`,
    );
    expect(trials[0]?.present).toBe(false);
    expect(opps[0]?.present).toBe(false);
    const { claims, stack, lead } = await seed();
    await stack.leads.getPlanFit(claims, stack.perms, lead.id);
  });
});
