/**
 * Flexible Step 25 — HTTP matrix H01–H24 for /platform/sales/trials.
 * Covers auth class, permission mapping, Cache-Control, and error contracts.
 */
import { type INestApplication, ValidationPipe } from '@nestjs/common';
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
import {
  CLINIC_TOKEN_AUDIENCE,
} from '../../auth/domain/value-objects/jwt-claims.vo';
import { PlatformAuthorizationService } from '../../auth/platform-rbac/platform-authorization.service';
import { PlatformSalesTrialsController } from '../api/platform-sales-trials.controller';
import { TrialAdminService } from '../application/trial-admin.service';
import { TrialConversionService } from '../application/trial-conversion.service';
import { TrialEntitlementPreviewService } from '../application/trial-entitlement-preview.service';
import { createSalesTrialsStack } from './sales-trials-stack';
import {
  assertSafePlatformTestDatabaseUrl,
  cleanupSalesTrialTables,
  clearSalesTrialsFailureInjection,
  createHybridPrisma,
  createPlanVersionFixture,
  createPlatformDbSecurityClient,
  createPlatformRefreshSession,
  createPlatformUserFixture,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  deletePlanVersionFixtures,
  JWT_CFG,
  platformDbSecurityEnabled,
  resolveCatalogKeys,
  SALES_MANAGER_ROLE,
  SALES_REP_ROLE,
  type TrialCatalogKeys,
} from './sales-trials-db.harness';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 25 Trial HTTP matrix (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let app: INestApplication;
  let baseUrl: string;
  let jwtTokens: JwtTokenService;
  let jwtService: JwtService;
  let stack: ReturnType<typeof createSalesTrialsStack>;
  let keys: TrialCatalogKeys;
  let trialPlanVersionId: string;
  let paidPlanVersionId: string;

  beforeAll(async () => {
    assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
    prisma = createPlatformDbSecurityClient();
    jwtService = new JwtService({});
    jwtTokens = new JwtTokenService(jwtService, JWT_CFG);
    keys = await resolveCatalogKeys(prisma);
  });

  afterAll(async () => {
    await app?.close();
    await cleanupSalesTrialTables(prisma);
    await deletePlanVersionFixtures(prisma);
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    clearSalesTrialsFailureInjection();
    process.env.NODE_ENV = 'test';
    await cleanupSalesTrialTables(prisma);
    await deletePlanVersionFixtures(prisma);
    await prisma.platformRefreshToken.deleteMany({});
    await prisma.platformUserRole.deleteMany({});
    await prisma.platformUser.deleteMany({});

    trialPlanVersionId = (
      await createPlanVersionFixture(prisma, {
        moduleKeys: keys.moduleKeys.slice(0, 3),
        specialtyKeys: keys.specialtyKeys.slice(0, 2),
        trialDefaultEnabled: true,
        trialDefaultDays: 14,
      })
    ).planVersionId;
    paidPlanVersionId = (
      await createPlanVersionFixture(prisma, {
        paid: true,
        moduleKeys: keys.moduleKeys.slice(0, 2),
        specialtyKeys: keys.specialtyKeys.slice(0, 3),
      })
    ).planVersionId;

    const wrapped = createHybridPrisma(prisma);
    stack = createSalesTrialsStack(prisma);
    const users = new PrismaPlatformUserRepository(wrapped);
    const authz = new PlatformAuthorizationService(users, wrapped);

    if (app) await app.close();
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' }), JwtModule.register({})],
      controllers: [PlatformSalesTrialsController],
      providers: [
        { provide: TrialAdminService, useValue: stack.trials },
        { provide: TrialConversionService, useValue: stack.conversion },
        { provide: TrialEntitlementPreviewService, useValue: stack.preview },
        { provide: 'JWT_CONFIG', useValue: JWT_CFG },
        { provide: JwtTokenService, useValue: jwtTokens },
        { provide: 'SessionCacheService', useValue: { isJtiBlacklisted: async () => false } },
        {
          provide: JwtStrategy,
          useFactory: () =>
            new JwtStrategy(
              JWT_CFG,
              { isJtiBlacklisted: async () => false } as never,
              jwtTokens,
              jwtService,
              wrapped,
            ),
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
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0);
    const addr = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterEach(async () => {
    await app?.close();
  });

  async function issuePlatformToken(roleKeys: string[] = [SALES_MANAGER_ROLE]) {
    const user = await createPlatformUserFixture(prisma, {
      email: `trial-http-${randomUUID()}@test.local`,
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
    return { status: res.status, json, headers: res.headers };
  }

  function createBody(overrides: Record<string, unknown> = {}) {
    return {
      organizationName: 'HTTP Trial Clinic',
      facilityTypeKey: keys.facilityTypeKey,
      trialPlanVersionId,
      selectedModuleKeys: keys.moduleKeys.slice(0, 3),
      selectedSpecialtyKeys: keys.specialtyKeys.slice(0, 2),
      ...overrides,
    };
  }

  async function createTrialViaHttp(token: string, overrides: Record<string, unknown> = {}) {
    const res = await http('POST', '/platform/sales/trials', {
      token,
      body: createBody(overrides),
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect([200, 201]).toContain(res.status);
    return res.json as { id: string; rowVersion: number; status: string };
  }

  it('H01: unauthenticated list is 401', async () => {
    const res = await http('GET', '/platform/sales/trials');
    expect(res.status).toBe(401);
  });

  it('H02: a clinic-audience token cannot reach the platform Trial API', async () => {
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
    const res = await http('GET', '/platform/sales/trials', { token });
    expect([401, 403]).toContain(res.status);
  });

  it('H03: sales_manager lists Trials', async () => {
    const { accessToken } = await issuePlatformToken();
    const res = await http('GET', '/platform/sales/trials', { token: accessToken });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ total: 0, page: 1 });
  });

  it('H04: every Trial response is Cache-Control private, no-store', async () => {
    const { accessToken } = await issuePlatformToken();
    const trial = await createTrialViaHttp(accessToken);
    const paths = [
      '/platform/sales/trials',
      `/platform/sales/trials/${trial.id}`,
      `/platform/sales/trials/${trial.id}/extensions`,
      `/platform/sales/trials/${trial.id}/history`,
      `/platform/sales/trials/${trial.id}/entitlement-preview?targetPaidPlanVersionId=${paidPlanVersionId}`,
    ];
    for (const path of paths) {
      const res = await http('GET', path, { token: accessToken });
      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe('private, no-store');
    }
  });

  it('H05: create without an Idempotency-Key header is 400', async () => {
    const { accessToken } = await issuePlatformToken();
    const res = await http('POST', '/platform/sales/trials', {
      token: accessToken,
      body: createBody(),
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ code: 'idempotency_required' });
  });

  it('H06: create returns the activated Trial', async () => {
    const { accessToken } = await issuePlatformToken();
    const trial = await createTrialViaHttp(accessToken);
    expect(trial.status).toBe('ACTIVE');
  });

  it('H07: detail read returns the Trial by id', async () => {
    const { accessToken } = await issuePlatformToken();
    const trial = await createTrialViaHttp(accessToken);
    const res = await http('GET', `/platform/sales/trials/${trial.id}`, { token: accessToken });
    expect(res.status).toBe(200);
    expect((res.json as { id: string }).id).toBe(trial.id);
  });

  it('H08: PATCH applies an allowed field with OCC', async () => {
    const { accessToken } = await issuePlatformToken();
    const trial = await createTrialViaHttp(accessToken);
    const res = await http('PATCH', `/platform/sales/trials/${trial.id}`, {
      token: accessToken,
      body: { organizationName: 'HTTP Renamed', expectedRowVersion: trial.rowVersion },
    });
    expect(res.status).toBe(200);
    expect((res.json as { organizationName: string }).organizationName).toBe('HTTP Renamed');
  });

  it('H09: PATCH with a stale rowVersion is 409', async () => {
    const { accessToken } = await issuePlatformToken();
    const trial = await createTrialViaHttp(accessToken);
    const res = await http('PATCH', `/platform/sales/trials/${trial.id}`, {
      token: accessToken,
      body: { organizationName: 'Nope', expectedRowVersion: trial.rowVersion - 1 },
    });
    expect(res.status).toBe(409);
    expect(res.json).toMatchObject({ code: 'row_version_conflict' });
  });

  it('H10: extend requires an Idempotency-Key header', async () => {
    const { accessToken } = await issuePlatformToken();
    const trial = await createTrialViaHttp(accessToken);
    const res = await http('POST', `/platform/sales/trials/${trial.id}/extend`, {
      token: accessToken,
      body: { extensionDays: 5, reason: 'no key', expectedRowVersion: trial.rowVersion },
    });
    expect(res.status).toBe(400);
  });

  it('H11: extend succeeds and returns the moved window', async () => {
    const { accessToken } = await issuePlatformToken();
    const trial = await createTrialViaHttp(accessToken);
    const res = await http('POST', `/platform/sales/trials/${trial.id}/extend`, {
      token: accessToken,
      body: { extensionDays: 5, reason: 'http extension', expectedRowVersion: trial.rowVersion },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect([200, 201]).toContain(res.status);
    expect((res.json as { extensionCount: number }).extensionCount).toBe(1);
  });

  it('H12: extend body validation rejects a missing reason', async () => {
    const { accessToken } = await issuePlatformToken();
    const trial = await createTrialViaHttp(accessToken);
    const res = await http('POST', `/platform/sales/trials/${trial.id}/extend`, {
      token: accessToken,
      body: { extensionDays: 5, expectedRowVersion: trial.rowVersion },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(res.status).toBe(400);
  });

  it('H13: extend body validation rejects an out-of-range window', async () => {
    const { accessToken } = await issuePlatformToken();
    const trial = await createTrialViaHttp(accessToken);
    const res = await http('POST', `/platform/sales/trials/${trial.id}/extend`, {
      token: accessToken,
      body: { extensionDays: 999, reason: 'too long', expectedRowVersion: trial.rowVersion },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(res.status).toBe(400);
  });

  it('H14: entitlement-preview requires targetPaidPlanVersionId', async () => {
    const { accessToken } = await issuePlatformToken();
    const trial = await createTrialViaHttp(accessToken);
    const res = await http('GET', `/platform/sales/trials/${trial.id}/entitlement-preview`, {
      token: accessToken,
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ code: 'plan_version_required' });
  });

  it('H15: entitlement-preview returns the comparison with its disclaimer', async () => {
    const { accessToken } = await issuePlatformToken();
    const trial = await createTrialViaHttp(accessToken);
    const res = await http(
      'GET',
      `/platform/sales/trials/${trial.id}/entitlement-preview?targetPaidPlanVersionId=${paidPlanVersionId}`,
      { token: accessToken },
    );
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({
      runtimeSource: 'STEP16_SNAPSHOT_STEP18_EER',
      disclaimer: { readOnly: true },
    });
  });

  it('H16: convert requires an Idempotency-Key header', async () => {
    const { accessToken } = await issuePlatformToken();
    const trial = await createTrialViaHttp(accessToken);
    const res = await http('POST', `/platform/sales/trials/${trial.id}/convert`, {
      token: accessToken,
      body: {
        targetPaidPlanVersionId: paidPlanVersionId,
        expectedRowVersion: trial.rowVersion,
      },
    });
    expect(res.status).toBe(400);
  });

  it('H17: convert returns the durable conversion record', async () => {
    const { accessToken } = await issuePlatformToken();
    const trial = await createTrialViaHttp(accessToken);
    const res = await http('POST', `/platform/sales/trials/${trial.id}/convert`, {
      token: accessToken,
      body: {
        targetPaidPlanVersionId: paidPlanVersionId,
        expectedRowVersion: trial.rowVersion,
        reason: 'http conversion',
      },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect([200, 201]).toContain(res.status);
    expect(res.json).toMatchObject({ status: 'CONVERTED', replayed: false });
  });

  it('H18: convert rejects an unknown disposition value at the DTO boundary', async () => {
    const { accessToken } = await issuePlatformToken();
    const trial = await createTrialViaHttp(accessToken);
    const res = await http('POST', `/platform/sales/trials/${trial.id}/convert`, {
      token: accessToken,
      body: {
        targetPaidPlanVersionId: paidPlanVersionId,
        expectedRowVersion: trial.rowVersion,
        dispositions: [{ grantKey: 'addon.x', disposition: 'DELETE_EVERYTHING' }],
      },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(res.status).toBe(400);
  });

  it('H19: extensions history endpoint returns the append-only rows', async () => {
    const { accessToken } = await issuePlatformToken();
    const trial = await createTrialViaHttp(accessToken);
    await http('POST', `/platform/sales/trials/${trial.id}/extend`, {
      token: accessToken,
      body: { extensionDays: 4, reason: 'history http', expectedRowVersion: trial.rowVersion },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    const res = await http('GET', `/platform/sales/trials/${trial.id}/extensions`, {
      token: accessToken,
    });
    expect(res.status).toBe(200);
    expect(res.json).toHaveLength(1);
  });

  it('H20: history endpoint returns audits, extensions, and conversion', async () => {
    const { accessToken } = await issuePlatformToken();
    const trial = await createTrialViaHttp(accessToken);
    const res = await http('GET', `/platform/sales/trials/${trial.id}/history`, {
      token: accessToken,
    });
    expect(res.status).toBe(200);
    const body = res.json as { audits: unknown[]; extensions: unknown[]; conversion: unknown };
    expect(body.audits.length).toBeGreaterThanOrEqual(2);
    expect(body.extensions).toEqual([]);
    expect(body.conversion).toBeNull();
  });

  it('H21: a representative without trial.convert is 403 on convert', async () => {
    const manager = await issuePlatformToken([SALES_MANAGER_ROLE]);
    const trial = await createTrialViaHttp(manager.accessToken);
    const rep = await issuePlatformToken([SALES_REP_ROLE]);
    const res = await http('POST', `/platform/sales/trials/${trial.id}/convert`, {
      token: rep.accessToken,
      body: {
        targetPaidPlanVersionId: paidPlanVersionId,
        expectedRowVersion: trial.rowVersion,
      },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(res.status).toBe(403);
  });

  it('H22: unknown Trial id is 404', async () => {
    const { accessToken } = await issuePlatformToken();
    const res = await http('GET', `/platform/sales/trials/${randomUUID()}`, { token: accessToken });
    expect(res.status).toBe(404);
  });

  it('H23: create rejects a malformed Plan Version id at the DTO boundary', async () => {
    const { accessToken } = await issuePlatformToken();
    const res = await http('POST', '/platform/sales/trials', {
      token: accessToken,
      body: createBody({ trialPlanVersionId: 'not-a-uuid' }),
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(res.status).toBe(400);
  });

  it('H24: cancel transitions the Trial to CANCELLED', async () => {
    const { accessToken } = await issuePlatformToken();
    const trial = await createTrialViaHttp(accessToken);
    const res = await http('POST', `/platform/sales/trials/${trial.id}/cancel`, {
      token: accessToken,
      body: { reason: 'customer withdrew', expectedRowVersion: trial.rowVersion },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect([200, 201]).toContain(res.status);
    expect((res.json as { status: string }).status).toBe('CANCELLED');
  });
});
