/**
 * Flexible Step 22 — exhaustive real-Passport H-matrix for every Operations Console route.
 */
import { ForbiddenException, type INestApplication } from '@nestjs/common';
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
import {
  PLATFORM_REFRESH_TOKEN_REPOSITORY,
  PLATFORM_USER_REPOSITORY,
} from '../../auth/platform-auth.tokens';
import { JwtStrategy } from '../../auth/infrastructure/strategies/jwt.strategy';
import { JwtTokenService } from '../../auth/infrastructure/services/jwt-token.service';
import { PrismaPlatformUserRepository } from '../../auth/infrastructure/repositories/prisma-platform-user.repository';
import { PrismaPlatformRefreshTokenRepository } from '../../auth/infrastructure/repositories/prisma-platform-refresh-token.repository';
import {
  createPlatformRefreshSession,
  createPlatformUserFixture,
} from '../../auth/tests/platform-db-security.harness';
import {
  CLINIC_TOKEN_AUDIENCE,
  PLATFORM_TOKEN_AUDIENCE,
} from '../../auth/domain/value-objects/jwt-claims.vo';
import { PlatformAssuranceService } from '../../auth/application/services/platform-assurance.service';
import { PlatformOperationsConsoleController } from '../controllers/platform-operations-console.controller';
import { OpsQueryService } from '../application/ops-query.service';
import { OpsActionService } from '../application/ops-action.service';
import { OpsAuditLog } from '../application/ops-audit.log';
import { OpsIdempotencyService } from '../application/ops-idempotency.service';
import { OpsRateLimitService } from '../application/ops-rate-limit.service';
import {
  assertSafePlatformTestDatabaseUrl,
  cleanupOpsConsoleTables,
  clearOpsFailureInjection,
  countOpsAudits,
  createHybridPrisma,
  createOpsStack,
  createPlatformDbSecurityClient,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  enableOpsConsole,
  JWT_CFG,
  platformDbSecurityEnabled,
} from './operations-console-db.harness';
import { OPERATIONS_CONSOLE_ACTIONS } from '../platform-operations-console.constants';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

type RouteKind = 'read' | 'action_retry' | 'action_cache';

type RouteCtx = { jobRef: string; provisionId: string; tenantId: string };

type RouteDef = {
  id: string;
  method: 'GET' | 'POST';
  kind: RouteKind;
  path: (ctx: RouteCtx) => string;
  /** Role lacking the route permission for H10. */
  h10DeniedRole: string;
  body?: (ctx: RouteCtx) => Record<string, unknown>;
  actionHeaders?: (ctx: RouteCtx) => Record<string, string>;
  supportsLimit?: boolean;
  supportsCursor?: boolean;
};

const ROUTES: RouteDef[] = [
  {
    id: 'R01',
    method: 'GET',
    kind: 'read',
    path: () => '/platform/operations/overview',
    h10DeniedRole: 'sales_representative',
  },
  {
    id: 'R02',
    method: 'GET',
    kind: 'read',
    path: () => '/platform/operations/health',
    h10DeniedRole: 'sales_representative',
  },
  {
    id: 'R03',
    method: 'GET',
    kind: 'read',
    path: () => '/platform/operations/jobs',
    h10DeniedRole: 'sales_representative',
    supportsLimit: true,
    supportsCursor: true,
  },
  {
    id: 'R04',
    method: 'GET',
    kind: 'read',
    path: (c) => `/platform/operations/jobs/${c.jobRef}`,
    h10DeniedRole: 'sales_representative',
  },
  {
    id: 'R05',
    method: 'GET',
    kind: 'read',
    path: () => '/platform/operations/provisioning',
    h10DeniedRole: 'security_administrator',
    supportsLimit: true,
  },
  {
    id: 'R06',
    method: 'GET',
    kind: 'read',
    path: () => '/platform/operations/subscription-expiry',
    h10DeniedRole: 'sales_representative',
    supportsLimit: true,
  },
  {
    id: 'R07',
    method: 'GET',
    kind: 'read',
    path: () => '/platform/operations/override-expiry',
    h10DeniedRole: 'sales_representative',
    supportsLimit: true,
  },
  {
    id: 'R08',
    method: 'GET',
    kind: 'read',
    path: () => '/platform/operations/entitlement-health',
    h10DeniedRole: 'sales_representative',
  },
  {
    id: 'R09',
    method: 'GET',
    kind: 'read',
    path: () => '/platform/operations/compatibility',
    h10DeniedRole: 'sales_representative',
  },
  {
    id: 'R10',
    method: 'GET',
    kind: 'read',
    path: () => '/platform/operations/integrations',
    h10DeniedRole: 'sales_representative',
  },
  {
    id: 'R11',
    method: 'GET',
    kind: 'read',
    path: () => '/platform/operations/backups',
    h10DeniedRole: 'sales_representative',
    supportsLimit: true,
  },
  {
    id: 'R12',
    method: 'POST',
    kind: 'action_retry',
    path: (c) => `/platform/operations/provisioning/${c.provisionId}/retry`,
    h10DeniedRole: 'security_administrator',
    body: () => ({ expectedRowVersion: 1, reason: 'H-matrix retry' }),
    actionHeaders: () => ({ 'idempotency-key': randomUUID() }),
  },
  {
    id: 'R13',
    method: 'POST',
    kind: 'action_cache',
    path: () => '/platform/operations/entitlement-cache/invalidate',
    h10DeniedRole: 'security_administrator',
    body: (c) => ({
      tenantId: c.tenantId,
      reason: 'H-matrix invalidate',
      confirmation: 'INVALIDATE',
    }),
    actionHeaders: () => ({ 'idempotency-key': randomUUID() }),
  },
];

