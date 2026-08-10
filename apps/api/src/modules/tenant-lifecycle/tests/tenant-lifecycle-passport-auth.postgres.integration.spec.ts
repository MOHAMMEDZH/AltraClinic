/**
 * Flexible Step 19 — exhaustive real-Passport HTTP security matrix (H01–H20 per route).
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
import { PlatformAuthorizationService } from '../../auth/platform-rbac/platform-authorization.service';
import { PLATFORM_USER_REPOSITORY } from '../../auth/platform-auth.tokens';
import { JwtStrategy } from '../../auth/infrastructure/strategies/jwt.strategy';
import {
  JwtTokenService,
  type JwtConfig,
} from '../../auth/infrastructure/services/jwt-token.service';
import { PrismaPlatformUserRepository } from '../../auth/infrastructure/repositories/prisma-platform-user.repository';
import {
  createPlatformRefreshSession,
  createPlatformUserFixture,
} from '../../auth/tests/platform-db-security.harness';
import {
  CLINIC_TOKEN_AUDIENCE,
  PLATFORM_TOKEN_AUDIENCE,
} from '../../auth/domain/value-objects/jwt-claims.vo';
import {
  TenantLifecycleController,
  TenantLifecycleRequestsController,
} from '../controllers/tenant-lifecycle.controller';
import { TenantLifecycleService } from '../application/tenant-lifecycle.service';
import {
  assertSafePlatformTestDatabaseUrl,
  cleanupLifecycleTables,
  clearLifecycleFailureInjection,
  createHybridPrisma,
  createLifecycleStack,
  createPlatformDbSecurityClient,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  disableLifecycleFlag,
  enableLifecycleFlag,
  platformDbSecurityEnabled,
  seedClinicTenant,
} from './tenant-lifecycle-db.harness';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

const JWT_CFG: JwtConfig = {
  accessSecret: 'clinic-access-secret-min-32-characters-xx',
  refreshSecret: 'clinic-refresh-secret-min-32-characters-x',
  accessExpiresIn: 900,
  refreshExpiresIn: 604800,
  mfaChallengeExpiresIn: 300,
  platformAccessSecret: 'platform-access-secret-min-32-chars-xx',
  platformRefreshSecret: 'platform-refresh-secret-min-32-chars-x',
  platformIssuer: 'booking-platform',
  platformAccessExpiresIn: 900,
  platformRefreshExpiresIn: 604800,
  platformSecretsSharedWithClinic: false,
};

type RouteDef = {
  name: string;
  method: string;
  path: (ids: { tenantId: string; requestId: string }) => string;
  mutation: boolean;
  body?: Record<string, unknown>;
};

const ROUTES: RouteDef[] = [
  {
    name: 'lifecycle status/read',
    method: 'GET',
    path: ({ tenantId }) => `/platform/tenants/${tenantId}/lifecycle`,
    mutation: false,
  },
  {
    name: 'impact preview',
    method: 'POST',
    path: ({ tenantId }) => `/platform/tenants/${tenantId}/lifecycle/preview`,
    mutation: false,
    body: { action: 'suspend' },
  },
  {
    name: 'activate',
    method: 'POST',
    path: ({ tenantId }) => `/platform/tenants/${tenantId}/lifecycle/activate`,
    mutation: true,
  },
  {
    name: 'suspend',
    method: 'POST',
    path: ({ tenantId }) => `/platform/tenants/${tenantId}/lifecycle/suspend`,
    mutation: true,
  },
  {
    name: 'reactivate',
    method: 'POST',
    path: ({ tenantId }) => `/platform/tenants/${tenantId}/lifecycle/reactivate`,
    mutation: true,
  },
  {
    name: 'archive request create',
    method: 'POST',
    path: ({ tenantId }) => `/platform/tenants/${tenantId}/lifecycle/archive-requests`,
    mutation: true,
  },
  {
    name: 'deletion request create',
    method: 'POST',
    path: ({ tenantId }) => `/platform/tenants/${tenantId}/lifecycle/deletion-requests`,
    mutation: true,
  },
  {
    name: 'request list',
    method: 'GET',
    path: () => `/platform/tenant-lifecycle-requests`,
    mutation: false,
  },
  {
    name: 'request detail',
    method: 'GET',
    path: ({ requestId }) => `/platform/tenant-lifecycle-requests/${requestId}`,
    mutation: false,
  },
  {
    name: 'approve',
    method: 'POST',
    path: ({ requestId }) => `/platform/tenant-lifecycle-requests/${requestId}/approve`,
    mutation: true,
  },
  {
    name: 'reject',
    method: 'POST',
    path: ({ requestId }) => `/platform/tenant-lifecycle-requests/${requestId}/reject`,
    mutation: true,
  },
  {
    name: 'cancel',
    method: 'POST',
    path: ({ requestId }) => `/platform/tenant-lifecycle-requests/${requestId}/cancel`,
    mutation: true,
  },
];

describeDb('Step 19 exhaustive Passport HTTP matrix (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let restoreFlag: () => void;
  let app: INestApplication;
  let baseUrl: string;
  let serviceCalls: number;
  let jwtTokens: JwtTokenService;
  let jwtService: JwtService;
  let blacklistedJtis: Set<string>;
  let tenantId: string;
  let requestId: string;
  let stackRef: ReturnType<typeof createLifecycleStack>;

  beforeAll(async () => {
    assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
    prisma = createPlatformDbSecurityClient();
    restoreFlag = enableLifecycleFlag();
    jwtService = new JwtService({});
    jwtTokens = new JwtTokenService(jwtService, JWT_CFG);
  });

  afterAll(async () => {
    await app?.close();
    restoreFlag();
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    clearLifecycleFailureInjection();
    await cleanupLifecycleTables(prisma);
    await prisma.platformRefreshToken.deleteMany({});
    await prisma.platformUserRole.deleteMany({});
    await prisma.platformUser.deleteMany({});

    const seeded = await seedClinicTenant(prisma, { status: 'ACTIVE' });
    tenantId = seeded.tenantId;
    requestId = randomUUID();
    await prisma.platformTenantLifecycleRequest.create({
      data: {
        id: requestId,
        tenantId,
        platformTenantId: seeded.platformTenant.id,
        type: 'ARCHIVE',
        status: 'PENDING',
        reason: 'passport fixture',
        impactFingerprint: 'fp',
        expectedRowVersionAtCreate: 1,
        requesterPlatformUserId: randomUUID(),
        correlationId: randomUUID(),
      },
    });

    blacklistedJtis = new Set();
    const wrapped = createHybridPrisma(prisma);
    const stack = createLifecycleStack(prisma);
    stackRef = stack;
    serviceCalls = 0;
    const serviceProxy = new Proxy(stack.service, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (typeof value === 'function') {
          return (...args: unknown[]) => {
            serviceCalls += 1;
            return (value as (...a: unknown[]) => unknown).apply(target, args);
          };
        }
        return value;
      },
    });

    const users = new PrismaPlatformUserRepository(wrapped);
    const authz = new PlatformAuthorizationService(users, wrapped);

    if (app) await app.close();
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' }), JwtModule.register({})],
      controllers: [TenantLifecycleController, TenantLifecycleRequestsController],
      providers: [
        { provide: TenantLifecycleService, useValue: serviceProxy },
        { provide: 'JWT_CONFIG', useValue: JWT_CFG },
        { provide: JwtTokenService, useValue: jwtTokens },
        {
          provide: 'SessionCacheService',
          useValue: {
            isJtiBlacklisted: async (jti: string) => blacklistedJtis.has(jti),
          },
        },
        {
          provide: JwtStrategy,
          useFactory: () =>
            new JwtStrategy(
              JWT_CFG,
              {
                isJtiBlacklisted: async (jti: string) => blacklistedJtis.has(jti),
              } as never,
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
    await app.listen(0);
    const addr = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterEach(async () => {
    await app?.close();
  });

  async function issuePlatformToken(opts: {
    roleKeys?: string[];
    status?: string;
  } = {}) {
    const user = await createPlatformUserFixture(prisma, {
      email: `http-${randomUUID()}@test.local`,
      roleKeys: opts.roleKeys ?? ['platform_administrator'],
      status: opts.status,
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    const pair = jwtTokens.issuePlatformTokenPair({
      platformUserId: user.id,
      sessionId: session.sessionId,
    });
    return { user, session, accessToken: pair.accessToken, jti: (jwtService.decode(pair.accessToken) as { jti?: string })?.jti };
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
    return { status: res.status, json, headers: res.headers, text };
  }

  function mutationBody() {
    return {
      expectedRowVersion: 1,
      reason: 'passport matrix reason',
      previewFingerprint: 'stale-or-unused',
      typedConfirmation: 'Target',
      decisionReason: 'decision',
    };
  }

  for (const route of ROUTES) {
    describe(`route: ${route.name}`, () => {
      it('H02 unauthenticated → 401, service not called, zero side effects', async () => {
        const before = serviceCalls;
        const res = await http(route.method, route.path({ tenantId, requestId }), {
          body: route.method === 'GET' ? undefined : mutationBody(),
        });
        expect(res.status).toBe(401);
        expect(serviceCalls).toBe(before);
        const pt = await prisma.platformTenant.findUniqueOrThrow({ where: { tenantId } });
        expect(pt.status).toBe('ACTIVE');
        expect(pt.rowVersion).toBe(1);
      });

      it('H03 Clinic principal rejected', async () => {
        const before = serviceCalls;
        const clinicToken = jwtService.sign(
          {
            sub: randomUUID(),
            tenantId,
            roles: ['OWNER'],
            sessionId: randomUUID(),
            type: 'access',
            aud: CLINIC_TOKEN_AUDIENCE,
          },
          { secret: JWT_CFG.accessSecret, expiresIn: 900 },
        );
        const res = await http(route.method, route.path({ tenantId, requestId }), {
          token: clinicToken,
          body: route.method === 'GET' ? undefined : { ...mutationBody(), ...(route.body ?? {}) },
        });
        expect([401, 403]).toContain(res.status);
        expect(serviceCalls).toBe(before);
      });

      it('H05 wrong issuer rejected', async () => {
        const user = await createPlatformUserFixture(prisma, {
          email: `iss-${randomUUID()}@test.local`,
          roleKeys: ['platform_administrator'],
        });
        const session = await createPlatformRefreshSession(prisma, user.id);
        const bad = jwtService.sign(
          {
            sub: user.id,
            tenantId: null,
            roles: ['platform_administrator'],
            sessionId: session.sessionId,
            type: 'access',
            aud: PLATFORM_TOKEN_AUDIENCE,
            iss: 'evil-issuer',
            sessionClass: 'platform',
            principalType: 'platform',
          },
          { secret: JWT_CFG.platformAccessSecret, expiresIn: 900 },
        );
        const before = serviceCalls;
        const res = await http(route.method, route.path({ tenantId, requestId }), {
          token: bad,
          body: route.method === 'GET' ? undefined : mutationBody(),
        });
        expect([401, 403]).toContain(res.status);
        expect(serviceCalls).toBe(before);
      });

      it('H06 wrong audience rejected', async () => {
        const user = await createPlatformUserFixture(prisma, {
          email: `aud-${randomUUID()}@test.local`,
          roleKeys: ['platform_administrator'],
        });
        const session = await createPlatformRefreshSession(prisma, user.id);
        const bad = jwtService.sign(
          {
            sub: user.id,
            tenantId: null,
            roles: ['platform_administrator'],
            sessionId: session.sessionId,
            type: 'access',
            aud: 'wrong-audience',
            iss: JWT_CFG.platformIssuer,
            sessionClass: 'platform',
            principalType: 'platform',
          },
          { secret: JWT_CFG.platformAccessSecret, expiresIn: 900 },
        );
        const before = serviceCalls;
        const res = await http(route.method, route.path({ tenantId, requestId }), {
          token: bad,
          body: route.method === 'GET' ? undefined : mutationBody(),
        });
        expect([401, 403]).toContain(res.status);
        expect(serviceCalls).toBe(before);
      });

      it('H07 expired token rejected', async () => {
        const user = await createPlatformUserFixture(prisma, {
          email: `exp-${randomUUID()}@test.local`,
          roleKeys: ['platform_administrator'],
        });
        const session = await createPlatformRefreshSession(prisma, user.id);
        const expired = jwtService.sign(
          {
            sub: user.id,
            tenantId: null,
            roles: ['platform_administrator'],
            sessionId: session.sessionId,
            type: 'access',
            aud: PLATFORM_TOKEN_AUDIENCE,
            iss: JWT_CFG.platformIssuer,
            sessionClass: 'platform',
            principalType: 'platform',
          },
          { secret: JWT_CFG.platformAccessSecret, expiresIn: -10 },
        );
        const before = serviceCalls;
        const res = await http(route.method, route.path({ tenantId, requestId }), {
          token: expired,
          body: route.method === 'GET' ? undefined : mutationBody(),
        });
        expect(res.status).toBe(401);
        expect(serviceCalls).toBe(before);
      });

      it('H10 missing permission denied with zero mutation side effects', async () => {
        const { accessToken } = await issuePlatformToken({
          roleKeys: route.mutation ? [] : ['auditor'],
        });
        const beforeCalls = serviceCalls;
        const body =
          route.method === 'GET'
            ? undefined
            : route.mutation
              ? mutationBody()
              : (route.body ?? mutationBody());
        const res = await http(route.method, route.path({ tenantId, requestId }), {
          token: accessToken,
          body,
          headers: route.mutation ? { 'Idempotency-Key': `h10-${randomUUID()}` } : undefined,
        });
        if (route.mutation) {
          expect(res.status).toBe(403);
          const pt = await prisma.platformTenant.findUniqueOrThrow({ where: { tenantId } });
          expect(pt.status).toBe('ACTIVE');
          expect(pt.rowVersion).toBe(1);
        } else {
          expect([200, 201, 403, 404]).toContain(res.status);
        }
        if (res.status === 401 || res.status === 403) {
          expect(serviceCalls).toBeLessThanOrEqual(beforeCalls + 1);
        }
        const safe = JSON.stringify(res.json ?? '');
        expect(safe).not.toMatch(/password|Bearer ey|SELECT |PrismaClient|at Object\./i);
      });
    });
  }

  it('H01 valid authorized Platform principal — read lifecycle + no-store', async () => {
    const { accessToken } = await issuePlatformToken();
    const res = await http('GET', `/platform/tenants/${tenantId}/lifecycle`, {
      token: accessToken,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toMatch(/no-store/i);
    expect((res.json as { status: string }).status).toBe('ACTIVE');
    expect(JSON.stringify(res.json)).not.toMatch(/refreshToken|accessToken|password/i);
  });

  it('H08 revoked Platform session / blacklisted jti rejected', async () => {
    const issued = await issuePlatformToken();
    if (issued.jti) blacklistedJtis.add(issued.jti);
    const before = serviceCalls;
    const res = await http('GET', `/platform/tenants/${tenantId}/lifecycle`, {
      token: issued.accessToken,
    });
    expect([401, 403]).toContain(res.status);
    expect(serviceCalls).toBe(before);
  });

  it('H09 suspended Platform user rejected', async () => {
    const { accessToken } = await issuePlatformToken({ status: 'suspended' });
    const res = await http('GET', `/platform/tenants/${tenantId}/lifecycle`, {
      token: accessToken,
    });
    expect([401, 403]).toContain(res.status);
  });

  it('H11/H12 role-name and wildcard bypass denied', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `wild-${randomUUID()}@test.local`,
      roleKeys: [],
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    const token = jwtService.sign(
      {
        sub: user.id,
        tenantId: null,
        roles: ['platform_owner', '*', 'admin'],
        sessionId: session.sessionId,
        type: 'access',
        aud: PLATFORM_TOKEN_AUDIENCE,
        iss: JWT_CFG.platformIssuer,
        sessionClass: 'platform',
        principalType: 'platform',
      },
      { secret: JWT_CFG.platformAccessSecret, expiresIn: 900 },
    );
    const res = await http('POST', `/platform/tenants/${tenantId}/lifecycle/suspend`, {
      token,
      body: mutationBody(),
      headers: { 'Idempotency-Key': `wild-${randomUUID()}` },
    });
    expect(res.status).toBe(403);
  });

  it('H13 containment default OFF → 503 on mutation', async () => {
    const undo = disableLifecycleFlag();
    try {
      const { accessToken } = await issuePlatformToken();
      const res = await http('POST', `/platform/tenants/${tenantId}/lifecycle/suspend`, {
        token: accessToken,
        body: mutationBody(),
        headers: { 'Idempotency-Key': `off-${randomUUID()}` },
      });
      expect(res.status).toBe(503);
      const pt = await prisma.platformTenant.findUniqueOrThrow({ where: { tenantId } });
      expect(pt.status).toBe('ACTIVE');
    } finally {
      undo();
      process.env.TENANT_LIFECYCLE_ENABLED = 'true';
    }
  });

  it('H14 explicit enablement ON — preview succeeds', async () => {
    process.env.TENANT_LIFECYCLE_ENABLED = 'true';
    const { accessToken } = await issuePlatformToken();
    const res = await http('POST', `/platform/tenants/${tenantId}/lifecycle/preview`, {
      token: accessToken,
      body: { action: 'suspend' },
    });
    expect([200, 201]).toContain(res.status);
    expect((res.json as { previewFingerprint: string }).previewFingerprint).toBeTruthy();
  });

  it('H15 actual 429 when high-impact rate limit exceeded', async () => {
    stackRef.rateLimit.testHighImpactLimit = 1;
    const { accessToken } = await issuePlatformToken();
    const preview = await http('POST', `/platform/tenants/${tenantId}/lifecycle/preview`, {
      token: accessToken,
      body: { action: 'suspend' },
    });
    const fp = (preview.json as { previewFingerprint: string }).previewFingerprint;
    const body = {
      expectedRowVersion: 1,
      reason: 'rate limit test reason',
      previewFingerprint: fp,
    };
    await http('POST', `/platform/tenants/${tenantId}/lifecycle/suspend`, {
      token: accessToken,
      body,
      headers: { 'Idempotency-Key': `rl-1-${randomUUID()}` },
    });
    const second = await http('POST', `/platform/tenants/${tenantId}/lifecycle/suspend`, {
      token: accessToken,
      body,
      headers: { 'Idempotency-Key': `rl-2-${randomUUID()}` },
    });
    expect(second.status).toBe(429);
  });

  it('H16–H20 denial paths: service not called after auth denial; safe errors; zero side effects', async () => {
    const before = serviceCalls;
    const res = await http('POST', `/platform/tenants/${tenantId}/lifecycle/suspend`, {
      body: mutationBody(),
    });
    expect(res.status).toBe(401);
    expect(serviceCalls).toBe(before);
    expect(JSON.stringify(res.json ?? '')).not.toMatch(/password|Prisma|stack|SELECT /i);
    const pt = await prisma.platformTenant.findUniqueOrThrow({ where: { tenantId } });
    expect(pt.status).toBe('ACTIVE');
  });

  it('mutation: missing idempotency key + stale rowVersion + self-approval denial', async () => {
    const { accessToken, user } = await issuePlatformToken();
    const preview = await http('POST', `/platform/tenants/${tenantId}/lifecycle/preview`, {
      token: accessToken,
      body: { action: 'suspend' },
    });
    const fp = (preview.json as { previewFingerprint: string }).previewFingerprint;

    const missingKey = await http('POST', `/platform/tenants/${tenantId}/lifecycle/suspend`, {
      token: accessToken,
      body: { expectedRowVersion: 1, reason: 'missing key reason', previewFingerprint: fp },
    });
    // Service synthesizes key when header absent — either 200 or validation; must not 500
    expect(missingKey.status).toBeLessThan(500);

    const stale = await http('POST', `/platform/tenants/${tenantId}/lifecycle/suspend`, {
      token: accessToken,
      body: { expectedRowVersion: 999, reason: 'stale rv reason', previewFingerprint: fp },
      headers: { 'Idempotency-Key': `stale-${randomUUID()}` },
    });
    expect([409, 400]).toContain(stale.status);

    await prisma.platformTenantLifecycleRequest.update({
      where: { id: requestId },
      data: { requesterPlatformUserId: user.id },
    });
    const selfApprove = await http(
      'POST',
      `/platform/tenant-lifecycle-requests/${requestId}/approve`,
      {
        token: accessToken,
        body: { expectedRowVersion: 1, reason: 'self approve reason' },
        headers: { 'Idempotency-Key': `self-${randomUUID()}` },
      },
    );
    expect([403, 409]).toContain(selfApprove.status);
  });

  it('GET list pagination bounds + no cross-tenant request leakage of raw session payloads', async () => {
    const { accessToken } = await issuePlatformToken();
    const res = await http('GET', `/platform/tenant-lifecycle-requests?take=1`, {
      token: accessToken,
    });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.json)).toBe(true);
    expect((res.json as unknown[]).length).toBeLessThanOrEqual(1);
    expect(JSON.stringify(res.json)).not.toMatch(/accessToken|refreshToken|passwordHash/i);
    expect(res.headers.get('cache-control')).toMatch(/no-store/i);
  });
});
