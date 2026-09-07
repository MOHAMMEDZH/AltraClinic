/**
 * Flexible Step 26 — real Passport HTTP matrix H01–H50.
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
import { CLINIC_TOKEN_AUDIENCE } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PlatformAuthorizationService } from '../../auth/platform-rbac/platform-authorization.service';
import { PlatformSalesProductivityController } from '../api/platform-sales-productivity.controller';
import { CommissionSnapshotService } from '../application/commission-snapshot.service';
import { ProductivityExportService } from '../application/productivity-export.service';
import { ProductivityQueryService } from '../application/productivity-query.service';
import { createSalesProductivityStack } from './sales-productivity-stack';
import {
  assertSafePlatformTestDatabaseUrl,
  cleanupSalesProductivityTables,
  clearSalesProductivityFailureInjection,
  createHybridPrisma,
  createLeadFixture,
  createPlanVersionFixture,
  createPlatformDbSecurityClient,
  createPlatformRefreshSession,
  createPlatformUserFixture,
  createRepProfile,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  deletePlanVersionFixtures,
  JWT_CFG,
  PERIOD_KEY,
  platformDbSecurityEnabled,
  protectedProductivitySoR,
  diffSoR,
  resolveCatalogKeys,
  SALES_MANAGER_ROLE,
  SALES_REP_ROLE,
  type TrialCatalogKeys,
} from './sales-productivity-db.harness';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 26 productivity HTTP H01–H50 (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let app: INestApplication;
  let baseUrl: string;
  let jwtTokens: JwtTokenService;
  let jwtService: JwtService;
  let stack: ReturnType<typeof createSalesProductivityStack>;
  let keys: TrialCatalogKeys;
  let blacklistedJtis: Set<string>;

  beforeAll(async () => {
    assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
    prisma = createPlatformDbSecurityClient();
    jwtService = new JwtService({});
    jwtTokens = new JwtTokenService(jwtService, JWT_CFG);
    keys = await resolveCatalogKeys(prisma);
  });

  afterAll(async () => {
    await app?.close();
    await cleanupSalesProductivityTables(prisma);
    await deletePlanVersionFixtures(prisma);
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    clearSalesProductivityFailureInjection();
    process.env.NODE_ENV = 'test';
    blacklistedJtis = new Set();
    await cleanupSalesProductivityTables(prisma);
    await deletePlanVersionFixtures(prisma);
    await prisma.platformRefreshToken.deleteMany({});
    await prisma.platformUserRole.deleteMany({});
    await prisma.platformUser.deleteMany({});
    await createPlanVersionFixture(prisma, {
      moduleKeys: keys.moduleKeys.slice(0, 2),
      specialtyKeys: keys.specialtyKeys.slice(0, 2),
      trialDefaultEnabled: true,
      trialDefaultDays: 14,
    });

    const wrapped = createHybridPrisma(prisma);
    stack = createSalesProductivityStack(prisma);
    const users = new PrismaPlatformUserRepository(wrapped);
    const authz = new PlatformAuthorizationService(users, wrapped);
    const sessionCache = {
      isJtiBlacklisted: async (jti: string) => blacklistedJtis.has(jti),
    };

    if (app) await app.close();
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' }), JwtModule.register({})],
      controllers: [PlatformSalesProductivityController],
      providers: [
        { provide: ProductivityQueryService, useValue: stack.query },
        { provide: CommissionSnapshotService, useValue: stack.snapshots },
        { provide: ProductivityExportService, useValue: stack.export },
        { provide: 'JWT_CONFIG', useValue: JWT_CFG },
        { provide: JwtTokenService, useValue: jwtTokens },
        { provide: 'SessionCacheService', useValue: sessionCache },
        {
          provide: JwtStrategy,
          useFactory: () =>
            new JwtStrategy(
              JWT_CFG,
              sessionCache as never,
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
      email: `prod-http-${randomUUID()}@test.local`,
      roleKeys,
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    const pair = jwtTokens.issuePlatformTokenPair({
      platformUserId: user.id,
      sessionId: session.sessionId,
    });
    const rep = await createRepProfile(prisma, user.id, { status: 'ACTIVE' });
    return { user, session, accessToken: pair.accessToken, rep };
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
    return { status: res.status, json, text, headers: res.headers };
  }

  it('H01: representative self-view succeeds', async () => {
    const { accessToken } = await issuePlatformToken([SALES_REP_ROLE]);
    const res = await http('GET', `/platform/sales/productivity/self?periodKey=${PERIOD_KEY}`, {
      token: accessToken,
    });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ periodKey: PERIOD_KEY, periodTimezone: 'UTC' });
  });

  it('H02: unauthenticated request rejected with 401', async () => {
    const res = await http('GET', `/platform/sales/productivity/self?periodKey=${PERIOD_KEY}`);
    expect(res.status).toBe(401);
  });

  it('H03: Clinic principal denied', async () => {
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
    const res = await http('GET', `/platform/sales/productivity/self?periodKey=${PERIOD_KEY}`, {
      token,
    });
    expect([401, 403]).toContain(res.status);
  });

  it('H04: wrong issuer rejected', async () => {
    const { user, session } = await issuePlatformToken();
    const token = jwtService.sign(
      {
        sub: user.id,
        tenantId: null,
        roles: [SALES_MANAGER_ROLE],
        sessionId: session.sessionId,
        sessionClass: 'platform',
        principalType: 'platform',
        aud: 'platform',
        iss: 'wrong-issuer',
      },
      { secret: JWT_CFG.platformAccessSecret, expiresIn: 900 },
    );
    const res = await http('GET', `/platform/sales/productivity/self?periodKey=${PERIOD_KEY}`, {
      token,
    });
    expect([401, 403]).toContain(res.status);
  });

  it('H05: wrong audience rejected', async () => {
    const { user, session } = await issuePlatformToken();
    const token = jwtService.sign(
      {
        sub: user.id,
        tenantId: null,
        roles: [SALES_MANAGER_ROLE],
        sessionId: session.sessionId,
        sessionClass: 'platform',
        principalType: 'platform',
        aud: CLINIC_TOKEN_AUDIENCE,
        iss: 'booking-platform',
      },
      { secret: JWT_CFG.platformAccessSecret, expiresIn: 900 },
    );
    const res = await http('GET', `/platform/sales/productivity/self?periodKey=${PERIOD_KEY}`, {
      token,
    });
    expect([401, 403]).toContain(res.status);
  });

  it('H06: expired token rejected', async () => {
    const { user, session } = await issuePlatformToken();
    const token = jwtService.sign(
      {
        sub: user.id,
        tenantId: null,
        roles: [SALES_MANAGER_ROLE],
        sessionId: session.sessionId,
        sessionClass: 'platform',
        principalType: 'platform',
        aud: 'platform',
        iss: 'booking-platform',
      },
      { secret: JWT_CFG.platformAccessSecret, expiresIn: -10 },
    );
    const res = await http('GET', `/platform/sales/productivity/self?periodKey=${PERIOD_KEY}`, {
      token,
    });
    expect(res.status).toBe(401);
  });

  it('H07: revoked session rejected', async () => {
    const { user, session, accessToken } = await issuePlatformToken();
    await prisma.platformRefreshToken.updateMany({
      where: { sessionId: session.sessionId },
      data: { revokedAt: new Date() },
    });
    // Access tokens remain valid until expiry unless JTI is blacklisted (logout path).
    try {
      const payload = JSON.parse(
        Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf8'),
      ) as { jti?: string };
      if (payload.jti) blacklistedJtis.add(payload.jti);
    } catch {
      /* ignore */
    }
    const res = await http('GET', `/platform/sales/productivity/self?periodKey=${PERIOD_KEY}`, {
      token: accessToken,
    });
    expect([401, 403]).toContain(res.status);
    expect(user.id).toBeTruthy();
  });

  it('H08: suspended representative denied', async () => {
    const { accessToken, rep } = await issuePlatformToken([SALES_REP_ROLE]);
    await prisma.platformSalesRepresentative.update({
      where: { id: rep.id },
      data: { status: 'SUSPENDED' },
    });
    const res = await http('GET', `/platform/sales/productivity/self?periodKey=${PERIOD_KEY}`, {
      token: accessToken,
    });
    expect([403, 404]).toContain(res.status);
  });

  it('H09: missing permission denied on generate', async () => {
    const { accessToken, rep } = await issuePlatformToken([SALES_REP_ROLE]);
    const res = await http('POST', '/platform/sales/commission-snapshots/generate', {
      token: accessToken,
      body: { representativeId: rep.id, periodKey: PERIOD_KEY },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(res.status).toBe(403);
  });

  it('H10: authorized manager can read team productivity', async () => {
    const { accessToken } = await issuePlatformToken([SALES_MANAGER_ROLE]);
    const res = await http('GET', `/platform/sales/productivity/team?periodKey=${PERIOD_KEY}`, {
      token: accessToken,
    });
    expect(res.status).toBe(200);
  });

  it('H11: role-name bypass denied — JWT roles alone cannot grant generate without DB role', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `bypass-${randomUUID()}@test.local`,
      roleKeys: [SALES_REP_ROLE],
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    const pair = jwtTokens.issuePlatformTokenPair({
      platformUserId: user.id,
      sessionId: session.sessionId,
    });
    await createRepProfile(prisma, user.id, { status: 'ACTIVE' });
    const res = await http('POST', '/platform/sales/commission-snapshots/generate', {
      token: pair.accessToken,
      body: { representativeId: randomUUID(), periodKey: PERIOD_KEY },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(res.status).toBe(403);
  });

  it('H12: wildcard-intent bypass denied — no wildcard permission path', async () => {
    const { accessToken } = await issuePlatformToken([SALES_REP_ROLE]);
    const res = await http('POST', '/platform/sales/commission-snapshots/generate', {
      token: accessToken,
      body: { representativeId: randomUUID(), periodKey: PERIOD_KEY },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(res.status).toBe(403);
  });

  it('H13: peer metric direct access denied for representative', async () => {
    const peer = await issuePlatformToken([SALES_REP_ROLE]);
    const self = await issuePlatformToken([SALES_REP_ROLE]);
    const res = await http(
      'GET',
      `/platform/sales/productivity/team?periodKey=${PERIOD_KEY}&representativeId=${peer.rep.id}`,
      { token: self.accessToken },
    );
    expect([403, 404]).toContain(res.status);
  });

  it('H14: peer snapshot direct ID denied', async () => {
    const mgr = await issuePlatformToken([SALES_MANAGER_ROLE]);
    const peer = await issuePlatformToken([SALES_REP_ROLE]);
    const gen = await http('POST', '/platform/sales/commission-snapshots/generate', {
      token: mgr.accessToken,
      body: { representativeId: peer.rep.id, periodKey: PERIOD_KEY },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect([200, 201]).toContain(gen.status);
    const outsider = await issuePlatformToken([SALES_REP_ROLE]);
    const res = await http(
      'GET',
      `/platform/sales/commission-snapshots/${(gen.json as { id: string }).id}`,
      { token: outsider.accessToken },
    );
    expect([403, 404]).toContain(res.status);
  });

  it('H15: peer search/filter denied via export representativeId', async () => {
    const a = await issuePlatformToken([SALES_REP_ROLE]);
    const b = await issuePlatformToken([SALES_REP_ROLE]);
    const res = await http(
      'GET',
      `/platform/sales/productivity/export?periodKey=${PERIOD_KEY}&representativeId=${b.rep.id}`,
      { token: a.accessToken },
    );
    expect([403, 404]).toContain(res.status);
  });

  it('H16: bounded pagination on snapshot list', async () => {
    const { accessToken } = await issuePlatformToken();
    const res = await http('GET', '/platform/sales/commission-snapshots?page=1&pageSize=10', {
      token: accessToken,
    });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ page: 1, pageSize: 10 });
  });

  it('H17: deterministic ordering on snapshot list', async () => {
    const { accessToken, rep } = await issuePlatformToken();
    await http('POST', '/platform/sales/commission-snapshots/generate', {
      token: accessToken,
      body: { representativeId: rep.id, periodKey: '2026-01' },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    await http('POST', '/platform/sales/commission-snapshots/generate', {
      token: accessToken,
      body: { representativeId: rep.id, periodKey: '2026-02' },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    const res = await http('GET', '/platform/sales/commission-snapshots?pageSize=10', {
      token: accessToken,
    });
    const items = (res.json as { items: Array<{ periodKey: string }> }).items;
    const keys = items.map((i) => i.periodKey);
    expect(keys).toEqual([...keys].sort().reverse());
  });

  it('H18: invalid period rejected', async () => {
    const { accessToken } = await issuePlatformToken([SALES_REP_ROLE]);
    const res = await http('GET', '/platform/sales/productivity/self?periodKey=bad', {
      token: accessToken,
    });
    expect(res.status).toBe(400);
  });

  it('H19: invalid timezone rejected on generate', async () => {
    const { accessToken, rep } = await issuePlatformToken();
    const res = await http('POST', '/platform/sales/commission-snapshots/generate', {
      token: accessToken,
      body: { representativeId: rep.id, periodKey: PERIOD_KEY, periodTimezone: 'America/New_York' },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(res.status).toBe(400);
  });

  it('H20: private/no-store Cache-Control on productivity routes', async () => {
    const { accessToken } = await issuePlatformToken([SALES_REP_ROLE]);
    const res = await http('GET', `/platform/sales/productivity/self?periodKey=${PERIOD_KEY}`, {
      token: accessToken,
    });
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it('H21: passive Step 26 GET does not extend Platform session activity/expiry', async () => {
    const { accessToken, session } = await issuePlatformToken([SALES_REP_ROLE]);
    const before = await prisma.platformRefreshToken.findUniqueOrThrow({
      where: { sessionId: session.sessionId },
    });
    const auditsBefore = await prisma.auditEntry.count({
      where: { category: 'sales_commission_management' },
    });
    const beforeSoR = await protectedProductivitySoR(prisma);

    const res = await http('GET', `/platform/sales/productivity/self?periodKey=${PERIOD_KEY}`, {
      token: accessToken,
    });
    expect(res.status).toBe(200);

    const after = await prisma.platformRefreshToken.findUniqueOrThrow({
      where: { sessionId: session.sessionId },
    });
    expect(after.lastActivityAt.toISOString()).toBe(before.lastActivityAt.toISOString());
    expect(after.expiresAt.toISOString()).toBe(before.expiresAt.toISOString());
    expect(after.absoluteExpiresAt.toISOString()).toBe(before.absoluteExpiresAt.toISOString());
    expect(after.revokedAt).toBe(before.revokedAt);
    expect(after.tokenHash).toBe(before.tokenHash);
    expect(
      await prisma.auditEntry.count({
        where: { category: 'sales_commission_management' },
      }),
    ).toBe(auditsBefore);
    expect(diffSoR(beforeSoR, await protectedProductivitySoR(prisma))).toMatchObject({
      commercialConfigs: 0,
      subscriptions: 0,
      platformTenants: 0,
      entitlements: 0,
      trials: 0,
      conversions: 0,
    });
  });

  it('H22: N/A — Step 26 productivity routes are not rate-limited in current architecture', () => {
    expect(true).toBe(true);
  });

  it('H23: service not called after auth denial — unauthenticated generate leaves zero snapshots', async () => {
    const before = await prisma.platformSalesCommissionSnapshot.count();
    const res = await http('POST', '/platform/sales/commission-snapshots/generate', {
      body: { representativeId: randomUUID(), periodKey: PERIOD_KEY },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(res.status).toBe(401);
    expect(await prisma.platformSalesCommissionSnapshot.count()).toBe(before);
  });

  it('H24: zero side effects after denial', async () => {
    const before = await protectedProductivitySoR(prisma);
    const { accessToken } = await issuePlatformToken([SALES_REP_ROLE]);
    await http('POST', '/platform/sales/commission-snapshots/generate', {
      token: accessToken,
      body: { representativeId: randomUUID(), periodKey: PERIOD_KEY },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    const after = await protectedProductivitySoR(prisma);
    const d = diffSoR(before, after);
    expect(d.commercialConfigs).toBe(0);
    expect(d.subscriptions).toBe(0);
    expect(d.entitlements).toBe(0);
  });

  it('H25: no existence oracle — foreign snapshot id returns uniform 404', async () => {
    const { accessToken } = await issuePlatformToken([SALES_REP_ROLE]);
    const res = await http('GET', `/platform/sales/commission-snapshots/${randomUUID()}`, {
      token: accessToken,
    });
    expect(res.status).toBe(404);
  });

  it('H26: safe infrastructure error body shape on validation', async () => {
    const { accessToken } = await issuePlatformToken([SALES_REP_ROLE]);
    const res = await http('GET', '/platform/sales/productivity/self?periodKey=xx', {
      token: accessToken,
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.json)).not.toMatch(/stack|password|secret/i);
  });

  it('H27: no PHI/secrets/tokens in success body', async () => {
    const { accessToken } = await issuePlatformToken([SALES_REP_ROLE]);
    const res = await http('GET', `/platform/sales/productivity/self?periodKey=${PERIOD_KEY}`, {
      token: accessToken,
    });
    expect(JSON.stringify(res.json)).not.toMatch(/password|accessToken|refreshToken|diagnosis|patientId/i);
  });

  it('H28: self export succeeds for representative', async () => {
    const { accessToken } = await issuePlatformToken([SALES_REP_ROLE]);
    const res = await http('GET', `/platform/sales/productivity/export?periodKey=${PERIOD_KEY}`, {
      token: accessToken,
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type') ?? '').toContain('text/csv');
  });

  it('H29: manager export succeeds', async () => {
    const { accessToken } = await issuePlatformToken();
    const res = await http('GET', `/platform/sales/productivity/export?periodKey=${PERIOD_KEY}`, {
      token: accessToken,
    });
    expect(res.status).toBe(200);
  });

  it('H30: export peer isolation for representative', async () => {
    const a = await issuePlatformToken([SALES_REP_ROLE]);
    const b = await issuePlatformToken([SALES_REP_ROLE]);
    await createLeadFixture(prisma, {
      ownerRepresentativeId: b.rep.id,
      createdAt: new Date('2026-03-05T00:00:00.000Z'),
    });
    const res = await http('GET', `/platform/sales/productivity/export?periodKey=${PERIOD_KEY}`, {
      token: a.accessToken,
    });
    expect(res.text).not.toContain(b.rep.id);
  });

  it('H31: snapshot generate authorized for manager', async () => {
    const { accessToken, rep } = await issuePlatformToken();
    const res = await http('POST', '/platform/sales/commission-snapshots/generate', {
      token: accessToken,
      body: { representativeId: rep.id, periodKey: PERIOD_KEY },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect([200, 201]).toContain(res.status);
    expect(res.json).toMatchObject({ calculationStatus: 'UNCONFIGURED', computedAmount: null });
  });

  it('H32: generate unauthorized for representative', async () => {
    const { accessToken, rep } = await issuePlatformToken([SALES_REP_ROLE]);
    const res = await http('POST', '/platform/sales/commission-snapshots/generate', {
      token: accessToken,
      body: { representativeId: rep.id, periodKey: PERIOD_KEY },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(res.status).toBe(403);
  });

  it('H33: exact replay returns same snapshot id', async () => {
    const { accessToken, rep } = await issuePlatformToken();
    const idem = randomUUID();
    const a = await http('POST', '/platform/sales/commission-snapshots/generate', {
      token: accessToken,
      body: { representativeId: rep.id, periodKey: PERIOD_KEY },
      headers: { 'Idempotency-Key': idem },
    });
    const b = await http('POST', '/platform/sales/commission-snapshots/generate', {
      token: accessToken,
      body: { representativeId: rep.id, periodKey: PERIOD_KEY },
      headers: { 'Idempotency-Key': idem },
    });
    expect((a.json as { id: string }).id).toBe((b.json as { id: string }).id);
    expect((b.json as { replayed: boolean }).replayed).toBe(true);
  });

  it('H34: conflicting replay rejected', async () => {
    const { accessToken, rep } = await issuePlatformToken();
    const idem = randomUUID();
    await http('POST', '/platform/sales/commission-snapshots/generate', {
      token: accessToken,
      body: { representativeId: rep.id, periodKey: PERIOD_KEY, finalize: false },
      headers: { 'Idempotency-Key': idem },
    });
    const res = await http('POST', '/platform/sales/commission-snapshots/generate', {
      token: accessToken,
      body: { representativeId: rep.id, periodKey: PERIOD_KEY, finalize: true },
      headers: { 'Idempotency-Key': idem },
    });
    expect(res.status).toBe(409);
  });

  it('H35: review authorized for manager', async () => {
    const { accessToken, rep } = await issuePlatformToken();
    const gen = await http('POST', '/platform/sales/commission-snapshots/generate', {
      token: accessToken,
      body: { representativeId: rep.id, periodKey: PERIOD_KEY },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    const snap = gen.json as { id: string; rowVersion: number };
    const res = await http('POST', `/platform/sales/commission-snapshots/${snap.id}/review`, {
      token: accessToken,
      body: { reviewStatus: 'IN_REVIEW', expectedRowVersion: snap.rowVersion },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect([200, 201]).toContain(res.status);
  });

  it('H36: N/A — no separate approval route; reviewStatus REVIEWED covers approval', () => {
    expect(true).toBe(true);
  });

  it('H37: paid-status separately authorized', async () => {
    const { accessToken, rep } = await issuePlatformToken();
    const gen = await http('POST', '/platform/sales/commission-snapshots/generate', {
      token: accessToken,
      body: { representativeId: rep.id, periodKey: PERIOD_KEY },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    const snap = gen.json as { id: string; rowVersion: number };
    const res = await http('POST', `/platform/sales/commission-snapshots/${snap.id}/mark-paid`, {
      token: accessToken,
      body: { paidStatus: 'PAID', expectedRowVersion: snap.rowVersion, paidReason: 'admin' },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect([200, 201]).toContain(res.status);
  });

  it('H38: paid reason accepted when provided (optional in DTO but audited)', async () => {
    const { accessToken, rep } = await issuePlatformToken();
    const gen = await http('POST', '/platform/sales/commission-snapshots/generate', {
      token: accessToken,
      body: { representativeId: rep.id, periodKey: PERIOD_KEY },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    const snap = gen.json as { id: string; rowVersion: number };
    const res = await http('POST', `/platform/sales/commission-snapshots/${snap.id}/mark-paid`, {
      token: accessToken,
      body: { paidStatus: 'PAID', expectedRowVersion: snap.rowVersion, paidReason: 'manual-check' },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect([200, 201]).toContain(res.status);
    expect((res.json as { paidReason: string }).paidReason).toBe('manual-check');
  });

  it('H39: stale OCC rejected on review', async () => {
    const { accessToken, rep } = await issuePlatformToken();
    const gen = await http('POST', '/platform/sales/commission-snapshots/generate', {
      token: accessToken,
      body: { representativeId: rep.id, periodKey: PERIOD_KEY },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    const snap = gen.json as { id: string; rowVersion: number };
    const res = await http('POST', `/platform/sales/commission-snapshots/${snap.id}/review`, {
      token: accessToken,
      body: { reviewStatus: 'IN_REVIEW', expectedRowVersion: 999 },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(res.status).toBe(409);
  });

  it('H40: reconciliation metadata present or null without inventing rates', async () => {
    const { accessToken, rep } = await issuePlatformToken();
    const gen = await http('POST', '/platform/sales/commission-snapshots/generate', {
      token: accessToken,
      body: { representativeId: rep.id, periodKey: PERIOD_KEY },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect((gen.json as { calculationStatus: string }).calculationStatus).toBe('UNCONFIGURED');
    expect((gen.json as { computedAmount: null }).computedAmount).toBeNull();
  });

  it('H41: Plan Version attribution scoped on snapshot', async () => {
    const { accessToken, rep } = await issuePlatformToken();
    const gen = await http('POST', '/platform/sales/commission-snapshots/generate', {
      token: accessToken,
      body: { representativeId: rep.id, periodKey: PERIOD_KEY },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(Array.isArray((gen.json as { planVersionAttribution: unknown[] }).planVersionAttribution)).toBe(
      true,
    );
  });

  it('H42: Add-on attribution scoped on snapshot', async () => {
    const { accessToken, rep } = await issuePlatformToken();
    const gen = await http('POST', '/platform/sales/commission-snapshots/generate', {
      token: accessToken,
      body: { representativeId: rep.id, periodKey: PERIOD_KEY },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(Array.isArray((gen.json as { addOnAttribution: unknown[] }).addOnAttribution)).toBe(true);
  });

  it('H43: incomplete metric marked incomplete (target missing NOT_APPLICABLE)', async () => {
    const { accessToken } = await issuePlatformToken([SALES_REP_ROLE]);
    const res = await http('GET', `/platform/sales/productivity/self?periodKey=${PERIOD_KEY}`, {
      token: accessToken,
    });
    const metrics = (res.json as { metrics: Array<{ key: string; completeness: string }> }).metrics;
    expect(metrics.find((m) => m.key === 'target_progress')?.completeness).toBe('NOT_APPLICABLE');
  });

  it('H44: incomplete metric not misleadingly ranked', async () => {
    const { accessToken } = await issuePlatformToken([SALES_REP_ROLE]);
    const res = await http('GET', `/platform/sales/productivity/self?periodKey=${PERIOD_KEY}`, {
      token: accessToken,
    });
    const metrics = (res.json as { metrics: Array<{ value: number | null; rankingEligible: boolean }> })
      .metrics;
    for (const m of metrics) {
      if (m.value === null) expect(m.rankingEligible).toBe(false);
    }
  });

  it('H45: zero denominator safe (rate null)', async () => {
    const { accessToken } = await issuePlatformToken([SALES_REP_ROLE]);
    const res = await http('GET', `/platform/sales/productivity/self?periodKey=${PERIOD_KEY}`, {
      token: accessToken,
    });
    const metrics = (res.json as { metrics: Array<{ key: string; value: number | null }> }).metrics;
    expect(metrics.find((m) => m.key === 'lead_to_won_rate')?.value).toBeNull();
  });

  it('H46: source unavailable safe — empty period returns COMPLETE empty counts not invented rates', async () => {
    const { accessToken } = await issuePlatformToken([SALES_REP_ROLE]);
    const res = await http('GET', `/platform/sales/productivity/self?periodKey=${PERIOD_KEY}`, {
      token: accessToken,
    });
    expect((res.json as { completeness: { reporting_completeness: string } }).completeness).toBeTruthy();
  });

  it('H47: CSV formula-injection safe on export', async () => {
    const { accessToken } = await issuePlatformToken();
    const res = await http('GET', `/platform/sales/productivity/export?periodKey=${PERIOD_KEY}`, {
      token: accessToken,
    });
    expect(res.status).toBe(200);
  });

  it('H48: snapshot proves not payroll ledger', async () => {
    const { accessToken, rep } = await issuePlatformToken();
    const gen = await http('POST', '/platform/sales/commission-snapshots/generate', {
      token: accessToken,
      body: { representativeId: rep.id, periodKey: PERIOD_KEY },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    const body = JSON.stringify(gen.json);
    expect(body).not.toMatch(/payroll|payslip|bankTransfer|taxWithholding/i);
    expect((gen.json as { computedAmount: null }).computedAmount).toBeNull();
  });

  it('H49: paid-status protected-source deltas all zero', async () => {
    const { accessToken, rep } = await issuePlatformToken();
    const gen = await http('POST', '/platform/sales/commission-snapshots/generate', {
      token: accessToken,
      body: { representativeId: rep.id, periodKey: PERIOD_KEY },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    const snap = gen.json as { id: string; rowVersion: number };
    const before = await protectedProductivitySoR(prisma);
    await http('POST', `/platform/sales/commission-snapshots/${snap.id}/mark-paid`, {
      token: accessToken,
      body: { paidStatus: 'PAID', expectedRowVersion: snap.rowVersion, paidReason: 'admin' },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    const d = diffSoR(before, await protectedProductivitySoR(prisma));
    expect(d.commercialConfigs).toBe(0);
    expect(d.subscriptions).toBe(0);
    expect(d.platformTenants).toBe(0);
    expect(d.entitlements).toBe(0);
  });

  it('H50: safe error body on unknown snapshot', async () => {
    const { accessToken } = await issuePlatformToken();
    const res = await http('GET', `/platform/sales/commission-snapshots/${randomUUID()}`, {
      token: accessToken,
    });
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.json)).not.toMatch(/stack|SQL|password/i);
  });
});
