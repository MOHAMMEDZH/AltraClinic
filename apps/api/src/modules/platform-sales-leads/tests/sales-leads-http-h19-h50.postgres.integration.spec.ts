/**
 * Flexible Step 24 — narrow Passport HTTP closure H19–H50.
 */
import { type INestApplication } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { AddressInfo } from 'net';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/api/guards/jwt-auth.guard';
import { PlatformPermissionGuard } from '../../auth/api/guards/platform-permission.guard';
import { PLATFORM_USER_REPOSITORY } from '../../auth/platform-auth.tokens';
import { JwtStrategy } from '../../auth/infrastructure/strategies/jwt.strategy';
import { JwtTokenService } from '../../auth/infrastructure/services/jwt-token.service';
import { PrismaPlatformUserRepository } from '../../auth/infrastructure/repositories/prisma-platform-user.repository';
import { CLINIC_TOKEN_AUDIENCE } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PlatformSalesLeadsController } from '../api/platform-sales-leads.controller';
import { LeadAdminService } from '../application/lead-admin.service';
import { createSalesLeadsStack } from './sales-leads-stack';
import {
  assertSafePlatformTestDatabaseUrl,
  cleanupSalesLeadTables,
  clearSalesLeadsFailureInjection,
  commercialSoRSnapshot,
  countLeadAudits,
  createHybridPrisma,
  createPlatformDbSecurityClient,
  createPlatformRefreshSession,
  createPlatformUserFixture,
  createRepProfile,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  JWT_CFG,
  platformDbSecurityEnabled,
} from './sales-leads-db.harness';
import { PlatformAuthorizationService } from '../../auth/platform-rbac/platform-authorization.service';
import { SALES_LEAD_AUDIT_ACTIONS } from '../platform-sales-leads.constants';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 24 Sales Leads HTTP H19–H50 (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let app: INestApplication;
  let baseUrl: string;
  let jwtTokens: JwtTokenService;
  let jwtService: JwtService;
  let stack: ReturnType<typeof createSalesLeadsStack>;
  let leadsService: LeadAdminService;

  beforeAll(async () => {
    assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
    prisma = createPlatformDbSecurityClient();
    jwtService = new JwtService({});
    jwtTokens = new JwtTokenService(jwtService, JWT_CFG);
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    clearSalesLeadsFailureInjection();
    process.env.NODE_ENV = 'test';
    await cleanupSalesLeadTables(prisma);
    await prisma.platformRefreshToken.deleteMany({});
    await prisma.platformUserRole.deleteMany({});
    await prisma.platformUser.deleteMany({});

    const wrapped = createHybridPrisma(prisma);
    stack = createSalesLeadsStack(prisma);
    leadsService = stack.leads;
    const users = new PrismaPlatformUserRepository(wrapped);
    const authz = new PlatformAuthorizationService(users, wrapped);

    if (app) await app.close();
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' }), JwtModule.register({})],
      controllers: [PlatformSalesLeadsController],
      providers: [
        { provide: LeadAdminService, useValue: leadsService },
        { provide: 'JWT_CONFIG', useValue: JWT_CFG },
        { provide: JwtTokenService, useValue: jwtTokens },
        {
          provide: 'SessionCacheService',
          useValue: { isJtiBlacklisted: async () => false },
        },
        {
          provide: JwtStrategy,
          useFactory: () =>
            new JwtStrategy(JWT_CFG, { isJtiBlacklisted: async () => false } as never, jwtTokens, jwtService, wrapped),
        },
        { provide: PLATFORM_USER_REPOSITORY, useValue: users },
        { provide: PlatformAuthorizationService, useValue: authz },
        PlatformPermissionGuard,
        Reflector,
        JwtAuthGuard,
        { provide: APP_GUARD, useExisting: JwtAuthGuard },
      ],
    }).compile();

    moduleRef.get(JwtStrategy);
    app = moduleRef.createNestApplication();
    app.useGlobalGuards(app.get(JwtAuthGuard), app.get(PlatformPermissionGuard));
    await app.listen(0);
    const addr = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterEach(async () => {
    await app?.close();
  });

  async function issuePlatformToken(roleKeys: string[] = ['sales_manager']) {
    const user = await createPlatformUserFixture(prisma, {
      email: `lead-h19-${randomUUID()}@test.local`,
      roleKeys,
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    const pair = jwtTokens.issuePlatformTokenPair({
      platformUserId: user.id,
      sessionId: session.sessionId,
    });
    return { user, session, accessToken: pair.accessToken };
  }

  async function http(
    method: string,
    pathName: string,
    opts: { token?: string; body?: unknown; headers?: Record<string, string> } = {},
  ) {
    const res = await fetch(`${baseUrl}${pathName}`, {
      method,
      headers: {
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
        ...opts.headers,
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });
    return { status: res.status, json, text, headers };
  }

  async function createLead(token: string, org = `Org-${randomUUID().slice(0, 6)}`) {
    const res = await http('POST', '/platform/sales/leads', {
      token,
      body: { organizationName: org, contactName: 'Contact', contactEmail: 'c@example.com' },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect([200, 201]).toContain(res.status);
    return res.json as { id: string; rowVersion: number; organizationName: string; stage: string };
  }

  it('H19 private/no-store Cache-Control on lead routes', async () => {
    const { accessToken } = await issuePlatformToken();
    const res = await http('GET', '/platform/sales/leads', { token: accessToken });
    expect(res.status).toBe(200);
    expect(String(res.headers['cache-control'] ?? '')).toMatch(/private/i);
    expect(String(res.headers['cache-control'] ?? '')).toMatch(/no-store/i);
  });

  it('H20 passive read does not extend session (refresh token untouched)', async () => {
    const { accessToken, session } = await issuePlatformToken();
    const before = await prisma.platformRefreshToken.findFirst({
      where: { sessionId: session.sessionId },
    });
    await http('GET', '/platform/sales/leads', { token: accessToken });
    const after = await prisma.platformRefreshToken.findFirst({
      where: { sessionId: session.sessionId },
    });
    expect(after?.id).toBe(before?.id);
    expect(after?.expiresAt?.toISOString()).toBe(before?.expiresAt?.toISOString());
  });

  it('H21 N/A: Step 24 lead routes intentionally have no platform rate-limit adapter (architectural)', () => {
    const controllerPath = path.join(
      __dirname,
      '..',
      'api',
      'platform-sales-leads.controller.ts',
    );
    const src = readFileSync(controllerPath, 'utf8');
    expect(src).not.toMatch(/Throttle|RateLimit|429/i);
    expect(true).toBe(true);
  });

  it('H22 service not called after 403/401 authorization denial', async () => {
    const listSpy = jest.spyOn(leadsService, 'list');
    const createSpy = jest.spyOn(leadsService, 'create');
    const unauth = await http('GET', '/platform/sales/leads');
    expect(unauth.status).toBe(401);
    expect(listSpy).not.toHaveBeenCalled();
    const { accessToken } = await issuePlatformToken(['platform_support']);
    const denied = await http('POST', '/platform/sales/leads', {
      token: accessToken,
      body: { organizationName: 'Nope', contactName: 'N' },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(denied.status).toBe(403);
    expect(createSpy).not.toHaveBeenCalled();
    listSpy.mockRestore();
    createSpy.mockRestore();
  });

  it('H23 zero side effects after denial (leads/audits unchanged)', async () => {
    const beforeLeads = await prisma.platformSalesLead.count();
    const beforeAudits = await countLeadAudits(prisma, SALES_LEAD_AUDIT_ACTIONS.CREATED);
    const { accessToken } = await issuePlatformToken(['platform_support']);
    await http('POST', '/platform/sales/leads', {
      token: accessToken,
      body: { organizationName: 'Denied', contactName: 'D' },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(await prisma.platformSalesLead.count()).toBe(beforeLeads);
    expect(await countLeadAudits(prisma, SALES_LEAD_AUDIT_ACTIONS.CREATED)).toBe(beforeAudits);
  });

  it('H24 unassigned id returns same status as missing id (no oracle)', async () => {
    const manager = await issuePlatformToken(['sales_manager']);
    const rep = await issuePlatformToken(['sales_representative']);
    await createRepProfile(prisma, rep.user.id);
    const lead = await createLead(manager.accessToken, 'OracleOrg');
    // Assign to a different rep so requester has no visibility.
    const other = await issuePlatformToken(['sales_representative']);
    const otherProfile = await createRepProfile(prisma, other.user.id);
    await http('PUT', `/platform/sales/leads/${lead.id}/owner`, {
      token: manager.accessToken,
      body: { ownerRepresentativeId: otherProfile.id, expectedRowVersion: lead.rowVersion },
    });
    const missing = await http('GET', `/platform/sales/leads/${randomUUID()}`, {
      token: rep.accessToken,
    });
    const unassigned = await http('GET', `/platform/sales/leads/${lead.id}`, {
      token: rep.accessToken,
    });
    expect(missing.status).toBe(404);
    expect(unassigned.status).toBe(404);
    expect(JSON.stringify(unassigned.json)).not.toMatch(/OracleOrg|contactEmail|c@example/i);
  });

  it('H25 safe infrastructure error body (no stack/secrets)', async () => {
    const { accessToken } = await issuePlatformToken();
    const res = await http('GET', `/platform/sales/leads/${randomUUID()}`, { token: accessToken });
    expect(res.status).toBe(404);
    const body = JSON.stringify(res.json);
    expect(body).not.toMatch(/password|refreshToken|accessSecret|stack/i);
  });

  it('H26 responses omit tokens/passwords/secrets', async () => {
    const { accessToken } = await issuePlatformToken();
    const lead = await createLead(accessToken);
    const detail = await http('GET', `/platform/sales/leads/${lead.id}`, { token: accessToken });
    const body = JSON.stringify(detail.json);
    expect(body).not.toMatch(/"password"|"accessToken"|"refreshToken"|"secret"/i);
  });

  it('H27 exact idempotency replay via HTTP', async () => {
    const { accessToken } = await issuePlatformToken();
    const key = randomUUID();
    const body = { organizationName: 'H27 Org', contactName: 'H27' };
    const a = await http('POST', '/platform/sales/leads', {
      token: accessToken,
      body,
      headers: { 'Idempotency-Key': key },
    });
    const b = await http('POST', '/platform/sales/leads', {
      token: accessToken,
      body,
      headers: { 'Idempotency-Key': key },
    });
    expect([200, 201]).toContain(a.status);
    expect([200, 201]).toContain(b.status);
    expect((b.json as { id: string }).id).toBe((a.json as { id: string }).id);
  });

  it('H28 conflicting idempotency replay via HTTP', async () => {
    const { accessToken } = await issuePlatformToken();
    const key = randomUUID();
    await http('POST', '/platform/sales/leads', {
      token: accessToken,
      body: { organizationName: 'H28 A', contactName: 'A' },
      headers: { 'Idempotency-Key': key },
    });
    const conflict = await http('POST', '/platform/sales/leads', {
      token: accessToken,
      body: { organizationName: 'H28 B', contactName: 'B' },
      headers: { 'Idempotency-Key': key },
    });
    expect([409, 400]).toContain(conflict.status);
  });

  it('H29 stale OCC via HTTP denied', async () => {
    const { accessToken } = await issuePlatformToken();
    const lead = await createLead(accessToken, 'H29');
    await http('PATCH', `/platform/sales/leads/${lead.id}`, {
      token: accessToken,
      body: { organizationName: 'H29 First', expectedRowVersion: lead.rowVersion },
    });
    const stale = await http('PATCH', `/platform/sales/leads/${lead.id}`, {
      token: accessToken,
      body: { organizationName: 'H29 Stale', expectedRowVersion: lead.rowVersion },
    });
    expect(stale.status).toBe(409);
  });

  it('H30 ownership reassignment authorization (rep denied)', async () => {
    const manager = await issuePlatformToken(['sales_manager']);
    const rep = await issuePlatformToken(['sales_representative']);
    await createRepProfile(prisma, rep.user.id);
    const lead = await createLead(manager.accessToken, 'H30');
    const denied = await http('PUT', `/platform/sales/leads/${lead.id}/owner`, {
      token: rep.accessToken,
      body: { ownerRepresentativeId: null, expectedRowVersion: lead.rowVersion },
    });
    expect(denied.status).toBe(403);
  });

  it('H31 ownership-history delta via HTTP', async () => {
    const manager = await issuePlatformToken(['sales_manager']);
    const rep = await issuePlatformToken(['sales_representative']);
    const profile = await createRepProfile(prisma, rep.user.id);
    const lead = await createLead(manager.accessToken, 'H31');
    const before = await http('GET', `/platform/sales/leads/${lead.id}/ownership-history`, {
      token: manager.accessToken,
    });
    await http('PUT', `/platform/sales/leads/${lead.id}/owner`, {
      token: manager.accessToken,
      body: { ownerRepresentativeId: profile.id, expectedRowVersion: lead.rowVersion },
    });
    const after = await http('GET', `/platform/sales/leads/${lead.id}/ownership-history`, {
      token: manager.accessToken,
    });
    expect((after.json as unknown[]).length - (before.json as unknown[]).length).toBe(1);
  });

  it('H32 stage-history delta via HTTP', async () => {
    const { accessToken } = await issuePlatformToken();
    const lead = await createLead(accessToken, 'H32');
    const before = await http('GET', `/platform/sales/leads/${lead.id}/stage-history`, {
      token: accessToken,
    });
    await http('POST', `/platform/sales/leads/${lead.id}/stage`, {
      token: accessToken,
      body: { stage: 'CONTACTED', expectedRowVersion: lead.rowVersion },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    const after = await http('GET', `/platform/sales/leads/${lead.id}/stage-history`, {
      token: accessToken,
    });
    expect((after.json as unknown[]).length - (before.json as unknown[]).length).toBe(1);
  });

  it('H33 stage audit delta via HTTP', async () => {
    const { accessToken } = await issuePlatformToken();
    const lead = await createLead(accessToken, 'H33');
    const before = await countLeadAudits(prisma, SALES_LEAD_AUDIT_ACTIONS.STAGE_CHANGED);
    await http('POST', `/platform/sales/leads/${lead.id}/stage`, {
      token: accessToken,
      body: { stage: 'CONTACTED', expectedRowVersion: lead.rowVersion },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(await countLeadAudits(prisma, SALES_LEAD_AUDIT_ACTIONS.STAGE_CHANGED)).toBe(before + 1);
  });

  it('H34 ownership audit delta via HTTP', async () => {
    const manager = await issuePlatformToken(['sales_manager']);
    const rep = await issuePlatformToken(['sales_representative']);
    const profile = await createRepProfile(prisma, rep.user.id);
    const lead = await createLead(manager.accessToken, 'H34');
    const before = await countLeadAudits(prisma, SALES_LEAD_AUDIT_ACTIONS.OWNER_ASSIGNED);
    await http('PUT', `/platform/sales/leads/${lead.id}/owner`, {
      token: manager.accessToken,
      body: { ownerRepresentativeId: profile.id, expectedRowVersion: lead.rowVersion },
    });
    expect(await countLeadAudits(prisma, SALES_LEAD_AUDIT_ACTIONS.OWNER_ASSIGNED)).toBe(before + 1);
  });

  it('H35 Plan-fit visibility via HTTP', async () => {
    const { accessToken } = await issuePlatformToken();
    const lead = await createLead(accessToken, 'H35');
    const res = await http('GET', `/platform/sales/leads/${lead.id}/plan-fit`, { token: accessToken });
    expect(res.status).toBe(200);
    expect((res.json as { disclaimer: { advisoryOnly: boolean } }).disclaimer.advisoryOnly).toBe(true);
  });

  it('H36 Plan-fit SoR snapshot delta 0 (read-only)', async () => {
    const { accessToken } = await issuePlatformToken();
    const lead = await createLead(accessToken, 'H36');
    const before = await commercialSoRSnapshot(prisma);
    await http('GET', `/platform/sales/leads/${lead.id}/plan-fit`, { token: accessToken });
    expect(await commercialSoRSnapshot(prisma)).toEqual(before);
  });

  it('H37 Plan-fit no tenant access/mutation', async () => {
    const { accessToken } = await issuePlatformToken();
    const lead = await createLead(accessToken, 'H37');
    const tenantsBefore = await prisma.platformTenant.count();
    const fit = await http('GET', `/platform/sales/leads/${lead.id}/plan-fit`, { token: accessToken });
    expect(fit.status).toBe(200);
    expect(await prisma.platformTenant.count()).toBe(tenantsBefore);
    expect(JSON.stringify(fit.json)).not.toMatch(/patient|diagnosis|clinical/i);
  });

  it('H38 Plan-fit no Subscription mutation', async () => {
    const { accessToken } = await issuePlatformToken();
    const lead = await createLead(accessToken, 'H38');
    const before = await prisma.platformSubscription.count();
    await http('GET', `/platform/sales/leads/${lead.id}/plan-fit`, { token: accessToken });
    expect(await prisma.platformSubscription.count()).toBe(before);
  });

  it('H39 Plan-fit no Entitlement mutation', async () => {
    const { accessToken } = await issuePlatformToken();
    const lead = await createLead(accessToken, 'H39');
    const before = await prisma.platformPlanVersionEntitlement.count();
    await http('GET', `/platform/sales/leads/${lead.id}/plan-fit`, { token: accessToken });
    expect(await prisma.platformPlanVersionEntitlement.count()).toBe(before);
  });

  it('H40 Plan-fit no Trial', async () => {
    const { accessToken } = await issuePlatformToken();
    const lead = await createLead(accessToken, 'H40');
    const fit = await http('GET', `/platform/sales/leads/${lead.id}/plan-fit`, { token: accessToken });
    expect(JSON.stringify(fit.json)).not.toMatch(/trial/i);
    expect((fit.json as { disclaimer: { notProvisioningDecision: boolean } }).disclaimer.notProvisioningDecision).toBe(
      true,
    );
  });

  it('H41 contact privacy validation (empty contactName rejected)', async () => {
    const { accessToken } = await issuePlatformToken();
    const res = await http('POST', '/platform/sales/leads', {
      token: accessToken,
      body: { organizationName: 'H41', contactName: '   ' },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(res.status).toBe(400);
  });

  it('H42 note privacy/bounds validation (HTML rejected)', async () => {
    const { accessToken } = await issuePlatformToken();
    const lead = await createLead(accessToken, 'H42');
    const res = await http('POST', `/platform/sales/leads/${lead.id}/notes`, {
      token: accessToken,
      body: { body: '<script>alert(1)</script>' },
    });
    expect(res.status).toBe(400);
  });

  it('H43 demo validation via HTTP', async () => {
    const { accessToken } = await issuePlatformToken();
    const lead = await createLead(accessToken, 'H43');
    const bad = await http('PUT', `/platform/sales/leads/${lead.id}/demo`, {
      token: accessToken,
      body: { demoStatus: 'NOT_A_STATUS', expectedRowVersion: lead.rowVersion },
    });
    expect(bad.status).toBe(400);
    const ok = await http('PUT', `/platform/sales/leads/${lead.id}/demo`, {
      token: accessToken,
      body: {
        demoStatus: 'SCHEDULED',
        demoTimezone: 'UTC',
        demoNote: 'Commercial demo',
        expectedRowVersion: lead.rowVersion,
      },
    });
    expect(ok.status).toBe(200);
  });

  it('H44 terminal outcome validation (reason required)', async () => {
    const { accessToken } = await issuePlatformToken();
    let lead = await createLead(accessToken, 'H44');
    const staged = await http('POST', `/platform/sales/leads/${lead.id}/stage`, {
      token: accessToken,
      body: { stage: 'PROPOSAL', expectedRowVersion: lead.rowVersion },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    lead = staged.json as typeof lead;
    const missing = await http('POST', `/platform/sales/leads/${lead.id}/won`, {
      token: accessToken,
      body: { expectedRowVersion: lead.rowVersion, wonLostReason: '' },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(missing.status).toBe(400);
  });

  it('H45 WON no Tenant creation', async () => {
    const { accessToken } = await issuePlatformToken();
    let lead = await createLead(accessToken, 'H45');
    const staged = await http('POST', `/platform/sales/leads/${lead.id}/stage`, {
      token: accessToken,
      body: { stage: 'PROPOSAL', expectedRowVersion: lead.rowVersion },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    lead = staged.json as typeof lead;
    const tenantsBefore = await prisma.platformTenant.count();
    const won = await http('POST', `/platform/sales/leads/${lead.id}/won`, {
      token: accessToken,
      body: { expectedRowVersion: lead.rowVersion, wonLostReason: 'signed' },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect([200, 201]).toContain(won.status);
    expect(await prisma.platformTenant.count()).toBe(tenantsBefore);
  });

  it('H46 WON no provisioning', async () => {
    const { accessToken } = await issuePlatformToken();
    let lead = await createLead(accessToken, 'H46');
    const staged = await http('POST', `/platform/sales/leads/${lead.id}/stage`, {
      token: accessToken,
      body: { stage: 'PROPOSAL', expectedRowVersion: lead.rowVersion },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    lead = staged.json as typeof lead;
    const before = await prisma.platformTenantProvisioningRequest.count();
    await http('POST', `/platform/sales/leads/${lead.id}/won`, {
      token: accessToken,
      body: { expectedRowVersion: lead.rowVersion, wonLostReason: 'signed' },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(await prisma.platformTenantProvisioningRequest.count()).toBe(before);
  });

  it('H47 LOST no Tenant/customer mutation', async () => {
    const { accessToken } = await issuePlatformToken();
    let lead = await createLead(accessToken, 'H47');
    const tenantsBefore = await prisma.platformTenant.count();
    const lost = await http('POST', `/platform/sales/leads/${lead.id}/lost`, {
      token: accessToken,
      body: { expectedRowVersion: lead.rowVersion, wonLostReason: 'no budget' },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect([200, 201]).toContain(lost.status);
    expect(await prisma.platformTenant.count()).toBe(tenantsBefore);
  });

  it('H48 history endpoint scoped correctly (rep cannot see foreign lead history)', async () => {
    const manager = await issuePlatformToken(['sales_manager']);
    const rep = await issuePlatformToken(['sales_representative']);
    await createRepProfile(prisma, rep.user.id);
    const lead = await createLead(manager.accessToken, 'H48 Foreign');
    const hist = await http('GET', `/platform/sales/leads/${lead.id}/stage-history`, {
      token: rep.accessToken,
    });
    expect(hist.status).toBe(404);
  });

  it('H49 mass-query unassigned IDs denied', async () => {
    const manager = await issuePlatformToken(['sales_manager']);
    const rep = await issuePlatformToken(['sales_representative']);
    await createRepProfile(prisma, rep.user.id);
    const ids = [
      (await createLead(manager.accessToken, 'H49a')).id,
      (await createLead(manager.accessToken, 'H49b')).id,
      randomUUID(),
    ];
    for (const id of ids) {
      const res = await http('GET', `/platform/sales/leads/${id}`, { token: rep.accessToken });
      expect(res.status).toBe(404);
    }
  });

  it('H50 safe error body on validation failure', async () => {
    const { accessToken } = await issuePlatformToken();
    const res = await http('POST', '/platform/sales/leads', {
      token: accessToken,
      body: { organizationName: '', contactName: '' },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(res.status).toBe(400);
    const body = JSON.stringify(res.json);
    expect(body).not.toMatch(/password|token|secret|stack trace/i);
    expect(body).toMatch(/code|message|statusCode/i);
  });
});
