/**
 * Flexible Step 24 — Passport/JWT HTTP matrix for /platform/sales/leads.
 */
import { type INestApplication } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { AddressInfo } from 'net';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/api/guards/jwt-auth.guard';
import { PlatformPermissionGuard } from '../../auth/api/guards/platform-permission.guard';
import { PLATFORM_USER_REPOSITORY } from '../../auth/platform-auth.tokens';
import { JwtStrategy } from '../../auth/infrastructure/strategies/jwt.strategy';
import { JwtTokenService } from '../../auth/infrastructure/services/jwt-token.service';
import { PrismaPlatformUserRepository } from '../../auth/infrastructure/repositories/prisma-platform-user.repository';
import { CLINIC_TOKEN_AUDIENCE, PLATFORM_TOKEN_AUDIENCE } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PlatformSalesLeadsController } from '../api/platform-sales-leads.controller';
import { LeadAdminService } from '../application/lead-admin.service';
import { createSalesLeadsStack } from './sales-leads-stack';
import {
  assertSafePlatformTestDatabaseUrl,
  cleanupSalesLeadTables,
  clearSalesLeadsFailureInjection,
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

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 24 Sales Leads HTTP matrix (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let app: INestApplication;
  let baseUrl: string;
  let jwtTokens: JwtTokenService;
  let jwtService: JwtService;
  let stack: ReturnType<typeof createSalesLeadsStack>;

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
    const users = new PrismaPlatformUserRepository(wrapped);
    const authz = new PlatformAuthorizationService(users, wrapped);

    if (app) await app.close();
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' }), JwtModule.register({})],
      controllers: [PlatformSalesLeadsController],
      providers: [
        { provide: LeadAdminService, useValue: stack.leads },
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

  async function issuePlatformToken(roleKeys: string[] = ['sales_manager'], opts: { status?: string } = {}) {
    const user = await createPlatformUserFixture(prisma, {
      email: `lead-http-${randomUUID()}@test.local`,
      roleKeys,
      status: opts.status,
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    const pair = jwtTokens.issuePlatformTokenPair({ platformUserId: user.id, sessionId: session.sessionId });
    return { user, session, accessToken: pair.accessToken };
  }

  async function http(
    method: string,
    path: string,
    opts: { token?: string; body?: unknown; headers?: Record<string, string> } = {},
  ) {
    const res = await fetch(`${baseUrl}${path}`, {
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
    return { status: res.status, json, text };
  }

  it('H01: unauthenticated list → 401', async () => {
    const res = await http('GET', '/platform/sales/leads');
    expect(res.status).toBe(401);
  });

  it('H02: clinic token denied', async () => {
    const token = jwtService.sign(
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
    const res = await http('GET', '/platform/sales/leads', { token });
    expect([401, 403]).toContain(res.status);
  });

  it('H03: sales_manager can list', async () => {
    const { accessToken } = await issuePlatformToken(['sales_manager']);
    const res = await http('GET', '/platform/sales/leads', { token: accessToken });
    expect(res.status).toBe(200);
  });

  it('H04: create requires Idempotency-Key', async () => {
    const { accessToken } = await issuePlatformToken(['sales_manager']);
    const res = await http('POST', '/platform/sales/leads', {
      token: accessToken,
      body: { organizationName: 'X', contactName: 'Y' },
    });
    expect(res.status).toBe(400);
  });

  it('H05: create succeeds with Idempotency-Key', async () => {
    const { accessToken } = await issuePlatformToken(['sales_manager']);
    const res = await http('POST', '/platform/sales/leads', {
      token: accessToken,
      body: { organizationName: 'HTTP Org', contactName: 'HTTP' },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect([200, 201]).toContain(res.status);
    expect((res.json as { organizationName: string }).organizationName).toBe('HTTP Org');
  });

  it('H06: get by id', async () => {
    const { accessToken } = await issuePlatformToken(['sales_manager']);
    const created = await http('POST', '/platform/sales/leads', {
      token: accessToken,
      body: { organizationName: 'GetMe', contactName: 'G' },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    const id = (created.json as { id: string }).id;
    const res = await http('GET', `/platform/sales/leads/${id}`, { token: accessToken });
    expect(res.status).toBe(200);
    expect((res.json as { id: string }).id).toBe(id);
  });

  it('H07: patch update with OCC', async () => {
    const { accessToken } = await issuePlatformToken(['sales_manager']);
    const created = await http('POST', '/platform/sales/leads', {
      token: accessToken,
      body: { organizationName: 'PatchMe', contactName: 'P' },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    const lead = created.json as { id: string; rowVersion: number };
    const res = await http('PATCH', `/platform/sales/leads/${lead.id}`, {
      token: accessToken,
      body: { organizationName: 'Patched', expectedRowVersion: lead.rowVersion },
    });
    expect(res.status).toBe(200);
    expect((res.json as { organizationName: string }).organizationName).toBe('Patched');
  });

  it('H08: stage transition via POST', async () => {
    const { accessToken } = await issuePlatformToken(['sales_manager']);
    const created = await http('POST', '/platform/sales/leads', {
      token: accessToken,
      body: { organizationName: 'StageMe', contactName: 'S' },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    const lead = created.json as { id: string; rowVersion: number };
    const res = await http('POST', `/platform/sales/leads/${lead.id}/stage`, {
      token: accessToken,
      body: { stage: 'CONTACTED', expectedRowVersion: lead.rowVersion },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect([200, 201]).toContain(res.status);
    expect((res.json as { stage: string }).stage).toBe('CONTACTED');
  });

  it('H09: notes POST/GET', async () => {
    const { accessToken } = await issuePlatformToken(['sales_manager']);
    const created = await http('POST', '/platform/sales/leads', {
      token: accessToken,
      body: { organizationName: 'NoteMe', contactName: 'N' },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    const id = (created.json as { id: string }).id;
    const post = await http('POST', `/platform/sales/leads/${id}/notes`, {
      token: accessToken,
      body: { body: 'Commercial note only' },
    });
    expect([200, 201]).toContain(post.status);
    const list = await http('GET', `/platform/sales/leads/${id}/notes`, { token: accessToken });
    expect(list.status).toBe(200);
    expect(Array.isArray(list.json)).toBe(true);
    expect((list.json as unknown[]).length).toBe(1);
  });

  it('H10: plan-fit endpoint', async () => {
    const { accessToken } = await issuePlatformToken(['sales_manager']);
    const created = await http('POST', '/platform/sales/leads', {
      token: accessToken,
      body: { organizationName: 'FitMe', contactName: 'F' },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    const id = (created.json as { id: string }).id;
    const res = await http('GET', `/platform/sales/leads/${id}/plan-fit`, { token: accessToken });
    expect(res.status).toBe(200);
    expect((res.json as { disclaimer: { advisoryOnly: boolean } }).disclaimer.advisoryOnly).toBe(true);
  });

  it('H11: assign owner requires assign permission', async () => {
    const manager = await issuePlatformToken(['sales_manager']);
    const rep = await issuePlatformToken(['sales_representative']);
    await createRepProfile(prisma, rep.user.id);
    const created = await http('POST', '/platform/sales/leads', {
      token: manager.accessToken,
      body: { organizationName: 'AssignMe', contactName: 'A' },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    const lead = created.json as { id: string; rowVersion: number };
    const denied = await http('PUT', `/platform/sales/leads/${lead.id}/owner`, {
      token: rep.accessToken,
      body: { ownerRepresentativeId: null, expectedRowVersion: lead.rowVersion },
    });
    expect(denied.status).toBe(403);
  });

  it('H12: sales_representative can create in own scope', async () => {
    const rep = await issuePlatformToken(['sales_representative']);
    await createRepProfile(prisma, rep.user.id);
    const res = await http('POST', '/platform/sales/leads', {
      token: rep.accessToken,
      body: { organizationName: 'RepOwned', contactName: 'R' },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect([200, 201]).toContain(res.status);
  });

  it('H13: suspended platform user denied', async () => {
    const { accessToken } = await issuePlatformToken(['sales_manager'], { status: 'suspended' });
    const res = await http('GET', '/platform/sales/leads', { token: accessToken });
    expect([401, 403]).toContain(res.status);
  });

  it('H14: demo PUT', async () => {
    const { accessToken } = await issuePlatformToken(['sales_manager']);
    const created = await http('POST', '/platform/sales/leads', {
      token: accessToken,
      body: { organizationName: 'DemoMe', contactName: 'D' },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    const lead = created.json as { id: string; rowVersion: number };
    const res = await http('PUT', `/platform/sales/leads/${lead.id}/demo`, {
      token: accessToken,
      body: {
        demoStatus: 'SCHEDULED',
        demoTimezone: 'UTC',
        expectedRowVersion: lead.rowVersion,
      },
    });
    expect(res.status).toBe(200);
    expect((res.json as { demoStatus: string }).demoStatus).toBe('SCHEDULED');
  });

  it('H15: won/lost endpoints', async () => {
    const { accessToken } = await issuePlatformToken(['sales_manager']);
    const created = await http('POST', '/platform/sales/leads', {
      token: accessToken,
      body: { organizationName: 'TermMe', contactName: 'T' },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    let lead = created.json as { id: string; rowVersion: number };
    const staged = await http('POST', `/platform/sales/leads/${lead.id}/stage`, {
      token: accessToken,
      body: { stage: 'PROPOSAL', expectedRowVersion: lead.rowVersion },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    lead = staged.json as { id: string; rowVersion: number };
    const won = await http('POST', `/platform/sales/leads/${lead.id}/won`, {
      token: accessToken,
      body: { expectedRowVersion: lead.rowVersion, wonLostReason: 'signed' },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect([200, 201]).toContain(won.status);
    expect((won.json as { stage: string }).stage).toBe('WON');
  });

  it('H16: stage-history and ownership-history endpoints', async () => {
    const { accessToken } = await issuePlatformToken(['sales_manager']);
    const created = await http('POST', '/platform/sales/leads', {
      token: accessToken,
      body: { organizationName: 'HistMe', contactName: 'H' },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    const id = (created.json as { id: string }).id;
    const stages = await http('GET', `/platform/sales/leads/${id}/stage-history`, {
      token: accessToken,
    });
    const owners = await http('GET', `/platform/sales/leads/${id}/ownership-history`, {
      token: accessToken,
    });
    expect(stages.status).toBe(200);
    expect(owners.status).toBe(200);
  });

  it('H17: missing permission role cannot manage', async () => {
    const { accessToken } = await issuePlatformToken(['platform_support']);
    const res = await http('POST', '/platform/sales/leads', {
      token: accessToken,
      body: { organizationName: 'Nope', contactName: 'N' },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(res.status).toBe(403);
  });

  it('H18: platform audience required', async () => {
    const { accessToken } = await issuePlatformToken(['sales_manager']);
    const decoded = jwtService.decode(accessToken) as { aud?: string };
    expect(decoded.aud).toBe(PLATFORM_TOKEN_AUDIENCE);
  });
});
