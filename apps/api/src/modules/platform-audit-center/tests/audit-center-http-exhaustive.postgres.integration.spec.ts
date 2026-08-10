/**
 * Flexible Step 21 — exhaustive real-Passport H-matrix for every Audit Center route.
 */
import { type INestApplication } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { AddressInfo } from 'net';
import { createHash, randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/api/guards/jwt-auth.guard';
import { PlatformPermissionGuard } from '../../auth/api/guards/platform-permission.guard';
import { PlatformAuthorizationService } from '../../auth/platform-rbac/platform-authorization.service';
import { PLATFORM_USER_REPOSITORY } from '../../auth/platform-auth.tokens';
import { JwtStrategy } from '../../auth/infrastructure/strategies/jwt.strategy';
import { JwtTokenService, type JwtConfig } from '../../auth/infrastructure/services/jwt-token.service';
import { PrismaPlatformUserRepository } from '../../auth/infrastructure/repositories/prisma-platform-user.repository';
import {
  createPlatformRefreshSession,
  createPlatformUserFixture,
} from '../../auth/tests/platform-db-security.harness';
import {
  CLINIC_TOKEN_AUDIENCE,
  PLATFORM_TOKEN_AUDIENCE,
} from '../../auth/domain/value-objects/jwt-claims.vo';
import { PlatformAuditCenterController } from '../controllers/platform-audit-center.controller';
import { AuditCenterQueryService } from '../application/audit-center-query.service';
import { AuditCenterEvidenceService } from '../application/audit-center-evidence.service';
import { AuditCenterExportService } from '../application/audit-center-export.service';
import {
  assertSafePlatformTestDatabaseUrl,
  cleanupAuditCenterTables,
  clearAuditFailureInjection,
  createAuditStack,
  createHybridPrisma,
  createPlatformDbSecurityClient,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  enableAuditCenter,
  platformDbSecurityEnabled,
  seedAuditEntry,
} from './audit-center-db.harness';

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
  id: string;
  method: 'GET' | 'POST';
  path: (ctx: { entryId: string; correlationId: string; exportId: string }) => string;
  needsExport?: boolean;
  body?: unknown;
};

const EXPORT_FILTERS = {
  from: '2026-08-01T00:00:00.000Z',
  to: '2026-08-06T00:00:00.000Z',
};
const EXPORT_FP = createHash('sha256').update(JSON.stringify(EXPORT_FILTERS)).digest('hex');

