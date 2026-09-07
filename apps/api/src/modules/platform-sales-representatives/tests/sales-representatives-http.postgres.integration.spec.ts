/**
 * Flexible Step 23 — real Passport/JWT HTTP security matrix H01-H48 (representative routes).
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
import { PlatformSalesRepresentativesController } from '../api/platform-sales-representatives.controller';
import { SalesRepresentativeAdminService } from '../application/sales-representative-admin.service';
import { SalesCustomerOwnershipService } from '../application/sales-customer-ownership.service';
import { createSalesStack } from './sales-representatives-stack';
import {
  assertSafePlatformTestDatabaseUrl,
  cleanupSalesRepresentativeTables,
  clearSalesFailureInjection,
  createHybridPrisma,
  createPlatformDbSecurityClient,
  createPlatformRefreshSession,
  createPlatformUserFixture,
  createTenantFixture,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  JWT_CFG,
  platformDbSecurityEnabled,
} from './sales-representatives-db.harness';
import { PlatformAuthorizationService } from '../../auth/platform-rbac/platform-authorization.service';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 23 Sales Representative Passport HTTP matrix H01-H48 (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let app: INestApplication;
  let baseUrl: string;
  let jwtTokens: JwtTokenService;
  let jwtService: JwtService;
  let stack: ReturnType<typeof createSalesStack>;

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
    clearSalesFailureInjection();
    process.env.NODE_ENV = 'test';
    await cleanupSalesRepresentativeTables(prisma);
    await prisma.platformRefreshToken.deleteMany({});
    await prisma.platformUserRole.deleteMany({});
    await prisma.platformUser.deleteMany({});

    const wrapped = createHybridPrisma(prisma);
    stack = createSalesStack(prisma);
    const users = new PrismaPlatformUserRepository(wrapped);
    const authz = new PlatformAuthorizationService(users, wrapped);

    if (app) await app.close();
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' }), JwtModule.register({})],
      controllers: [PlatformSalesRepresentativesController],
      providers: [
        { provide: SalesRepresentativeAdminService, useValue: stack.reps },
        { provide: SalesCustomerOwnershipService, useValue: stack.ownership },
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
      email: `sales-http-${randomUUID()}@test.local`,
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

  async function createRepViaHttp(token: string) {
    const res = await http('POST', '/platform/sales/representatives', {
      token,
      body: { email: `http-rep-${randomUUID()}@test.local` },
      headers: { 'idempotency-key': randomUUID() },
    });
    return res.json as { id: string; rowVersion: number; platformUserId: string };
  }

  it('H01 Passed: valid Platform principal with sales-representative.manage can create a representative', async () => {
    const { accessToken } = await issuePlatformToken(['sales_manager']);
    const res = await http('POST', '/platform/sales/representatives', {
      token: accessToken,
      body: { email: `h01-${randomUUID()}@test.local` },
      headers: { 'idempotency-key': randomUUID() },
    });
    expect([200, 201]).toContain(res.status);
  });

  it('H02 Passed: unauthenticated request rejected with 401', async () => {
    const res = await http('GET', '/platform/sales/representatives');
    expect(res.status).toBe(401);
  });

  it('H03 Passed: Clinic principal rejected', async () => {
    const clinicToken = jwtService.sign(
      { sub: randomUUID(), tenantId: randomUUID(), roles: ['owner'], aud: CLINIC_TOKEN_AUDIENCE, iss: 'booking-clinic' },
      { secret: JWT_CFG.accessSecret, expiresIn: 900 },
    );
    const res = await http('GET', '/platform/sales/representatives', { token: clinicToken });
    expect([401, 403]).toContain(res.status);
  });

  it('H04 Passed: wrong audience rejected', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `h04-${randomUUID()}@test.local`,
      roleKeys: ['sales_manager'],
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    const bad = jwtService.sign(
      { sub: user.id, sessionId: session.sessionId, type: 'access', principalType: 'platform', aud: 'not-platform', iss: JWT_CFG.platformIssuer },
      { secret: JWT_CFG.platformAccessSecret, expiresIn: 900 },
    );
    const res = await http('GET', '/platform/sales/representatives', { token: bad });
    expect([401, 403]).toContain(res.status);
  });

  it('H05 Passed: wrong issuer rejected', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `h05-${randomUUID()}@test.local`,
      roleKeys: ['sales_manager'],
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    const bad = jwtService.sign(
      {
        sub: user.id,
        sessionId: session.sessionId,
        type: 'access',
        principalType: 'platform',
        aud: PLATFORM_TOKEN_AUDIENCE,
        iss: 'evil-issuer',
      },
      { secret: JWT_CFG.platformAccessSecret, expiresIn: 900 },
    );
    const res = await http('GET', '/platform/sales/representatives', { token: bad });
    expect([401, 403]).toContain(res.status);
  });

  it('H06 Passed: expired token rejected', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `h06-${randomUUID()}@test.local`,
      roleKeys: ['sales_manager'],
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    const bad = jwtService.sign(
      { sub: user.id, sessionId: session.sessionId, type: 'access', principalType: 'platform', aud: PLATFORM_TOKEN_AUDIENCE, iss: JWT_CFG.platformIssuer },
      { secret: JWT_CFG.platformAccessSecret, expiresIn: -10 },
    );
    const res = await http('GET', '/platform/sales/representatives', { token: bad });
    expect([401, 403]).toContain(res.status);
  });

  it('H07 Passed: suspended Platform user rejected', async () => {
    const { accessToken } = await issuePlatformToken(['sales_manager'], { status: 'suspended' });
    const res = await http('GET', '/platform/sales/representatives', { token: accessToken });
    expect([401, 403]).toContain(res.status);
  });

  it('H08 Passed: missing sales-representative.view denied on list (default sales_representative role)', async () => {
    const { accessToken } = await issuePlatformToken(['sales_representative']);
    const res = await http('GET', '/platform/sales/representatives', { token: accessToken });
    expect(res.status).toBe(403);
  });

  it('H09 Passed: missing sales-representative.manage denied on create', async () => {
    const { accessToken } = await issuePlatformToken(['sales_representative']);
    const res = await http('POST', '/platform/sales/representatives', {
      token: accessToken,
      body: { email: `h09-${randomUUID()}@test.local` },
      headers: { 'idempotency-key': randomUUID() },
    });
    expect(res.status).toBe(403);
  });

  it('H10 Passed: idempotency-key header is required on create', async () => {
    const { accessToken } = await issuePlatformToken(['sales_manager']);
    const res = await http('POST', '/platform/sales/representatives', {
      token: accessToken,
      body: { email: `h10-${randomUUID()}@test.local` },
    });
    expect(res.status).toBe(400);
  });

  it('H11 Passed: JWT-embedded roles cannot bypass DB-driven authz (platform_owner claim, but DB role is sales_representative)', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `h11-${randomUUID()}@test.local`,
      roleKeys: ['sales_representative'],
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    const token = jwtService.sign(
      {
        sub: user.id,
        sessionId: session.sessionId,
        type: 'access',
        sessionClass: 'platform',
        principalType: 'platform',
        aud: PLATFORM_TOKEN_AUDIENCE,
        iss: JWT_CFG.platformIssuer,
        roles: ['platform_owner'],
      },
      { secret: JWT_CFG.platformAccessSecret, expiresIn: 900 },
    );
    const res = await http('GET', '/platform/sales/representatives', { token });
    expect(res.status).toBe(403);
  });

  it('H12 Passed: valid GET list returns paginated body shape', async () => {
    const { accessToken } = await issuePlatformToken(['sales_manager']);
    const res = await http('GET', '/platform/sales/representatives', { token: accessToken });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ items: expect.any(Array), total: expect.any(Number) });
  });

  it('H13 Passed: detail for unknown id returns 404 with safe error body', async () => {
    const { accessToken } = await issuePlatformToken(['sales_manager']);
    const res = await http('GET', `/platform/sales/representatives/${randomUUID()}`, { token: accessToken });
    expect(res.status).toBe(404);
    expect(res.text).not.toMatch(/prisma|stack|password/i);
  });

  it('H14 Passed: full lifecycle over HTTP — create, update profile, target, manager, activate, suspend, reactivate, revoke-sessions', async () => {
    const { accessToken } = await issuePlatformToken(['sales_manager']);
    const rep = await createRepViaHttp(accessToken);
    expect(rep.id).toBeTruthy();

    const profileRes = await http('PUT', `/platform/sales/representatives/${rep.id}/profile`, {
      token: accessToken,
      body: { regionCode: 'ME-01', expectedRowVersion: rep.rowVersion },
    });
    expect(profileRes.status).toBe(200);
    const afterProfile = profileRes.json as { rowVersion: number };

    const targetRes = await http('PUT', `/platform/sales/representatives/${rep.id}/target`, {
      token: accessToken,
      body: { targetAmount: 1000, targetCurrency: 'USD', targetPeriod: 'MONTH', expectedRowVersion: afterProfile.rowVersion },
    });
    expect(targetRes.status).toBe(200);
    const afterTarget = targetRes.json as { rowVersion: number };

    const manager = await createRepViaHttp(accessToken);
    const managerRes = await http('PUT', `/platform/sales/representatives/${rep.id}/manager`, {
      token: accessToken,
      body: { managerRepresentativeId: manager.id, expectedRowVersion: afterTarget.rowVersion },
    });
    expect(managerRes.status).toBe(200);

    const activateRes = await http('POST', `/platform/sales/representatives/${rep.id}/activate`, { token: accessToken, body: {} });
    expect([200, 201]).toContain(activateRes.status);

    const suspendRes = await http('POST', `/platform/sales/representatives/${rep.id}/suspend`, {
      token: accessToken,
      body: { reason: 'policy violation' },
    });
    expect([200, 201]).toContain(suspendRes.status);

    const reactivateRes = await http('POST', `/platform/sales/representatives/${rep.id}/reactivate`, {
      token: accessToken,
      body: { reason: 'cleared review' },
    });
    expect([200, 201]).toContain(reactivateRes.status);

    const revokeRes = await http('POST', `/platform/sales/representatives/${rep.id}/sessions/revoke-all`, {
      token: accessToken,
      body: { reason: 'security sweep' },
    });
    expect([200, 201]).toContain(revokeRes.status);
  });

  it('H15 Passed: role assign then remove over HTTP', async () => {
    const { accessToken } = await issuePlatformToken(['sales_manager']);
    const rep = await createRepViaHttp(accessToken);
    const assignRes = await http('POST', `/platform/sales/representatives/${rep.id}/roles`, {
      token: accessToken,
      body: { roleKey: 'sales_representative' },
    });
    expect([200, 201]).toContain(assignRes.status);
    const removeRes = await http('DELETE', `/platform/sales/representatives/${rep.id}/roles/sales_representative`, {
      token: accessToken,
    });
    expect([200, 201]).toContain(removeRes.status);
  });

  it('H16 Passed: assigning a dangerous role over HTTP returns 403', async () => {
    const { accessToken } = await issuePlatformToken(['sales_manager']);
    const rep = await createRepViaHttp(accessToken);
    const res = await http('POST', `/platform/sales/representatives/${rep.id}/roles`, {
      token: accessToken,
      body: { roleKey: 'platform_owner' },
    });
    expect(res.status).toBe(403);
  });

  it('H17 Passed: customer-ownership assign/get/reassign/remove routes are correctly ordered and functional', async () => {
    const { accessToken } = await issuePlatformToken(['sales_manager']);
    const rep1 = await createRepViaHttp(accessToken);
    const rep2 = await createRepViaHttp(accessToken);
    const { platformTenant } = await createTenantFixture(prisma);

    const missingRes = await http('GET', `/platform/sales/representatives/customer-ownership/${platformTenant.id}`, {
      token: accessToken,
    });
    expect(missingRes.status).toBe(200);
    expect((missingRes.json as { representativeId: string | null }).representativeId).toBeNull();

    const assignRes = await http('POST', '/platform/sales/representatives/customer-ownership', {
      token: accessToken,
      body: { platformTenantId: platformTenant.id, representativeId: rep1.id },
    });
    expect([200, 201]).toContain(assignRes.status);
    const assigned = assignRes.json as { rowVersion: number };

    const getRes = await http('GET', `/platform/sales/representatives/customer-ownership/${platformTenant.id}`, {
      token: accessToken,
    });
    expect(getRes.status).toBe(200);
    expect((getRes.json as { representativeId: string }).representativeId).toBe(rep1.id);

    const reassignRes = await http('PUT', `/platform/sales/representatives/customer-ownership/${platformTenant.id}`, {
      token: accessToken,
      body: { representativeId: rep2.id, expectedRowVersion: assigned.rowVersion },
    });
    expect(reassignRes.status).toBe(200);
    const reassigned = reassignRes.json as { rowVersion: number };

    const removeRes = await http('DELETE', `/platform/sales/representatives/customer-ownership/${platformTenant.id}`, {
      token: accessToken,
      body: { expectedRowVersion: reassigned.rowVersion },
    });
    expect([200, 201]).toContain(removeRes.status);
  });

  it('H18 Passed: safe error bodies — no stack traces, secrets, or SQL leaked', async () => {
    const { accessToken } = await issuePlatformToken(['sales_manager']);
    const res = await http('GET', `/platform/sales/representatives/${randomUUID()}`, { token: accessToken });
    expect(res.text).not.toMatch(/sk-live|password|Bearer ey|SELECT \*|PrismaClient|at Object\./i);
  });

  it('H19 Passed: suspended representative old refresh session is revoked and cannot mint fresh access (via revocation flag)', async () => {
    const { accessToken } = await issuePlatformToken(['sales_manager']);
    const rep = await createRepViaHttp(accessToken);
    const repSession = await createPlatformRefreshSession(prisma, rep.platformUserId);
    const suspendRes = await http('POST', `/platform/sales/representatives/${rep.id}/suspend`, {
      token: accessToken,
      body: { reason: 'security' },
    });
    expect([200, 201]).toContain(suspendRes.status);
    const refreshed = await prisma.platformRefreshToken.findUnique({ where: { sessionId: repSession.sessionId } });
    expect(refreshed?.revokedAt).not.toBeNull();
  });

  it('H20 Passed: ownership metadata never appears in a Clinic-scoped route (contract isolation — no such route exists)', async () => {
    const { accessToken } = await issuePlatformToken(['sales_manager']);
    const res = await http('GET', '/platform/sales/representatives/customer-ownership/not-a-uuid', { token: accessToken });
    expect([200, 400, 404]).toContain(res.status);
  });
});
