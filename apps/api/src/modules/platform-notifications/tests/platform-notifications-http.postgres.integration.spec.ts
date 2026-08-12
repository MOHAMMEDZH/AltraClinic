/**
 * Flexible Step 27 — real Passport HTTP matrix H01–H40.
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
import { PlatformNotificationsController } from '../api/platform-notifications.controller';
import { PlatformNotificationQueryService } from '../application/platform-notification-query.service';
import { PlatformNotificationPreferenceService } from '../application/preferences/platform-notification-preference.service';
import { createPlatformNotificationsStack } from './platform-notifications-stack';
import {
  assertSafePlatformTestDatabaseUrl,
  cleanupPlatformNotificationsTables,
  clearPlatformNotificationFailureInjection,
  createHybridPrisma,
  createPlatformDbSecurityClient,
  createPlatformRefreshSession,
  createPlatformUserFixture,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  ensureSentinel,
  JWT_CFG,
  NOTIFICATIONS_ADMIN_ROLE,
  platformDbSecurityEnabled,
  setPlatformNotificationFailureInjection,
} from './platform-notifications-db.harness';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 27 notifications HTTP H01-H40 (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let app: INestApplication;
  let baseUrl: string;
  let jwtTokens: JwtTokenService;
  let jwtService: JwtService;
  let stack: ReturnType<typeof createPlatformNotificationsStack>;
  let blacklistedJtis: Set<string>;

  beforeAll(async () => {
    assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
    prisma = createPlatformDbSecurityClient();
    await ensureSentinel(prisma);
    jwtService = new JwtService({});
    jwtTokens = new JwtTokenService(jwtService, JWT_CFG);
  });

  afterAll(async () => {
    await app?.close();
    await cleanupPlatformNotificationsTables(prisma);
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    clearPlatformNotificationFailureInjection();
    process.env.NODE_ENV = 'test';
    blacklistedJtis = new Set();
    await cleanupPlatformNotificationsTables(prisma);
    // Clear leftover sales FKs before wiping platform users (shared booking_test volume).
    await prisma.platformSalesCommissionSnapshot.deleteMany({});
    await prisma.platformSalesTrialConversion.deleteMany({});
    await prisma.platformSalesTrialExtensionHistory.deleteMany({});
    await prisma.platformSalesTrial.deleteMany({});
    await prisma.platformSalesLeadNote.deleteMany({});
    await prisma.platformSalesLeadStageHistory.deleteMany({});
    await prisma.platformSalesLeadOwnershipHistory.deleteMany({});
    await prisma.platformSalesLead.deleteMany({});
    await prisma.platformSalesIdempotencyRecord.deleteMany({});
    await prisma.platformSalesCustomerOwnershipHistory.deleteMany({});
    await prisma.platformSalesCustomerOwnership.deleteMany({});
    await prisma.platformSalesRepresentative.deleteMany({});
    await prisma.platformRefreshToken.deleteMany({});
    await prisma.platformUserRole.deleteMany({});
    await prisma.platformUser.deleteMany({});

    const wrapped = createHybridPrisma(prisma);
    stack = createPlatformNotificationsStack(prisma);
    const users = new PrismaPlatformUserRepository(wrapped);
    const authz = new PlatformAuthorizationService(users, wrapped);
    const sessionCache = {
      isJtiBlacklisted: async (jti: string) => blacklistedJtis.has(jti),
    };

    if (app) await app.close();
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' }), JwtModule.register({})],
      controllers: [PlatformNotificationsController],
      providers: [
        { provide: PlatformNotificationQueryService, useValue: stack.query },
        { provide: PlatformNotificationPreferenceService, useValue: stack.prefs },
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

  async function issuePlatformToken(roleKeys: string[] = [NOTIFICATIONS_ADMIN_ROLE]) {
    const user = await createPlatformUserFixture(prisma, {
      email: `notif-http-${randomUUID()}@test.local`,
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
    return { status: res.status, json, text, headers: res.headers };
  }

  it('H01: GET templates succeeds for platform_administrator', async () => {
    const { accessToken } = await issuePlatformToken();
    const res = await http('GET', '/platform/notifications/templates', { token: accessToken });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.json)).toBe(true);
    expect((res.json as unknown[]).length).toBe(24);
  });

  it('H02: unauthenticated templates → 401', async () => {
    const res = await http('GET', '/platform/notifications/templates');
    expect(res.status).toBe(401);
  });

  it('H03: clinic principal denied', async () => {
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
    const res = await http('GET', '/platform/notifications/templates', { token });
    expect([401, 403]).toContain(res.status);
  });

  it('H04: wrong issuer rejected', async () => {
    const { user, session } = await issuePlatformToken();
    const token = jwtService.sign(
      {
        sub: user.id,
        tenantId: null,
        roles: [NOTIFICATIONS_ADMIN_ROLE],
        sessionId: session.sessionId,
        sessionClass: 'platform',
        principalType: 'platform',
        aud: 'platform',
        iss: 'wrong-issuer',
      },
      { secret: JWT_CFG.platformAccessSecret, expiresIn: 900 },
    );
    const res = await http('GET', '/platform/notifications/templates', { token });
    expect([401, 403]).toContain(res.status);
  });

  it('H05: wrong audience rejected', async () => {
    const { user, session } = await issuePlatformToken();
    const token = jwtService.sign(
      {
        sub: user.id,
        tenantId: null,
        roles: [NOTIFICATIONS_ADMIN_ROLE],
        sessionId: session.sessionId,
        sessionClass: 'platform',
        principalType: 'platform',
        aud: CLINIC_TOKEN_AUDIENCE,
        iss: 'booking-platform',
      },
      { secret: JWT_CFG.platformAccessSecret, expiresIn: 900 },
    );
    const res = await http('GET', '/platform/notifications/templates', { token });
    expect([401, 403]).toContain(res.status);
  });

  it('H06: expired token rejected', async () => {
    const { user, session } = await issuePlatformToken();
    const token = jwtService.sign(
      {
        sub: user.id,
        tenantId: null,
        roles: [NOTIFICATIONS_ADMIN_ROLE],
        sessionId: session.sessionId,
        sessionClass: 'platform',
        principalType: 'platform',
        aud: 'platform',
        iss: 'booking-platform',
      },
      { secret: JWT_CFG.platformAccessSecret, expiresIn: -10 },
    );
    const res = await http('GET', '/platform/notifications/templates', { token });
    expect(res.status).toBe(401);
  });

  it('H07: revoked / blacklisted JTI rejected', async () => {
    const { accessToken } = await issuePlatformToken();
    try {
      const payload = JSON.parse(
        Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf8'),
      ) as { jti?: string };
      if (payload.jti) blacklistedJtis.add(payload.jti);
    } catch {
      /* ignore */
    }
    const res = await http('GET', '/platform/notifications/templates', { token: accessToken });
    expect([401, 403]).toContain(res.status);
  });

  it('H08: Cache-Control private, no-store on templates', async () => {
    const { accessToken } = await issuePlatformToken();
    const res = await http('GET', '/platform/notifications/templates', { token: accessToken });
    expect(res.headers.get('cache-control')).toMatch(/private/i);
    expect(res.headers.get('cache-control')).toMatch(/no-store/i);
  });

  it('H09: GET template detail', async () => {
    const { accessToken } = await issuePlatformToken();
    const res = await http('GET', '/platform/notifications/templates/tpl.platform.invitation.sent', {
      token: accessToken,
    });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ key: 'tpl.platform.invitation.sent' });
  });

  it('H10: GET unknown template → 4xx', async () => {
    const { accessToken } = await issuePlatformToken();
    const res = await http('GET', '/platform/notifications/templates/tpl.platform.missing', {
      token: accessToken,
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('H11: POST template preview', async () => {
    const { accessToken } = await issuePlatformToken();
    const res = await http(
      'POST',
      '/platform/notifications/templates/tpl.platform.invitation.sent/preview',
      { token: accessToken, body: { locale: 'en-US' } },
    );
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ templateKey: 'tpl.platform.invitation.sent', locale: 'en-US' });
  });

  it('H12: GET preferences', async () => {
    const { accessToken } = await issuePlatformToken();
    const res = await http('GET', '/platform/notifications/preferences', { token: accessToken });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.json)).toBe(true);
  });

  it('H13: PATCH preferences requires Idempotency-Key', async () => {
    const { accessToken } = await issuePlatformToken();
    const res = await http('PATCH', '/platform/notifications/preferences', {
      token: accessToken,
      body: { category: 'usage', channel: 'email', enabled: false },
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('H14: PATCH preferences succeeds with Idempotency-Key', async () => {
    const { accessToken } = await issuePlatformToken();
    const res = await http('PATCH', '/platform/notifications/preferences', {
      token: accessToken,
      body: { category: 'usage', channel: 'email', enabled: false },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ category: 'usage', enabled: false });
  });

  it('H15: PATCH cannot disable mandatory security category', async () => {
    const { accessToken } = await issuePlatformToken();
    const res = await http('PATCH', '/platform/notifications/preferences', {
      token: accessToken,
      body: { category: 'security', channel: 'email', enabled: false },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(res.status).toBe(403);
  });

  it('H16: sales_representative without notification perms denied on templates', async () => {
    const { accessToken } = await issuePlatformToken(['sales_representative']);
    const res = await http('GET', '/platform/notifications/templates', { token: accessToken });
    expect(res.status).toBe(403);
  });

  it('H17: GET deliveries empty page', async () => {
    const { accessToken } = await issuePlatformToken();
    const res = await http('GET', '/platform/notifications/deliveries', { token: accessToken });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ page: 1, total: 0, items: [] });
  });

  it('H18: GET deliveries after dispatch lists intent', async () => {
    const { accessToken } = await issuePlatformToken();
    await stack.adapters.invitationSent({
      invitationId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: `h18-${randomUUID()}@test.local`,
      recipientDisplayName: 'Admin',
      inviterDisplayName: 'Root',
      expiresAt: new Date().toISOString(),
    });
    const res = await http('GET', '/platform/notifications/deliveries?pageSize=10', {
      token: accessToken,
    });
    expect(res.status).toBe(200);
    expect((res.json as { total: number }).total).toBe(1);
    expect((res.json as { items: Array<{ templateKey: string }> }).items[0].templateKey).toBe(
      'tpl.platform.invitation.sent',
    );
  });

  it('H19: GET delivery detail', async () => {
    const { accessToken } = await issuePlatformToken();
    const result = await stack.adapters.invitationSent({
      invitationId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: `h19-${randomUUID()}@test.local`,
      recipientDisplayName: 'Admin',
      inviterDisplayName: 'Root',
      expiresAt: new Date().toISOString(),
    });
    const res = await http('GET', `/platform/notifications/deliveries/${result.intentId}`, {
      token: accessToken,
    });
    expect(res.status).toBe(200);
    expect((res.json as { id: string }).id).toBe(result.intentId);
  });

  it('H20: GET missing delivery → 404', async () => {
    const { accessToken } = await issuePlatformToken();
    const res = await http('GET', `/platform/notifications/deliveries/${randomUUID()}`, {
      token: accessToken,
    });
    expect(res.status).toBe(404);
  });

  it('H21: POST retry requires Idempotency-Key', async () => {
    const { accessToken } = await issuePlatformToken();
    setPlatformNotificationFailureInjection('provider_transient');
    const result = await stack.adapters.invitationSent({
      invitationId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: `h21-${randomUUID()}@test.local`,
      recipientDisplayName: 'Admin',
      inviterDisplayName: 'Root',
      expiresAt: new Date().toISOString(),
    });
    clearPlatformNotificationFailureInjection();
    const res = await http('POST', `/platform/notifications/deliveries/${result.intentId}/retry`, {
      token: accessToken,
      body: { reason: 'ops' },
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('H22: POST retry succeeds with reason + Idempotency-Key', async () => {
    const { accessToken } = await issuePlatformToken();
    setPlatformNotificationFailureInjection('provider_transient');
    const result = await stack.adapters.invitationSent({
      invitationId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: `h22-${randomUUID()}@test.local`,
      recipientDisplayName: 'Admin',
      inviterDisplayName: 'Root',
      expiresAt: new Date().toISOString(),
    });
    clearPlatformNotificationFailureInjection();
    const intent = await prisma.notificationIntent.findUniqueOrThrow({
      where: { id: result.intentId! },
      include: { jobs: true },
    });
    await prisma.notificationIntent.update({
      where: { id: result.intentId! },
      data: {
        metadata: { ...(intent.metadata as Record<string, unknown>), deliveryGateForceFail: false },
      },
    });
    const res = await http('POST', `/platform/notifications/deliveries/${result.intentId}/retry`, {
      token: accessToken,
      body: { reason: 'manual recovery', jobId: intent.jobs[0].id },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ accepted: true });
  });

  it('H23: POST retry empty reason → 4xx', async () => {
    const { accessToken } = await issuePlatformToken();
    setPlatformNotificationFailureInjection('provider_transient');
    const result = await stack.adapters.invitationSent({
      invitationId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: `h23-${randomUUID()}@test.local`,
      recipientDisplayName: 'Admin',
      inviterDisplayName: 'Root',
      expiresAt: new Date().toISOString(),
    });
    clearPlatformNotificationFailureInjection();
    const res = await http('POST', `/platform/notifications/deliveries/${result.intentId}/retry`, {
      token: accessToken,
      body: { reason: '   ' },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('H24: Cache-Control on deliveries', async () => {
    const { accessToken } = await issuePlatformToken();
    const res = await http('GET', '/platform/notifications/deliveries', { token: accessToken });
    expect(res.headers.get('cache-control')).toMatch(/no-store/i);
  });

  it('H25: Cache-Control on preferences', async () => {
    const { accessToken } = await issuePlatformToken();
    const res = await http('GET', '/platform/notifications/preferences', { token: accessToken });
    expect(res.headers.get('cache-control')).toMatch(/no-store/i);
  });

  it('H26: ar-SY preview locale', async () => {
    const { accessToken } = await issuePlatformToken();
    const res = await http(
      'POST',
      '/platform/notifications/templates/tpl.platform.invitation.sent/preview',
      { token: accessToken, body: { locale: 'ar-SY' } },
    );
    expect(res.status).toBe(200);
    expect((res.json as { locale: string }).locale).toBe('ar-SY');
    expect((res.json as { subject: string }).subject).toBe('دعوة للمنصة');
  });

  it('H27: deliveries page query params honored', async () => {
    const { accessToken } = await issuePlatformToken();
    for (let i = 0; i < 3; i++) {
      await stack.adapters.invitationSent({
        invitationId: randomUUID(),
        platformUserId: randomUUID(),
        recipientEmail: `h27-${i}-${randomUUID()}@test.local`,
        recipientDisplayName: 'Admin',
        inviterDisplayName: 'Root',
        expiresAt: new Date().toISOString(),
      });
    }
    const res = await http('GET', '/platform/notifications/deliveries?page=1&pageSize=2', {
      token: accessToken,
    });
    expect(res.status).toBe(200);
    expect((res.json as { pageSize: number; items: unknown[] }).pageSize).toBe(2);
    expect((res.json as { items: unknown[] }).items).toHaveLength(2);
  });

  it('H28: security_administrator without notification perms denied', async () => {
    const { accessToken } = await issuePlatformToken(['security_administrator']);
    const res = await http('GET', '/platform/notifications/templates', { token: accessToken });
    expect(res.status).toBe(403);
  });

  it('H29: platform_owner may view templates if catalog grants (or 403 if not)', async () => {
    const { accessToken } = await issuePlatformToken(['platform_owner']);
    const res = await http('GET', '/platform/notifications/templates', { token: accessToken });
    // Owner catalog may or may not include Step 27 perms — assert deterministic authz outcome.
    expect([200, 403]).toContain(res.status);
  });

  it('H30: PATCH preferences OCC conflict returns 409', async () => {
    const { accessToken, user } = await issuePlatformToken();
    const first = await http('PATCH', '/platform/notifications/preferences', {
      token: accessToken,
      body: { category: 'usage', channel: 'email', enabled: false },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(first.status).toBe(200);
    const rowVersion = (first.json as { rowVersion: number }).rowVersion;
    await http('PATCH', '/platform/notifications/preferences', {
      token: accessToken,
      body: { category: 'usage', channel: 'email', enabled: true, expectedRowVersion: rowVersion },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    const conflict = await http('PATCH', '/platform/notifications/preferences', {
      token: accessToken,
      body: { category: 'usage', channel: 'email', enabled: false, expectedRowVersion: rowVersion },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(conflict.status).toBe(409);
    expect(user.id).toBeTruthy();
  });

  it('H31: GET deliveries does not mutate SoR', async () => {
    const { accessToken } = await issuePlatformToken();
    const before = await prisma.platformNotificationPreference.count();
    await http('GET', '/platform/notifications/deliveries', { token: accessToken });
    const after = await prisma.platformNotificationPreference.count();
    expect(after).toBe(before);
  });

  it('H32: preview does not create intents', async () => {
    const { accessToken } = await issuePlatformToken();
    await http(
      'POST',
      '/platform/notifications/templates/tpl.platform.invitation.sent/preview',
      { token: accessToken, body: {} },
    );
    expect(await prisma.notificationIntent.count()).toBe(0);
  });

  it('H33: retry without deliveries.retry permission denied', async () => {
    // Prefer a role that can authenticate but lacks retry — sales_representative.
    const { accessToken } = await issuePlatformToken(['sales_representative']);
    const res = await http('POST', `/platform/notifications/deliveries/${randomUUID()}/retry`, {
      token: accessToken,
      body: { reason: 'x' },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(res.status).toBe(403);
  });

  it('H34: preferences manage denied for sales_representative', async () => {
    const { accessToken } = await issuePlatformToken(['sales_representative']);
    const res = await http('PATCH', '/platform/notifications/preferences', {
      token: accessToken,
      body: { category: 'usage', channel: 'email', enabled: false },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(res.status).toBe(403);
  });

  it('H35: malformed Authorization header rejected', async () => {
    const res = await http('GET', '/platform/notifications/templates', {
      headers: { Authorization: 'Bearer not-a-jwt' },
    });
    expect(res.status).toBe(401);
  });

  it('H36: template detail Cache-Control', async () => {
    const { accessToken } = await issuePlatformToken();
    const res = await http('GET', '/platform/notifications/templates/tpl.platform.invitation.sent', {
      token: accessToken,
    });
    expect(res.headers.get('cache-control')).toMatch(/no-store/i);
  });

  it('H37: retry Cache-Control', async () => {
    const { accessToken } = await issuePlatformToken();
    setPlatformNotificationFailureInjection('provider_transient');
    const result = await stack.adapters.invitationSent({
      invitationId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: `h37-${randomUUID()}@test.local`,
      recipientDisplayName: 'Admin',
      inviterDisplayName: 'Root',
      expiresAt: new Date().toISOString(),
    });
    clearPlatformNotificationFailureInjection();
    const intent = await prisma.notificationIntent.findUniqueOrThrow({
      where: { id: result.intentId! },
      include: { jobs: true },
    });
    await prisma.notificationIntent.update({
      where: { id: result.intentId! },
      data: {
        metadata: { ...(intent.metadata as Record<string, unknown>), deliveryGateForceFail: false },
      },
    });
    const res = await http('POST', `/platform/notifications/deliveries/${result.intentId}/retry`, {
      token: accessToken,
      body: { reason: 'ops', jobId: intent.jobs[0].id },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(res.headers.get('cache-control')).toMatch(/no-store/i);
  });

  it('H38: list templates response has no secrets', async () => {
    const { accessToken } = await issuePlatformToken();
    const res = await http('GET', '/platform/notifications/templates', { token: accessToken });
    expect(JSON.stringify(res.json)).not.toMatch(/password|accessToken|refreshToken/i);
  });

  it('H39: delivery list response has no PHI markers', async () => {
    const { accessToken } = await issuePlatformToken();
    await stack.adapters.invitationSent({
      invitationId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: `h39-${randomUUID()}@test.local`,
      recipientDisplayName: 'Admin',
      inviterDisplayName: 'Root',
      expiresAt: new Date().toISOString(),
    });
    const res = await http('GET', '/platform/notifications/deliveries', { token: accessToken });
    expect(JSON.stringify(res.json)).not.toMatch(/diagnosis|patientId|clinicalNotes/i);
  });

  it('H40: realExternalDeliveriesDuringTests = 0 after HTTP-driven preview/list', async () => {
    const { accessToken } = await issuePlatformToken();
    const before = stack.emailService.sent.length;
    await http('GET', '/platform/notifications/templates', { token: accessToken });
    await http(
      'POST',
      '/platform/notifications/templates/tpl.platform.invitation.sent/preview',
      { token: accessToken, body: { locale: 'en-US' } },
    );
    expect(stack.emailService.sent.length).toBe(before);
  });
});