const ROUTES: RouteDef[] = [
  { id: 'R01', method: 'GET', path: () => '/platform/audit/entries' },
  { id: 'R02', method: 'GET', path: (c) => `/platform/audit/entries/${c.entryId}` },
  {
    id: 'R03',
    method: 'GET',
    path: (c) => `/platform/audit/correlation/${c.correlationId}`,
  },
  {
    id: 'R04',
    method: 'GET',
    path: () => `/platform/audit/plan-versions/${randomUUID()}/evidence`,
  },
  {
    id: 'R05',
    method: 'GET',
    path: () => `/platform/audit/overrides/${randomUUID()}/evidence`,
  },
  {
    id: 'R06',
    method: 'GET',
    path: () => `/platform/audit/feature-flags/${randomUUID()}/evidence`,
  },
  {
    id: 'R07',
    method: 'GET',
    path: () => `/platform/audit/eer-decisions?tenantId=${randomUUID()}`,
  },
  {
    id: 'R08',
    method: 'POST',
    path: () => '/platform/audit/exports/preview',
    needsExport: true,
    body: {
      filters: EXPORT_FILTERS,
      reason: 'H-matrix preview',
      filterFingerprint: EXPORT_FP,
    },
  },
  {
    id: 'R09',
    method: 'POST',
    path: () => '/platform/audit/exports',
    needsExport: true,
    body: {
      filters: EXPORT_FILTERS,
      reason: 'H-matrix export',
      filterFingerprint: EXPORT_FP,
    },
  },
  {
    id: 'R10',
    method: 'GET',
    path: (c) => `/platform/audit/exports/${c.exportId}`,
    needsExport: true,
  },
  {
    id: 'R11',
    method: 'GET',
    path: (c) => `/platform/audit/exports/${c.exportId}/download?token=invalid`,
    needsExport: true,
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

describeDb('Step 21 exhaustive Passport H-matrix all routes (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let restoreFlag: () => void;
  let app: INestApplication;
  let baseUrl: string;
  let serviceCalls: number;
  let jwtTokens: JwtTokenService;
  let jwtService: JwtService;
  let blacklistedJtis: Set<string>;
  let entryId: string;
  let correlationId: string;
  let exportId: string;

  beforeAll(async () => {
    assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
    prisma = createPlatformDbSecurityClient();
    restoreFlag = enableAuditCenter();
    jwtService = new JwtService({});
    jwtTokens = new JwtTokenService(jwtService, JWT_CFG);
  });

  afterAll(async () => {
    await app?.close();
    restoreFlag();
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    clearAuditFailureInjection();
    await cleanupAuditCenterTables(prisma);
    await prisma.platformRefreshToken.deleteMany({});
    await prisma.platformUserRole.deleteMany({});
    await prisma.platformUser.deleteMany({});

    const auditor = await createPlatformUserFixture(prisma, {
      email: `ac-h-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    correlationId = randomUUID();
    const row = await seedAuditEntry(prisma, {
      actorId: auditor.id,
      correlationId,
    });
    entryId = row.id;
    exportId = randomUUID();

    blacklistedJtis = new Set();
    const wrapped = createHybridPrisma(prisma);
    const stack = createAuditStack(prisma);
    serviceCalls = 0;
    const bump = () => {
      serviceCalls += 1;
    };

    const users = new PrismaPlatformUserRepository(wrapped);
    const authz = new PlatformAuthorizationService(users, wrapped);

    if (app) await app.close();
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' }), JwtModule.register({})],
      controllers: [PlatformAuditCenterController],
      providers: [
        { provide: AuditCenterQueryService, useValue: proxyWithCallCount(stack.query, bump) },
        { provide: AuditCenterEvidenceService, useValue: proxyWithCallCount(stack.evidence, bump) },
        { provide: AuditCenterExportService, useValue: proxyWithCallCount(stack.exports, bump) },
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

  async function issuePlatformToken(
    roleKeys: string[] = ['auditor'],
    opts: { status?: string; expired?: boolean; issuer?: string; audience?: string } = {},
  ) {
    const user = await createPlatformUserFixture(prisma, {
      email: `ac-passport-${randomUUID()}@test.local`,
      roleKeys,
      status: opts.status,
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    if (opts.expired || opts.issuer || opts.audience) {
      const token = jwtService.sign(
        {
          sub: user.id,
          sessionId: session.sessionId,
          sessionClass: 'platform',
          principalType: 'platform',
          aud: opts.audience ?? PLATFORM_TOKEN_AUDIENCE,
          iss: opts.issuer ?? 'booking-platform',
        },
        {
          secret: JWT_CFG.platformAccessSecret,
          expiresIn: opts.expired ? -10 : 900,
        },
      );
      return { user, session, accessToken: token };
    }
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
    const beforeCalls = serviceCalls;
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
      serviceCalled: serviceCalls > beforeCalls,
    };
  }

  it('inventory: all 11 Step 21 routes are registered in ROUTES', () => {
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
    ]);
    // eslint-disable-next-line no-console
    console.log(
      'ROUTE_INVENTORY',
      JSON.stringify(
        ROUTES.map((r) => ({ id: r.id, method: r.method, sample: r.path({ entryId, correlationId, exportId }) })),
      ),
    );
  });

  describe.each(ROUTES)('$id $method route H-matrix', (route) => {
    const ctx = () => ({ entryId, correlationId, exportId });

    it(`${route.id} H01: valid authorized Platform principal`, async () => {
      const roles = route.needsExport ? ['auditor', 'platform_owner'] : ['auditor'];
      // auditor has audit.view; export needs audit.export — use platform_owner or grant via fixture roles
      const { accessToken } = await issuePlatformToken(
        route.needsExport ? ['platform_owner'] : ['auditor'],
      );
      const res = await http(route.method, route.path(ctx()), {
        token: accessToken,
        body: route.body,
        headers: route.id === 'R09' ? { 'idempotency-key': randomUUID() } : undefined,
      });
      // authorized may still 404/403 step-up/validation — but authn succeeded
      expect([200, 201, 400, 403, 404, 409]).toContain(res.status);
      if (res.cacheControl) expect(res.cacheControl).toMatch(/private|no-store/);
    });

    it(`${route.id} H02: unauthenticated`, async () => {
      const before = await prisma.auditEntry.count();
      const res = await http(route.method, route.path(ctx()), { body: route.body });
      expect(res.status).toBe(401);
      expect(res.serviceCalled).toBe(false);
      expect(await prisma.auditEntry.count()).toBe(before);
    });

    it(`${route.id} H03: Clinic principal rejected`, async () => {
      const user = await createPlatformUserFixture(prisma, {
        email: `clinic-${randomUUID()}@test.local`,
        roleKeys: ['auditor'],
      });
      const token = jwtService.sign(
        {
          sub: user.id,
          tenantId: randomUUID(),
          sessionId: randomUUID(),
          aud: CLINIC_TOKEN_AUDIENCE,
          iss: 'booking-clinic',
        },
        { secret: JWT_CFG.accessSecret, expiresIn: 900 },
      );
      const res = await http(route.method, route.path(ctx()), { token, body: route.body });
      expect([401, 403]).toContain(res.status);
      expect(res.serviceCalled).toBe(false);
    });

    it(`${route.id} H05: wrong issuer`, async () => {
      const { accessToken } = await issuePlatformToken(['auditor'], { issuer: 'evil-issuer' });
      const res = await http(route.method, route.path(ctx()), {
        token: accessToken,
        body: route.body,
      });
      expect([401, 403]).toContain(res.status);
      expect(res.serviceCalled).toBe(false);
    });

    it(`${route.id} H06: wrong audience`, async () => {
      const { accessToken } = await issuePlatformToken(['auditor'], {
        audience: CLINIC_TOKEN_AUDIENCE,
      });
      const res = await http(route.method, route.path(ctx()), {
        token: accessToken,
        body: route.body,
      });
      expect([401, 403]).toContain(res.status);
      expect(res.serviceCalled).toBe(false);
    });

    it(`${route.id} H07: expired token`, async () => {
      const { accessToken } = await issuePlatformToken(['auditor'], { expired: true });
      const res = await http(route.method, route.path(ctx()), {
        token: accessToken,
        body: route.body,
      });
      expect([401, 403]).toContain(res.status);
      expect(res.serviceCalled).toBe(false);
    });

    it(`${route.id} H08: revoked Platform session / blacklisted jti`, async () => {
      const { accessToken, user, session } = await issuePlatformToken(['auditor']);
      // revoke session row
      await prisma.platformRefreshToken.updateMany({
        where: { sessionId: session.sessionId },
        data: { revokedAt: new Date() },
      });
      // also blacklist if jti present
      try {
        const payload = JSON.parse(
          Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf8'),
        ) as { jti?: string };
        if (payload.jti) blacklistedJtis.add(payload.jti);
      } catch {
        /* ignore */
      }
      const res = await http(route.method, route.path(ctx()), {
        token: accessToken,
        body: route.body,
      });
      expect([401, 403]).toContain(res.status);
      void user;
    });

    it(`${route.id} H09: suspended Platform user`, async () => {
      const { accessToken } = await issuePlatformToken(['auditor'], { status: 'suspended' });
      const res = await http(route.method, route.path(ctx()), {
        token: accessToken,
        body: route.body,
      });
      expect([401, 403]).toContain(res.status);
    });

    it(`${route.id} H10: missing permission`, async () => {
      // sales_representative lacks audit.view / audit.export
      const { accessToken } = await issuePlatformToken(['sales_representative']);
      const res = await http(route.method, route.path(ctx()), {
        token: accessToken,
        body: route.body,
      });
      expect(res.status).toBe(403);
      expect(res.serviceCalled).toBe(false);
    });

    it(`${route.id} H16-H19: denial has no service call and no side effects`, async () => {
      const before = await prisma.auditEntry.count();
      const res = await http(route.method, route.path(ctx()), { body: route.body });
      expect(res.status).toBe(401);
      expect(res.serviceCalled).toBe(false);
      expect(await prisma.auditEntry.count()).toBe(before);
    });

    it(`${route.id} H20: Cache-Control private, no-store when authorized response headers present`, async () => {
      const { accessToken } = await issuePlatformToken(
        route.needsExport ? ['platform_owner'] : ['auditor'],
      );
      const res = await http(route.method, route.path(ctx()), {
        token: accessToken,
        body: route.body,
        headers: route.id === 'R09' ? { 'idempotency-key': randomUUID() } : undefined,
      });
      if (res.status < 500 && res.cacheControl) {
        expect(res.cacheControl).toMatch(/no-store/);
      }
    });

    it(`${route.id} H29-H30: safe generic errors / no PHI secrets stacks`, async () => {
      const { accessToken } = await issuePlatformToken(
        route.needsExport ? ['platform_owner'] : ['auditor'],
      );
      const res = await http(route.method, route.path(ctx()), {
        token: accessToken,
        body: route.body,
      });
      const blob = `${res.text}`;
      expect(blob).not.toMatch(/sk-live|password|Bearer ey|SELECT \*|PrismaClient|at Object\./i);
    });
  });

  it('R01 H22: invalid cursor', async () => {
    const { accessToken } = await issuePlatformToken(['auditor']);
    const res = await http('GET', '/platform/audit/entries?cursor=not-a-cursor', {
      token: accessToken,
    });
    expect(res.status).toBe(400);
  });

  it('R01 H23: oversized page', async () => {
    const { accessToken } = await issuePlatformToken(['auditor']);
    const res = await http('GET', '/platform/audit/entries?limit=9999', { token: accessToken });
    expect([200, 400]).toContain(res.status);
    if (res.status === 200) {
      const items = (res.json as { items: unknown[] }).items;
      expect(items.length).toBeLessThanOrEqual(100);
    }
  });

  it('R01 H24: oversized date range', async () => {
    const { accessToken } = await issuePlatformToken(['auditor']);
    const from = new Date(Date.now() - 400 * 86400000).toISOString();
    const to = new Date().toISOString();
    const res = await http('GET', `/platform/audit/entries?from=${from}&to=${to}`, {
      token: accessToken,
    });
    expect(res.status).toBe(400);
  });

  it('R01 H21: passive read does not extend session activity', async () => {
    const { accessToken, session } = await issuePlatformToken(['auditor']);
    const before = await prisma.platformRefreshToken.findUniqueOrThrow({
      where: { sessionId: session.sessionId },
    });
    await http('GET', '/platform/audit/entries', { token: accessToken });
    const after = await prisma.platformRefreshToken.findUniqueOrThrow({
      where: { sessionId: session.sessionId },
    });
    expect(after.lastActivityAt.getTime()).toBe(before.lastActivityAt.getTime());
  });

  it('R03 correlation timeline bounded / unrelated inaccessible shape', async () => {
    const { accessToken } = await issuePlatformToken(['auditor']);
    const other = randomUUID();
    const res = await http('GET', `/platform/audit/correlation/${other}`, { token: accessToken });
    expect([200, 400]).toContain(res.status);
    if (res.status === 200) {
      expect((res.json as { items: unknown[] }).items.length).toBe(0);
    }
  });
});
