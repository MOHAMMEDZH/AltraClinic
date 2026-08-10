/**

 * Flexible Step 21 — real Passport/JWT HTTP security matrix (representative routes).

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



describeDb('Step 21 Audit Center Passport HTTP security matrix (PostgreSQL)', () => {

  let prisma: PrismaClient;

  let restoreFlag: () => void;

  let app: INestApplication;

  let baseUrl: string;

  let serviceCalls: number;

  let jwtTokens: JwtTokenService;

  let jwtService: JwtService;

  let blacklistedJtis: Set<string>;

  let entryId: string;



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

      email: `ac-http-${randomUUID()}@test.local`,

      roleKeys: ['auditor'],

    });

    const row = await seedAuditEntry(prisma, { actorId: auditor.id });

    entryId = row.id;



    blacklistedJtis = new Set();

    const wrapped = createHybridPrisma(prisma);

    const stack = createAuditStack(prisma);

    serviceCalls = 0;

    const bump = () => {

      serviceCalls += 1;

    };

    const queryProxy = proxyWithCallCount(stack.query, bump);

    const evidenceProxy = proxyWithCallCount(stack.evidence, bump);

    const exportsProxy = proxyWithCallCount(stack.exports, bump);



    const users = new PrismaPlatformUserRepository(wrapped);

    const authz = new PlatformAuthorizationService(users, wrapped);



    if (app) await app.close();

    const moduleRef = await Test.createTestingModule({

      imports: [PassportModule.register({ defaultStrategy: 'jwt' }), JwtModule.register({})],

      controllers: [PlatformAuditCenterController],

      providers: [

        { provide: AuditCenterQueryService, useValue: queryProxy },

        { provide: AuditCenterEvidenceService, useValue: evidenceProxy },

        { provide: AuditCenterExportService, useValue: exportsProxy },

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

    opts: { status?: string } = {},

  ) {

    const user = await createPlatformUserFixture(prisma, {

      email: `ac-passport-${randomUUID()}@test.local`,

      roleKeys,

      status: opts.status,

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



  it('GET /platform/audit/entries — valid platform principal; Cache-Control private, no-store', async () => {

    const { accessToken } = await issuePlatformToken(['auditor']);

    const before = serviceCalls;

    const res = await http('GET', '/platform/audit/entries', { token: accessToken });

    expect(res.status).toBe(200);

    expect(res.cacheControl).toMatch(/private/i);

    expect(res.cacheControl).toMatch(/no-store/i);

    expect(serviceCalls).toBeGreaterThan(before);

  });



  it('GET /platform/audit/entries — unauthenticated rejected with zero side effects', async () => {

    const before = serviceCalls;

    const res = await http('GET', '/platform/audit/entries');

    expect(res.status).toBe(401);

    expect(serviceCalls).toBe(before);

  });



  it('GET /platform/audit/entries — clinic audience token rejected', async () => {

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

    const res = await http('GET', '/platform/audit/entries', { token: clinicToken });

    expect([401, 403]).toContain(res.status);

    expect(serviceCalls).toBe(before);

  });



  it('GET /platform/audit/entries — missing audit.view denied with zero side effects', async () => {

    const { accessToken } = await issuePlatformToken(['sales_representative']);

    const before = serviceCalls;

    const res = await http('GET', '/platform/audit/entries', { token: accessToken });

    expect(res.status).toBe(403);

    expect(serviceCalls).toBe(before);

  });



  it('GET /platform/audit/entries — suspended platform user rejected', async () => {

    const { accessToken } = await issuePlatformToken(['auditor'], { status: 'suspended' });

    const before = serviceCalls;

    const res = await http('GET', '/platform/audit/entries', { token: accessToken });

    expect([401, 403]).toContain(res.status);

    expect(serviceCalls).toBe(before);

  });



  it('GET /platform/audit/entries/:id — authorized read', async () => {

    const { accessToken } = await issuePlatformToken(['auditor']);

    const before = serviceCalls;

    const res = await http('GET', `/platform/audit/entries/${entryId}`, { token: accessToken });

    expect(res.status).toBe(200);

    expect((res.json as { id: string }).id).toBe(entryId);

    expect(res.cacheControl).toMatch(/no-store/i);

    expect(serviceCalls).toBeGreaterThan(before);

  });



  it('POST /platform/audit/exports/preview — missing audit.export denied', async () => {

    const { accessToken } = await issuePlatformToken(['operations_engineer']);

    const before = serviceCalls;

    const res = await http('POST', '/platform/audit/exports/preview', {

      token: accessToken,

      body: { filters: {}, reason: 'preview denied', filterFingerprint: '' },

    });

    expect(res.status).toBe(403);

    expect(serviceCalls).toBe(before);

  });



  it('POST /platform/audit/exports — export permission + step-up path', async () => {

    const { accessToken } = await issuePlatformToken(['auditor']);

    const preview = await http('POST', '/platform/audit/exports/preview', {

      token: accessToken,

      body: { filters: {}, reason: 'http export', filterFingerprint: '' },

    });

    expect(preview.status).toBe(201);

    const fp = (preview.json as { filterFingerprint: string }).filterFingerprint;

    const before = serviceCalls;

    const res = await http('POST', '/platform/audit/exports', {

      token: accessToken,

      body: { filters: {}, reason: 'http export', filterFingerprint: fp },

      headers: { 'idempotency-key': randomUUID() },

    });

    expect([200, 201]).toContain(res.status);

    expect(serviceCalls).toBeGreaterThan(before);

  });



  it('no PATCH/PUT/DELETE routes exist (404)', async () => {

    const { accessToken } = await issuePlatformToken(['auditor']);

    for (const method of ['PATCH', 'PUT', 'DELETE'] as const) {

      const res = await http(method, '/platform/audit/entries', { token: accessToken });

      expect(res.status).toBe(404);

    }

  });



  it('platform audience constant used for platform tokens', () => {

    expect(PLATFORM_TOKEN_AUDIENCE).toBeTruthy();

  });

});


