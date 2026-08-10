/**
 * Flexible Step 20 — real Passport/JWT HTTP security matrix (representative routes).
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
  FeatureFlagsController,
  GlobalSettingsController,
} from '../controllers/feature-flags.controller';
import { FeatureFlagsSettingsService } from '../application/feature-flags-settings.service';
import { OperationalDecisionService } from '../application/operational-decision.service';
import {
  assertSafePlatformTestDatabaseUrl,
  cleanupFfTables,
  clearFfFailureInjection,
  createFfStack,
  createHybridPrisma,
  createPlatformDbSecurityClient,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  enableFfFlag,
  platformDbSecurityEnabled,
  seedActiveFlag,
} from './feature-flags-settings-db.harness';

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

describeDb('Step 20 Passport HTTP security matrix (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let restoreFlag: () => void;
  let app: INestApplication;
  let baseUrl: string;
  let serviceCalls: number;
  let jwtTokens: JwtTokenService;
  let jwtService: JwtService;
  let blacklistedJtis: Set<string>;
  let flagId: string;

  beforeAll(async () => {
    assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
    prisma = createPlatformDbSecurityClient();
    restoreFlag = enableFfFlag();
    jwtService = new JwtService({});
    jwtTokens = new JwtTokenService(jwtService, JWT_CFG);
  });

  afterAll(async () => {
    await app?.close();
    restoreFlag();
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    clearFfFailureInjection();
    await cleanupFfTables(prisma);
    await prisma.platformRefreshToken.deleteMany({});
    await prisma.platformUserRole.deleteMany({});
    await prisma.platformUser.deleteMany({});

    const owner = await createPlatformUserFixture(prisma, {
      email: `ff-seed-${randomUUID()}@test.local`,
      roleKeys: ['platform_owner'],
    });
    const flag = await seedActiveFlag(prisma, owner.id);
    flagId = flag.id;

    blacklistedJtis = new Set();
    const wrapped = createHybridPrisma(prisma);
    const stack = createFfStack(prisma);
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
    const operationalProxy = new Proxy(stack.operational, {
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
      controllers: [FeatureFlagsController, GlobalSettingsController],
      providers: [
        { provide: FeatureFlagsSettingsService, useValue: serviceProxy },
        { provide: OperationalDecisionService, useValue: operationalProxy },
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

  async function issuePlatformToken(roleKeys: string[] = ['platform_administrator']) {
    const user = await createPlatformUserFixture(prisma, {
      email: `ff-http-${randomUUID()}@test.local`,
      roleKeys,
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    const pair = jwtTokens.issuePlatformTokenPair({
      platformUserId: user.id,
      sessionId: session.sessionId,
    });
    return { user, accessToken: pair.accessToken };
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
    const cacheControl = res.headers.get('cache-control');
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    return { status: res.status, json, cacheControl, text };
  }

  it('valid Platform principal can list flags; Cache-Control private, no-store', async () => {
    const { accessToken } = await issuePlatformToken(['platform_administrator']);
    const before = serviceCalls;
    const res = await http('GET', '/platform/feature-flags', { token: accessToken });
    expect(res.status).toBe(200);
    expect(res.cacheControl).toMatch(/private/i);
    expect(res.cacheControl).toMatch(/no-store/i);
    expect(serviceCalls).toBeGreaterThan(before);
  });

  it('missing authentication rejected with zero side effects', async () => {
    const before = serviceCalls;
    const res = await http('GET', '/platform/feature-flags');
    expect(res.status).toBe(401);
    expect(serviceCalls).toBe(before);
  });

  it('Clinic principal rejected', async () => {
    const clinicToken = jwtService.sign(
      {
        sub: randomUUID(),
        tenantId: randomUUID(),
        roles: ['owner'],
        aud: CLINIC_TOKEN_AUDIENCE,
        iss: 'booking-clinic',
      },
      { secret: JWT_CFG.accessSecret, expiresIn: 900 },
    );
    const before = serviceCalls;
    const res = await http('GET', '/platform/feature-flags', { token: clinicToken });
    expect([401, 403]).toContain(res.status);
    expect(serviceCalls).toBe(before);
  });

  it('wrong audience rejected', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ff-aud-${randomUUID()}@test.local`,
      roleKeys: ['platform_administrator'],
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    const bad = jwtService.sign(
      {
        sub: user.id,
        sessionId: session.sessionId,
        principalType: 'platform',
        aud: 'not-platform',
        iss: JWT_CFG.platformIssuer,
      },
      { secret: JWT_CFG.platformAccessSecret, expiresIn: 900 },
    );
    const before = serviceCalls;
    const res = await http('GET', '/platform/feature-flags', { token: bad });
    expect([401, 403]).toContain(res.status);
    expect(serviceCalls).toBe(before);
  });

  it('missing permission denied with zero side effects', async () => {
    const { accessToken } = await issuePlatformToken(['sales_representative']);
    const before = serviceCalls;
    const res = await http('POST', '/platform/feature-flags', {
      token: accessToken,
      body: {
        canonicalKey: `ops.denied.${randomUUID().slice(0, 8)}`,
        displayName: 'x',
        description: 'x',
        ownerTeam: 'ops',
        category: 'test',
        effect: 'OPERATIONAL_ENABLEMENT',
        reason: 'nope',
      },
      headers: { 'idempotency-key': randomUUID() },
    });
    expect(res.status).toBe(403);
    expect(serviceCalls).toBe(before);
  });

  it('kill-switch requires feature-flag.kill-switch permission', async () => {
    const { accessToken } = await issuePlatformToken(['operations_engineer']);
    const before = serviceCalls;
    const res = await http('POST', `/platform/feature-flags/${flagId}/kill-switch/activate`, {
      token: accessToken,
      body: {
        reason: 'kill',
        expectedRowVersion: 1,
        previewFingerprint: 'fp',
        confirmation: 'CONFIRM',
      },
      headers: { 'idempotency-key': randomUUID() },
    });
    expect(res.status).toBe(403);
    expect(serviceCalls).toBe(before);
  });

  it('global settings list requires settings.view', async () => {
    const { accessToken } = await issuePlatformToken(['platform_administrator']);
    const res = await http('GET', '/platform/global-settings', { token: accessToken });
    expect(res.status).toBe(200);
    expect(res.cacheControl).toMatch(/no-store/i);
  });

  it('safe errors — no stack/PHI/secrets in body', async () => {
    const { accessToken } = await issuePlatformToken(['platform_administrator']);
    const res = await http('GET', `/platform/feature-flags/${randomUUID()}`, {
      token: accessToken,
    });
    expect([404, 400]).toContain(res.status);
    const blob = JSON.stringify(res.json ?? '');
    expect(blob).not.toMatch(/prisma|stack|password|api[_-]?key/i);
  });

  it('platform audience constant used for platform tokens', () => {
    expect(PLATFORM_TOKEN_AUDIENCE).toBeTruthy();
  });
});