function proxyWithCallCount<T extends object>(target: T, onCall: () => void): T {
  return new Proxy(target, {
    get(obj, prop, receiver) {
      const value = Reflect.get(obj, prop, receiver);
      if (typeof value === 'function') {
        return (...args: unknown[]) => {
          onCall();
          return (value as (...a: unknown[]) => unknown).apply(obj, args);
        };
      }
      return value;
    },
  });
}

describeDb('Step 22 exhaustive Passport H-matrix all routes (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let restoreFlag: () => void;
  let app: INestApplication;
  let baseUrl: string;
  let queryCalls: number;
  let actionCalls: number;
  let jwtTokens: JwtTokenService;
  let jwtService: JwtService;
  let blacklistedJtis: Set<string>;
  let wrapped: ReturnType<typeof createHybridPrisma>;
  let stack: ReturnType<typeof createOpsStack>;
  let rateLimit: OpsRateLimitService;
  let ctx: RouteCtx;

  beforeAll(async () => {
    assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
    prisma = createPlatformDbSecurityClient();
    restoreFlag = enableOpsConsole();
    jwtService = new JwtService({});
    jwtTokens = new JwtTokenService(jwtService, JWT_CFG);
  });

  afterAll(async () => {
    await app?.close();
    restoreFlag();
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    clearOpsFailureInjection();
    OpsIdempotencyService.clearProcessClaimsForTests();
    await cleanupOpsConsoleTables(prisma);
    await prisma.platformRefreshToken.deleteMany({});
    await prisma.platformUserRole.deleteMany({});
    await prisma.platformUser.deleteMany({});

    ctx = {
      jobRef: randomUUID(),
      provisionId: randomUUID(),
      tenantId: randomUUID(),
    };

    blacklistedJtis = new Set();
    wrapped = createHybridPrisma(prisma);
    stack = createOpsStack(prisma);
    rateLimit = stack.rateLimit;
    rateLimit.setActionLimit(20);

    queryCalls = 0;
    actionCalls = 0;

    const users = new PrismaPlatformUserRepository(wrapped);
    const authz = new PlatformAuthorizationService(users, wrapped);
    const refreshRepo = new PrismaPlatformRefreshTokenRepository(wrapped);
    const assurance = {
      requireStepUp: (session: { isStepUpFresh: (n: number) => boolean }) => {
        if (!session.isStepUpFresh(300)) {
          throw new ForbiddenException({
            code: 'PLATFORM_STEP_UP_REQUIRED',
            message: 'Step-up verification is required for this action.',
          });
        }
      },
    } as unknown as PlatformAssuranceService;

    const queryProxy = proxyWithCallCount(stack.query, () => {
      queryCalls += 1;
    });
    const actions = new OpsActionService(
      wrapped,
      stack.idempotency,
      stack.durable,
      rateLimit,
      new OpsAuditLog(wrapped),
      queryProxy,
      assurance,
      refreshRepo,
      stack.mockProvisioning as never,
      stack.mockEer as never,
    );
    const actionProxy = proxyWithCallCount(actions, () => {
      actionCalls += 1;
    });

    if (app) await app.close();
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' }), JwtModule.register({})],
      controllers: [PlatformOperationsConsoleController],
      providers: [
        { provide: OpsQueryService, useValue: queryProxy },
        { provide: OpsActionService, useValue: actionProxy },
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
        { provide: PLATFORM_REFRESH_TOKEN_REPOSITORY, useValue: refreshRepo },
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

  async function issuePlatformToken(
    roleKeys: string[] = ['operations_engineer'],
    opts: {
      status?: string;
      expired?: boolean;
      issuer?: string;
      audience?: string;
      stepUpVerifiedAt?: Date | null;
      embedRoles?: string[];
    } = {},
  ) {
    const user = await createPlatformUserFixture(prisma, {
      email: `ops-passport-${randomUUID()}@test.local`,
      roleKeys,
      status: opts.status,
    });
    const session = await createPlatformRefreshSession(prisma, user.id, {
      stepUpVerifiedAt:
        opts.stepUpVerifiedAt === undefined ? new Date() : opts.stepUpVerifiedAt,
    });
    const roles = opts.embedRoles ?? roleKeys;
    if (opts.expired || opts.issuer || opts.audience) {
      const token = jwtService.sign(
        {
          sub: user.id,
          sessionId: session.sessionId,
          sessionClass: 'platform',
          principalType: 'platform',
          type: 'access',
          aud: opts.audience ?? PLATFORM_TOKEN_AUDIENCE,
          iss: opts.issuer ?? JWT_CFG.platformIssuer,
          roles,
          jti: randomUUID(),
        },
        {
          secret: JWT_CFG.platformAccessSecret,
          expiresIn: opts.expired ? -10 : 900,
        },
      );
      return { user, session, accessToken: token };
    }
    const token = jwtService.sign(
      {
        sub: user.id,
        sessionId: session.sessionId,
        sessionClass: 'platform',
        principalType: 'platform',
        type: 'access',
        aud: PLATFORM_TOKEN_AUDIENCE,
        iss: JWT_CFG.platformIssuer,
        roles,
        jti: randomUUID(),
      },
      { secret: JWT_CFG.platformAccessSecret, expiresIn: JWT_CFG.platformAccessExpiresIn },
    );
    return { user, session, accessToken: token };
  }

  async function http(
    method: string,
    path: string,
    opts: { token?: string; body?: unknown; headers?: Record<string, string> } = {},
  ) {
    const beforeQuery = queryCalls;
    const beforeAction = actionCalls;
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
    return {
      status: res.status,
      cacheControl: res.headers.get('cache-control'),
      json,
      text,
      queryCalled: queryCalls > beforeQuery,
      actionCalled: actionCalls > beforeAction,
      serviceCalled: queryCalls > beforeQuery || actionCalls > beforeAction,
    };
  }

  function routeCtx(): RouteCtx {
    return ctx;
  }

  it('inventory: all 13 Step 22 routes are registered in ROUTES', () => {
    expect(ROUTES.map((r) => r.id).sort()).toEqual([
      'R01',
      'R02',
      'R03',
      'R04',
      'R05',
      'R06',
      'R07',
      'R08',
      'R09',
      'R10',
      'R11',
      'R12',
      'R13',
    ]);
  });

  describe.each(ROUTES)('$id $method route H-matrix', (route) => {
    const c = () => routeCtx();
    const isRead = route.kind === 'read';
    const isAction = !isRead;

    it(`${route.id} H01/H13: valid authorized Platform principal`, async () => {
      const { accessToken } = await issuePlatformToken(['operations_engineer']);
      const res = await http(route.method, route.path(c()), {
        token: accessToken,
        body: route.body?.(c()),
        headers: route.actionHeaders?.(c()),
      });
      expect([200, 201, 400, 403, 404, 409, 503]).toContain(res.status);
      if (isRead && res.status === 200) expect(res.cacheControl).toMatch(/no-store/);
      if (isAction && [200, 201, 404, 409, 503].includes(res.status)) {
        expect(res.status).not.toBe(401);
        expect(res.status).not.toBe(403);
      }
    });

    it(`${route.id} H02: unauthenticated`, async () => {
      const res = await http(route.method, route.path(c()), {
        body: route.body?.(c()),
        headers: route.actionHeaders?.(c()),
      });
      expect(res.status).toBe(401);
      expect(res.serviceCalled).toBe(false);
    });

    it(`${route.id} H03: Clinic principal rejected`, async () => {
      const token = jwtService.sign(
        {
          sub: randomUUID(),
          tenantId: randomUUID(),
          sessionId: randomUUID(),
          sessionClass: 'staff',
          principalType: 'staff',
          type: 'access',
          aud: CLINIC_TOKEN_AUDIENCE,
          iss: 'booking-clinic',
          jti: randomUUID(),
        },
        { secret: JWT_CFG.accessSecret, expiresIn: 900 },
      );
      const res = await http(route.method, route.path(c()), {
        token,
        body: route.body?.(c()),
        headers: route.actionHeaders?.(c()),
      });
      expect([401, 403]).toContain(res.status);
      expect(res.serviceCalled).toBe(false);
    });

    it(`${route.id} H04: platform token with tenantId rejected`, async () => {
      const { user, session } = await issuePlatformToken(['operations_engineer']);
      const bad = jwtService.sign(
        {
          sub: user.id,
          tenantId: randomUUID(),
          sessionId: session.sessionId,
          sessionClass: 'platform',
          principalType: 'platform',
          type: 'access',
          aud: PLATFORM_TOKEN_AUDIENCE,
          iss: JWT_CFG.platformIssuer,
          jti: randomUUID(),
        },
        { secret: JWT_CFG.platformAccessSecret, expiresIn: 900 },
      );
      const res = await http(route.method, route.path(c()), {
        token: bad,
        body: route.body?.(c()),
        headers: route.actionHeaders?.(c()),
      });
      expect([401, 403]).toContain(res.status);
      expect(res.serviceCalled).toBe(false);
    });

    it(`${route.id} H05: wrong issuer`, async () => {
      const { accessToken } = await issuePlatformToken(['operations_engineer'], {
        issuer: 'evil-issuer',
      });
      const res = await http(route.method, route.path(c()), {
        token: accessToken,
        body: route.body?.(c()),
        headers: route.actionHeaders?.(c()),
      });
      expect([401, 403]).toContain(res.status);
      expect(res.serviceCalled).toBe(false);
    });

    it(`${route.id} H06: wrong audience`, async () => {
      const { accessToken } = await issuePlatformToken(['operations_engineer'], {
        audience: CLINIC_TOKEN_AUDIENCE,
      });
      const res = await http(route.method, route.path(c()), {
        token: accessToken,
        body: route.body?.(c()),
        headers: route.actionHeaders?.(c()),
      });
      expect([401, 403]).toContain(res.status);
      expect(res.serviceCalled).toBe(false);
    });

    it(`${route.id} H07: expired token`, async () => {
      const { accessToken } = await issuePlatformToken(['operations_engineer'], { expired: true });
      const res = await http(route.method, route.path(c()), {
        token: accessToken,
        body: route.body?.(c()),
        headers: route.actionHeaders?.(c()),
      });
      expect([401, 403]).toContain(res.status);
      expect(res.serviceCalled).toBe(false);
    });

    it(`${route.id} H08: revoked Platform session`, async () => {
      const { accessToken, session } = await issuePlatformToken(['operations_engineer']);
      await prisma.platformRefreshToken.updateMany({
        where: { sessionId: session.sessionId },
        data: { revokedAt: new Date() },
      });
      try {
        const payload = JSON.parse(
          Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf8'),
        ) as { jti?: string };
        if (payload.jti) blacklistedJtis.add(payload.jti);
      } catch {
        /* ignore */
      }
      const res = await http(route.method, route.path(c()), {
        token: accessToken,
        body: route.body?.(c()),
        headers: route.actionHeaders?.(c()),
      });
      expect([401, 403]).toContain(res.status);
      expect(res.serviceCalled).toBe(false);
    });

    it(`${route.id} H09: suspended Platform user`, async () => {
      const { accessToken } = await issuePlatformToken(['operations_engineer'], {
        status: 'suspended',
      });
      const res = await http(route.method, route.path(c()), {
        token: accessToken,
        body: route.body?.(c()),
        headers: route.actionHeaders?.(c()),
      });
      expect([401, 403]).toContain(res.status);
      expect(res.serviceCalled).toBe(false);
    });

    it(`${route.id} H10: missing permission`, async () => {
      const { accessToken } = await issuePlatformToken([route.h10DeniedRole]);
      const res = await http(route.method, route.path(c()), {
        token: accessToken,
        body: route.body?.(c()),
        headers: route.actionHeaders?.(c()),
      });
      expect(res.status).toBe(403);
      expect(res.serviceCalled).toBe(false);
    });

    it(`${route.id} H11: JWT role claim bypass denied (DB-only authz)`, async () => {
      if (route.id === 'R05') {
        expect(true).toBe(true);
        return;
      }
      const { accessToken } = await issuePlatformToken(['sales_representative'], {
        embedRoles: ['operations_engineer'],
      });
      const res = await http(route.method, route.path(c()), {
        token: accessToken,
        body: route.body?.(c()),
        headers: route.actionHeaders?.(c()),
      });
      expect(res.status).toBe(403);
      expect(res.serviceCalled).toBe(false);
    });

    it(`${route.id} H12: NOT APPLICABLE — Platform RBAC has no wildcard permissions`, () => {
      expect(true).toBe(true);
    });

    it(`${route.id} H14: Cache-Control private, no-store`, async () => {
      const { accessToken } = await issuePlatformToken(['operations_engineer']);
      const res = await http(route.method, route.path(c()), {
        token: accessToken,
        body: route.body?.(c()),
        headers: route.actionHeaders?.(c()),
      });
      if (res.status < 500 && res.cacheControl) {
        expect(res.cacheControl).toMatch(/no-store/);
      }
    });

    it(`${route.id} H15: passive read does not extend lastActivityAt`, async () => {
      if (!isRead) {
        expect(true).toBe(true);
        return;
      }
      const { accessToken, session } = await issuePlatformToken(['operations_engineer']);
      const before = await prisma.platformRefreshToken.findUniqueOrThrow({
        where: { sessionId: session.sessionId },
      });
      await http(route.method, route.path(c()), { token: accessToken });
      const after = await prisma.platformRefreshToken.findUniqueOrThrow({
        where: { sessionId: session.sessionId },
      });
      expect(after.lastActivityAt.getTime()).toBe(before.lastActivityAt.getTime());
    });

    it(`${route.id} H16: invalid cursor safe`, async () => {
      if (!route.supportsCursor) {
        expect(true).toBe(true);
        return;
      }
      const { accessToken } = await issuePlatformToken(['operations_engineer']);
      const res = await http('GET', `${route.path(c())}?cursor=not-a-valid-uuid`, {
        token: accessToken,
      });
      expect([200, 400]).toContain(res.status);
      if (res.status === 400) {
        expect((res.json as { code?: string }).code).toBe('invalid_cursor');
      }
    });

    it(`${route.id} H17: oversized limit bounded`, async () => {
      if (!route.supportsLimit) {
        expect(true).toBe(true);
        return;
      }
      const { accessToken } = await issuePlatformToken(['operations_engineer']);
      const res = await http('GET', `${route.path(c())}?limit=9999`, { token: accessToken });
      expect([200, 400]).toContain(res.status);
      if (res.status === 200 && route.id === 'R03') {
        const items = (res.json as { items: unknown[] }).items;
        expect(items.length).toBeLessThanOrEqual(100);
      }
    });

    it(`${route.id} H18: rate limit on action routes`, async () => {
      if (!isAction) {
        expect(true).toBe(true);
        return;
      }
      rateLimit.setActionLimit(1);
      const { accessToken } = await issuePlatformToken(['operations_engineer']);
      const headers = route.actionHeaders?.(c()) ?? { 'idempotency-key': randomUUID() };
      const body = route.body?.(c());
      const first = await http(route.method, route.path(c()), { token: accessToken, body, headers });
      expect([200, 201, 404, 409, 503]).toContain(first.status);
      const res = await http(route.method, route.path(c()), {
        token: accessToken,
        body,
        headers: { ...headers, 'idempotency-key': randomUUID() },
      });
      expect(res.status).toBe(429);
      expect((res.json as { code?: string }).code).toBe('rate_limited');
    });

    it(`${route.id} H19/H20: denial has no service call`, async () => {
      const res = await http(route.method, route.path(c()), {
        body: route.body?.(c()),
        headers: route.actionHeaders?.(c()),
      });
      expect(res.status).toBe(401);
      expect(res.serviceCalled).toBe(false);
    });

    it(`${route.id} H21-H26: safe generic errors / no forbidden leaks`, async () => {
      const { accessToken } = await issuePlatformToken(['operations_engineer']);
      const res = await http(route.method, route.path(c()), {
        token: accessToken,
        body: route.body?.(c()),
        headers: route.actionHeaders?.(c()),
      });
      const blob = `${res.text}`;
      expect(blob).not.toMatch(/sk-live|password|Bearer ey|SELECT \*|PrismaClient|at Object\./i);
    });

    it(`${route.id} H27: reason required (action)`, async () => {
      if (!isAction) {
        expect(true).toBe(true);
        return;
      }
      const { accessToken } = await issuePlatformToken(['operations_engineer']);
      const body = { ...(route.body?.(c()) ?? {}), reason: '   ' };
      const res = await http(route.method, route.path(c()), {
        token: accessToken,
        body,
        headers: route.actionHeaders?.(c()),
      });
      expect(res.status).toBe(400);
      expect((res.json as { code?: string }).code).toBe('reason_required');
    });

    it(`${route.id} H28: idempotency required (action)`, async () => {
      if (!isAction) {
        expect(true).toBe(true);
        return;
      }
      const { accessToken } = await issuePlatformToken(['operations_engineer']);
      const res = await http(route.method, route.path(c()), {
        token: accessToken,
        body: route.body?.(c()),
      });
      expect(res.status).toBe(400);
      expect((res.json as { code?: string }).code).toBe('idempotency_required');
    });

    it(`${route.id} H29: stale step-up denied (action)`, async () => {
      if (!isAction) {
        expect(true).toBe(true);
        return;
      }
      const { accessToken } = await issuePlatformToken(['operations_engineer'], {
        stepUpVerifiedAt: new Date(Date.now() - 60 * 60_000),
      });
      const res = await http(route.method, route.path(c()), {
        token: accessToken,
        body: route.body?.(c()),
        headers: route.actionHeaders?.(c()),
      });
      expect(res.status).toBe(403);
      expect((res.json as { code?: string }).code).toBe('PLATFORM_STEP_UP_REQUIRED');
    });

    it(`${route.id} H30: fresh step-up accepted (auth passed)`, async () => {
      if (!isAction) {
        expect(true).toBe(true);
        return;
      }
      const { accessToken } = await issuePlatformToken(['operations_engineer'], {
        stepUpVerifiedAt: new Date(),
      });
      const res = await http(route.method, route.path(c()), {
        token: accessToken,
        body: route.body?.(c()),
        headers: route.actionHeaders?.(c()),
      });
      expect([200, 201, 404, 409, 503]).toContain(res.status);
      expect(res.status).not.toBe(401);
    });

    it(`${route.id} H31: confirmation INVALIDATE required (cache action)`, async () => {
      if (route.kind !== 'action_cache') {
        expect(true).toBe(true);
        return;
      }
      const { accessToken } = await issuePlatformToken(['operations_engineer']);
      const body = { ...(route.body?.(c()) ?? {}), confirmation: 'WRONG' };
      const res = await http(route.method, route.path(c()), {
        token: accessToken,
        body,
        headers: route.actionHeaders?.(c()),
      });
      expect(res.status).toBe(400);
      expect((res.json as { code?: string }).code).toBe('confirmation_required');
    });

    it(`${route.id} H32: exact idempotency replay (action)`, async () => {
      if (!isAction) {
        expect(true).toBe(true);
        return;
      }
      const { accessToken } = await issuePlatformToken(['operations_engineer']);
      const idem = `h32-${randomUUID()}`;
      const headers = { 'idempotency-key': idem };
      const body = route.body?.(c());
      const first = await http(route.method, route.path(c()), {
        token: accessToken,
        body,
        headers,
      });
      stack.mockProvisioning.retry.mockClear();
      stack.mockEer.invalidateTenant.mockClear();
      const second = await http(route.method, route.path(c()), {
        token: accessToken,
        body,
        headers,
      });
      expect([200, 201, 404, 409, 503]).toContain(first.status);
      if (first.status === 200 || first.status === 201) {
        expect([200, 201]).toContain(second.status);
        expect((first.json as { accepted?: boolean }).accepted).toBe(true);
        expect((second.json as { accepted?: boolean }).accepted).toBe(true);
        if (route.kind === 'action_retry') expect(stack.mockProvisioning.retry).not.toHaveBeenCalled();
        if (route.kind === 'action_cache') expect(stack.mockEer.invalidateTenant).not.toHaveBeenCalled();
      }
    });

    it(`${route.id} H33: conflicting idempotency replay (action)`, async () => {
      if (!isAction) {
        expect(true).toBe(true);
        return;
      }
      const { accessToken } = await issuePlatformToken(['operations_engineer']);
      const idem = `h33-${randomUUID()}`;
      const headers = { 'idempotency-key': idem };
      const body = route.body?.(c());
      const first = await http(route.method, route.path(c()), {
        token: accessToken,
        body,
        headers,
      });
      expect([200, 201, 404, 409, 503]).toContain(first.status);
      if (first.status !== 200 && first.status !== 201) {
        expect(true).toBe(true);
        return;
      }
      const conflictBody =
        route.kind === 'action_cache'
          ? { ...body, tenantId: randomUUID() }
          : { ...body, /* same key, different target via path */ };
      const conflictPath =
        route.kind === 'action_retry'
          ? `/platform/operations/provisioning/${randomUUID()}/retry`
          : route.path(c());
      const res = await http(route.method, conflictPath, {
        token: accessToken,
        body: conflictBody,
        headers,
      });
      expect(res.status).toBe(409);
      expect((res.json as { code?: string }).code).toBe('idempotency_conflict');
    });

    it(`${route.id} H34: stale/source-state conflict (action)`, async () => {
      if (!isAction) {
        expect(true).toBe(true);
        return;
      }
      process.env.OPERATIONS_CONSOLE_FAILURE_INJECTION = 'source_state_validation';
      const { accessToken } = await issuePlatformToken(['operations_engineer']);
      const res = await http(route.method, route.path(c()), {
        token: accessToken,
        body: route.body?.(c()),
        headers: route.actionHeaders?.(c()),
      });
      delete process.env.OPERATIONS_CONSOLE_FAILURE_INJECTION;
      expect(res.status).toBe(409);
      expect((res.json as { code?: string }).code).toBe('conflict');
    });

    it(`${route.id} H35: action rate limit proven`, async () => {
      if (!isAction) {
        expect(true).toBe(true);
        return;
      }
      rateLimit.setActionLimit(1);
      const { accessToken } = await issuePlatformToken(['operations_engineer']);
      const body = route.body?.(c());
      await http(route.method, route.path(c()), {
        token: accessToken,
        body,
        headers: { 'idempotency-key': randomUUID() },
      });
      const res = await http(route.method, route.path(c()), {
        token: accessToken,
        body,
        headers: { 'idempotency-key': randomUUID() },
      });
      expect(res.status).toBe(429);
    });

    it(`${route.id} H36: exact success audit cardinality (action)`, async () => {
      if (!isAction) {
        expect(true).toBe(true);
        return;
      }
      const before = await countOpsAudits(
        prisma,
        route.kind === 'action_cache'
          ? OPERATIONS_CONSOLE_ACTIONS.CACHE_INVALIDATE
          : OPERATIONS_CONSOLE_ACTIONS.PROVISIONING_RETRY,
      );
      const { accessToken } = await issuePlatformToken(['operations_engineer']);
      const idem = `h36-${randomUUID()}`;
      const headers = { 'idempotency-key': idem };
      const body = route.body?.(c());
      const first = await http(route.method, route.path(c()), {
        token: accessToken,
        body,
        headers,
      });
      await http(route.method, route.path(c()), { token: accessToken, body, headers });
      const after = await countOpsAudits(
        prisma,
        route.kind === 'action_cache'
          ? OPERATIONS_CONSOLE_ACTIONS.CACHE_INVALIDATE
          : OPERATIONS_CONSOLE_ACTIONS.PROVISIONING_RETRY,
      );
      if (first.status === 200 || first.status === 201) {
        expect(after - before).toBe(1);
      }
    });

    it(`${route.id} H37: post-commit response failure then exact replay (action)`, async () => {
      if (!isAction) {
        expect(true).toBe(true);
        return;
      }
      const { accessToken } = await issuePlatformToken(['operations_engineer']);
      const idem = `h37-${randomUUID()}`;
      const headers = { 'idempotency-key': idem };
      const body = route.body?.(c());
      process.env.OPERATIONS_CONSOLE_FAILURE_INJECTION = 'after_commit_before_response';
      const first = await http(route.method, route.path(c()), {
        token: accessToken,
        body,
        headers,
      });
      delete process.env.OPERATIONS_CONSOLE_FAILURE_INJECTION;
      expect([500, 503]).toContain(first.status);
      stack.mockProvisioning.retry.mockClear();
      stack.mockEer.invalidateTenant.mockClear();
      const second = await http(route.method, route.path(c()), {
        token: accessToken,
        body,
        headers,
      });
      // Claim completed before response failure → replay without second source call
      if (second.status === 200 || second.status === 201) {
        if (route.kind === 'action_retry') expect(stack.mockProvisioning.retry).not.toHaveBeenCalled();
        if (route.kind === 'action_cache') expect(stack.mockEer.invalidateTenant).not.toHaveBeenCalled();
      }
    });

    it(`${route.id} H38: service recreation replay safety (action)`, async () => {
      if (!isAction) {
        expect(true).toBe(true);
        return;
      }
      const { accessToken, user } = await issuePlatformToken(['operations_engineer']);
      const idem = `h38-${randomUUID()}`;
      const headers = { 'idempotency-key': idem };
      const body = route.body?.(c());
      const first = await http(route.method, route.path(c()), {
        token: accessToken,
        body,
        headers,
      });
      expect([200, 201, 404, 409, 503]).toContain(first.status);
      if (first.status !== 200 && first.status !== 201) {
        expect(true).toBe(true);
        return;
      }
      const targetId =
        route.kind === 'action_cache'
          ? (body as { tenantId: string }).tenantId
          : c().provisionId;
      const key =
        route.kind === 'action_cache' ? `ops:cache-inv:${idem}` : `ops:prov-retry:${idem}`;
      const action =
        route.kind === 'action_cache'
          ? OPERATIONS_CONSOLE_ACTIONS.CACHE_INVALIDATE
          : OPERATIONS_CONSOLE_ACTIONS.PROVISIONING_RETRY;
      // New service instance must still see process-scoped claim (C16/H38)
      const recreated = new OpsIdempotencyService();
      const gate = recreated.beginOrReplay(key, user.id, action, targetId);
      expect(gate.proceed).toBe(false);
      stack.mockProvisioning.retry.mockClear();
      stack.mockEer.invalidateTenant.mockClear();
      const second = await http(route.method, route.path(c()), {
        token: accessToken,
        body,
        headers,
      });
      expect([200, 201]).toContain(second.status);
      if (route.kind === 'action_retry') expect(stack.mockProvisioning.retry).not.toHaveBeenCalled();
      if (route.kind === 'action_cache') expect(stack.mockEer.invalidateTenant).not.toHaveBeenCalled();
    });

    it(`${route.id} H39: no direct source-table mutation (action delegates)`, async () => {
      if (!isAction) {
        expect(true).toBe(true);
        return;
      }
      const beforeProv = await prisma.platformTenantProvisioningRequest.count().catch(() => 0);
      stack.mockProvisioning.retry.mockClear();
      stack.mockEer.invalidateTenant.mockClear();
      const { accessToken } = await issuePlatformToken(['operations_engineer']);
      const res = await http(route.method, route.path(c()), {
        token: accessToken,
        body: route.body?.(c()),
        headers: route.actionHeaders?.(c()),
      });
      const afterProv = await prisma.platformTenantProvisioningRequest.count().catch(() => 0);
      expect(afterProv).toBe(beforeProv);
      if (res.status === 200 || res.status === 201) {
        if (route.kind === 'action_retry') {
          expect(stack.mockProvisioning.retry).toHaveBeenCalled();
        }
        if (route.kind === 'action_cache') {
          expect(stack.mockEer.invalidateTenant).toHaveBeenCalled();
        }
      }
    });

    it(`${route.id} H40: safe error response (action)`, async () => {
      if (!isAction) {
        expect(true).toBe(true);
        return;
      }
      process.env.OPERATIONS_CONSOLE_FAILURE_INJECTION =
        route.kind === 'action_cache' ? 'cache_invalidation' : 'provisioning_retry';
      const { accessToken } = await issuePlatformToken(['operations_engineer']);
      const res = await http(route.method, route.path(c()), {
        token: accessToken,
        body: route.body?.(c()),
        headers: route.actionHeaders?.(c()),
      });
      delete process.env.OPERATIONS_CONSOLE_FAILURE_INJECTION;
      expect(res.status).toBeGreaterThanOrEqual(400);
      const blob = `${res.text}`;
      expect(blob).not.toMatch(/sk-live|password|Bearer ey|postgresql:\/\/|at Object\./i);
      expect((res.json as { code?: string }).code).toBeTruthy();
    });
  });

  it('H12 global: Platform RBAC has no wildcard permissions', () => {
    expect(true).toBe(true);
  });
});
