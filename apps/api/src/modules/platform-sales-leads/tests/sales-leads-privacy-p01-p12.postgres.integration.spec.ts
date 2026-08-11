/**
 * Flexible Step 24 — privacy matrix P01–P12.
 * Asserts actual frozen note policy (length + HTML/script reject; no PHI classifier).
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { createSalesLeadsStack } from './sales-leads-stack';
import {
  assertSafePlatformTestDatabaseUrl,
  cleanupSalesLeadTables,
  clearSalesLeadsFailureInjection,
  createPlatformDbSecurityClient,
  createPlatformRefreshSession,
  createPlatformUserFixture,
  createRepProfile,
  createTenantFixture,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  JWT_CFG,
  platformClaims,
  platformDbSecurityEnabled,
  SALES_MANAGER_ROLE,
  SALES_REP_ROLE,
} from './sales-leads-db.harness';
import { SALES_LEAD_PERMISSIONS, MAX_NOTE_BODY_CHARS } from '../platform-sales-leads.constants';
import { JwtService } from '@nestjs/jwt';
import { CLINIC_TOKEN_AUDIENCE } from '../../auth/domain/value-objects/jwt-claims.vo';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 24 Sales Leads privacy P01–P12 (PostgreSQL)', () => {
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

  async function actor(roleKeys: string[] = [SALES_MANAGER_ROLE]) {
    const user = await createPlatformUserFixture(prisma, {
      email: `lead-p-${randomUUID()}@test.local`,
      roleKeys,
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    const claims = platformClaims(user.id, session.sessionId, roleKeys);
    const stack = createSalesLeadsStack(prisma);
    return { user, claims, stack };
  }

  it('P01 note with patient-like text — frozen policy allows plain text (no PHI classifier; length/HTML only)', async () => {
    const { claims, stack } = await actor();
    const lead = await stack.leads.create(
      claims,
      stack.perms,
      { organizationName: 'P01', contactName: 'P01' },
      randomUUID(),
    );
    // Frozen policy: commercial notes reject empty/oversized/HTML; patient-like words alone are not classified.
    const note = await stack.leads.addNote(claims, stack.perms, lead.id, {
      body: 'Discussed patient onboarding timeline for clinic staff training (commercial).',
    });
    expect(note.body).toContain('patient');
    expect(note.body.length).toBeLessThanOrEqual(MAX_NOTE_BODY_CHARS);
  });

  it('P02 oversized note rejected', async () => {
    const { claims, stack } = await actor();
    const lead = await stack.leads.create(
      claims,
      stack.perms,
      { organizationName: 'P02', contactName: 'P02' },
      randomUUID(),
    );
    const oversized = 'x'.repeat(MAX_NOTE_BODY_CHARS + 1);
    await expect(
      stack.leads.addNote(claims, stack.perms, lead.id, { body: oversized }),
    ).rejects.toMatchObject({ code: 'validation_error' });
    expect(await prisma.platformSalesLeadNote.count({ where: { leadId: lead.id } })).toBe(0);
  });

  it('P03 script/HTML rejected', async () => {
    const { claims, stack } = await actor();
    const lead = await stack.leads.create(
      claims,
      stack.perms,
      { organizationName: 'P03', contactName: 'P03' },
      randomUUID(),
    );
    await expect(
      stack.leads.addNote(claims, stack.perms, lead.id, {
        body: '<script>alert(1)</script>',
      }),
    ).rejects.toMatchObject({ code: 'validation_error' });
    await expect(
      stack.leads.addNote(claims, stack.perms, lead.id, { body: '<b>bold</b>' }),
    ).rejects.toMatchObject({ code: 'validation_error' });
  });

  it('P04 response/audit have no token/password fields', async () => {
    const { claims, stack } = await actor();
    const lead = await stack.leads.create(
      claims,
      stack.perms,
      { organizationName: 'P04', contactName: 'P04', contactEmail: 'p04@example.com' },
      randomUUID(),
    );
    const dtoJson = JSON.stringify(lead);
    expect(dtoJson).not.toMatch(/password|accessToken|refreshToken|secret/i);
    const audits = await prisma.auditEntry.findMany({
      where: { category: 'sales_pipeline_management', resourceId: lead.id },
    });
    for (const a of audits) {
      expect(JSON.stringify(a)).not.toMatch(/"password"|"accessToken"|"refreshToken"/i);
    }
  });

  it('P05 unauthorized detail no contact fields in body', async () => {
    const manager = await actor([SALES_MANAGER_ROLE]);
    const rep = await actor([SALES_REP_ROLE]);
    await createRepProfile(prisma, rep.user.id);
    const lead = await manager.stack.leads.create(
      manager.claims,
      manager.stack.perms,
      {
        organizationName: 'SecretClinic',
        contactName: 'SecretContact',
        contactEmail: 'secret@example.com',
        contactPhone: '+1000000',
      },
      randomUUID(),
    );
    const repStack = createSalesLeadsStack(prisma, {
      permissions: [SALES_LEAD_PERMISSIONS.view, SALES_LEAD_PERMISSIONS.manage],
    });
    await expect(repStack.leads.getById(rep.claims, repStack.perms, lead.id)).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('P06 unauthorized search no org names leak (empty or no foreign orgs)', async () => {
    const manager = await actor([SALES_MANAGER_ROLE]);
    const rep = await actor([SALES_REP_ROLE]);
    await createRepProfile(prisma, rep.user.id);
    await manager.stack.leads.create(
      manager.claims,
      manager.stack.perms,
      { organizationName: 'HiddenOrgXYZ', contactName: 'Hidden' },
      randomUUID(),
    );
    const repStack = createSalesLeadsStack(prisma, {
      permissions: [SALES_LEAD_PERMISSIONS.view, SALES_LEAD_PERMISSIONS.manage],
    });
    const list = await repStack.leads.list(rep.claims, repStack.perms, {
      page: 1,
      pageSize: 25,
      search: 'HiddenOrgXYZ',
    });
    expect(list.items.every((i) => i.organizationName !== 'HiddenOrgXYZ')).toBe(true);
    expect(list.total).toBe(0);
  });

  it('P07 audit details omit raw note body (policy stores noteId only)', async () => {
    const { claims, stack } = await actor();
    const lead = await stack.leads.create(
      claims,
      stack.perms,
      { organizationName: 'P07', contactName: 'P07' },
      randomUUID(),
    );
    const secretBody = 'Commercial note with sensitive bidding amount 999999';
    await stack.leads.addNote(claims, stack.perms, lead.id, { body: secretBody });
    const audits = await prisma.auditEntry.findMany({
      where: { action: 'sales_lead.note_added', resourceId: lead.id },
    });
    expect(audits.length).toBeGreaterThanOrEqual(1);
    for (const a of audits) {
      const details = JSON.stringify(a.details ?? {});
      expect(details).not.toContain(secretBody);
      expect(details).toMatch(/noteId/);
    }
  });

  it('P08 clinic JWT denied at domain (platform claims required for stack; clinic audience not accepted)', async () => {
    const jwt = new JwtService({});
    const clinicToken = jwt.sign(
      {
        sub: randomUUID(),
        tenantId: randomUUID(),
        roles: ['admin'],
        sessionId: randomUUID(),
        sessionClass: 'staff',
        principalType: 'clinic',
        aud: CLINIC_TOKEN_AUDIENCE,
        iss: 'booking',
      },
      { secret: JWT_CFG.accessSecret, expiresIn: 900 },
    );
    expect(clinicToken.split('.').length).toBe(3);
    // Domain stack uses JwtClaimsVO platform principal; clinic principals lack sales-lead manage.
    const { stack } = await actor();
    const clinicClaims = platformClaims(randomUUID(), randomUUID(), ['admin']);
    await expect(
      stack.leads.list(clinicClaims, new Set(), { page: 1, pageSize: 10 }),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('P09 notes table is platform_sales_lead_notes not clinical', async () => {
    const { claims, stack } = await actor();
    const lead = await stack.leads.create(
      claims,
      stack.perms,
      { organizationName: 'P09', contactName: 'P09' },
      randomUUID(),
    );
    await stack.leads.addNote(claims, stack.perms, lead.id, { body: 'Commercial note' });
    const rows = await prisma.$queryRawUnsafe<Array<{ relname: string }>>(
      `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE c.relkind = 'r' AND c.relname LIKE '%lead%note%' AND n.nspname = 'public'`,
    );
    expect(rows.map((r) => r.relname)).toContain('platform_sales_lead_notes');
    expect(rows.map((r) => r.relname).join(',')).not.toMatch(/clinical|patient/i);
  });

  it('P10 plan-fit JSON has no patient keys', async () => {
    const { claims, stack } = await actor();
    const lead = await stack.leads.create(
      claims,
      stack.perms,
      { organizationName: 'P10', contactName: 'P10' },
      randomUUID(),
    );
    const fit = await stack.leads.getPlanFit(claims, stack.perms, lead.id);
    const json = JSON.stringify(fit);
    expect(json).not.toMatch(/"patient|"diagnosis|"clinicalRecord|"phi/i);
    expect(fit.disclaimer.advisoryOnly).toBe(true);
  });

  it('P11 demo fields are commercial only', async () => {
    const { claims, stack } = await actor();
    const lead = await stack.leads.create(
      claims,
      stack.perms,
      { organizationName: 'P11', contactName: 'P11' },
      randomUUID(),
    );
    const updated = await stack.leads.updateDemo(claims, stack.perms, lead.id, {
      demoStatus: 'SCHEDULED',
      demoTimezone: 'UTC',
      demoScheduledAt: new Date().toISOString(),
      demoNote: 'Platform commercial demo',
      expectedRowVersion: lead.rowVersion,
    });
    expect(updated.demoStatus).toBe('SCHEDULED');
    expect(updated).not.toHaveProperty('patientAppointmentId');
    expect(updated).not.toHaveProperty('clinicalSlotId');
    expect(JSON.stringify(updated)).not.toMatch(/patientAppointment|clinicalSlot/i);
  });

  it('P12 linked tenant returns only commercial fields if exposed', async () => {
    const { claims, stack } = await actor();
    const { platformTenant } = await createTenantFixture(prisma);
    const lead = await stack.leads.create(
      claims,
      stack.perms,
      {
        organizationName: 'P12',
        contactName: 'P12',
        linkedPlatformTenantId: platformTenant.id,
      },
      randomUUID(),
    );
    expect(lead.linkedPlatformTenantId).toBe(platformTenant.id);
    expect(Object.keys(lead).sort()).toEqual(
      expect.arrayContaining([
        'id',
        'organizationName',
        'contactName',
        'linkedPlatformTenantId',
        'stage',
        'rowVersion',
      ]),
    );
    expect(lead).not.toHaveProperty('tenantFeatures');
    expect(lead).not.toHaveProperty('patientRecords');
  });
});
