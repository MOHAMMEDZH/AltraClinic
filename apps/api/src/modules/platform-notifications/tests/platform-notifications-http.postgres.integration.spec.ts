/**
 * Flexible Step 27 — real Passport HTTP matrix H01–H50 (gate semantics).
 * Real Nest app + real JwtStrategy/JwtAuthGuard/PlatformPermissionGuard over the real controller;
 * only the outbound email provider is substituted (recording sink).
 */
import { type INestApplication } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { AddressInfo } from 'net';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';
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
  diffSoR,
  ensureSentinel,
  JWT_CFG,
  NOTIFICATIONS_ADMIN_ROLE,
  platformDbSecurityEnabled,
  protectedNotificationsSoR,
  setPlatformNotificationFailureInjection,
} from './platform-notifications-db.harness';
import { PLATFORM_NOTIFICATION_PERMISSIONS } from '../platform-notifications.constants';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

const PHI_MARKERS = /diagnosis|patientId|patientName|clinicalNotes|mrn\b/i;
const SECRET_MARKERS = /password|accessToken|refreshToken|smtp|sendgrid|mailgun|api[_-]?key|secret/i;
const STEP28_MARKERS = /hardeningRun|releaseGate|step28|step29/i;

describeDb('Step 27 notifications HTTP H01-H50 (PostgreSQL)', () => {
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
    await app.listen(0);
    const addr = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterEach(async () => {
    jest.restoreAllMocks();
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

  async function dispatchInvitation(email = `h-${randomUUID()}@test.local`) {
    return stack.adapters.invitationSent({
      invitationId: randomUUID(),
      platformUserId: randomUUID(),
      recipientEmail: email,
      recipientDisplayName: 'Admin',
      inviterDisplayName: 'Root',
      expiresAt: new Date().toISOString(),
    });
  }

  /** Dispatches with a forced transient failure so a retryable job exists, then clears the outage. */
  async function dispatchRetryableInvitation() {
    setPlatformNotificationFailureInjection('provider_transient');
    const result = await dispatchInvitation();
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
    return { intentId: result.intentId!, jobId: intent.jobs[0].id };
  }

  it('H01: authorized template catalog read — platform_administrator gets the full code-defined catalog', async () => {
    const { accessToken } = await issuePlatformToken();
    const res = await http('GET', '/platform/notifications/templates', { token: accessToken });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.json)).toBe(true);
    expect((res.json as unknown[]).length).toBe(24);
    const first = (res.json as Array<{ key: string; version: string }>)[0];
    expect(first.key).toMatch(/^tpl\.platform\./);
    expect(first.version).toBe('step27.v1');
  });

  it('H02: unauthenticated request is rejected (401, no catalog leak)', async () => {
    const res = await http('GET', '/platform/notifications/templates');
    expect(res.status).toBe(401);
    expect(JSON.stringify(res.json)).not.toMatch(/tpl\.platform\./);
  });

  it('H03: Clinic principal denied on the Platform notifications surface', async () => {
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
        type: 'access',
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
        type: 'access',
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

  it('H06: expired token rejected (401)', async () => {
    const { user, session } = await issuePlatformToken();
    const token = jwtService.sign(
      {
        type: 'access',
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

  it('H07: revoked session (blacklisted JTI) rejected', async () => {
    const { accessToken } = await issuePlatformToken();
    const payload = JSON.parse(
      Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf8'),
    ) as { jti?: string };
    expect(payload.jti).toBeTruthy();
    blacklistedJtis.add(payload.jti!);
    const res = await http('GET', '/platform/notifications/templates', { token: accessToken });
    expect([401, 403]).toContain(res.status);
  });

  it('H08: suspended Platform user is denied even with a structurally valid JWT (authz re-reads PlatformUser.canAuthenticate; documented actual = 403)', async () => {
    const { accessToken, user } = await issuePlatformToken();
    const before = await http('GET', '/platform/notifications/templates', { token: accessToken });
    expect(before.status).toBe(200);

    await prisma.platformUser.update({
      where: { id: user.id },
      data: { status: 'suspended', suspendedAt: new Date(), isActive: false },
    });

    const after = await http('GET', '/platform/notifications/templates', { token: accessToken });
    // The JWT itself is still cryptographically valid and un-blacklisted; the *authorization*
    // stage resolves zero effective permissions for a suspended account and fails closed.
    expect(after.status).toBe(403);
    expect(JSON.stringify(after.json)).not.toMatch(/tpl\.platform\./);
  });

  it('H09: missing permission denied — an authenticated platform role without notification permissions gets 403', async () => {
    const { accessToken } = await issuePlatformToken(['sales_representative']);
    const res = await http('GET', '/platform/notifications/templates', { token: accessToken });
    expect(res.status).toBe(403);
  });

  it('H10: authorized preference read returns the caller-scoped preference list', async () => {
    const { accessToken } = await issuePlatformToken();
    const res = await http('GET', '/platform/notifications/preferences', { token: accessToken });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.json)).toBe(true);
  });

  it('H11: authorized preference mutation persists an optional-category change', async () => {
    const { accessToken } = await issuePlatformToken();
    const res = await http('PATCH', '/platform/notifications/preferences', {
      token: accessToken,
      body: { category: 'usage', channel: 'email', enabled: false },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ category: 'usage', channel: 'email', enabled: false });
    expect(await prisma.platformNotificationPreference.count()).toBe(1);
  });

  it('H12: mandatory-notification disable attempt denied (403, nothing persisted)', async () => {
    const { accessToken } = await issuePlatformToken();
    const res = await http('PATCH', '/platform/notifications/preferences', {
      token: accessToken,
      body: { category: 'security', channel: 'email', enabled: false },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(res.status).toBe(403);
    expect(
      await prisma.platformNotificationPreference.count({ where: { category: 'security' } }),
    ).toBe(0);
  });

  it('H13: role-name bypass denied — role membership without notification permissions never authorizes', async () => {
    for (const roleKeys of [['sales_representative'], ['security_administrator']]) {
      const { accessToken } = await issuePlatformToken(roleKeys);
      const templates = await http('GET', '/platform/notifications/templates', { token: accessToken });
      const prefs = await http('PATCH', '/platform/notifications/preferences', {
        token: accessToken,
        body: { category: 'usage', channel: 'email', enabled: false },
        headers: { 'Idempotency-Key': randomUUID() },
      });
      expect(templates.status).toBe(403);
      expect(prefs.status).toBe(403);
    }
  });

  it('H14: wildcard-intent bypass denied → N/A — no wildcard permission exists; the guard requires the exact dotted permission keys', async () => {
    for (const value of Object.values(PLATFORM_NOTIFICATION_PERMISSIONS)) {
      expect(value).toMatch(/^notifications\.[a-z]+\.[a-z]+$/);
      expect(value).not.toContain('*');
    }
    const controllerSource = readFileSync(
      resolve(__dirname, '../api/platform-notifications.controller.ts'),
      'utf8',
    );
    const declared = controllerSource.match(/@RequirePlatformPermission\(([^)]+)\)/g) ?? [];
    expect(declared.length).toBeGreaterThanOrEqual(7);
    expect(
      declared.every((d) => d.includes('PLATFORM_NOTIFICATION_PERMISSIONS.')),
    ).toBe(true);
    // A role with unrelated platform permissions still cannot reach any Step 27 route.
    const { accessToken } = await issuePlatformToken(['sales_manager']);
    for (const path of [
      '/platform/notifications/templates',
      '/platform/notifications/preferences',
      '/platform/notifications/deliveries',
    ]) {
      expect((await http('GET', path, { token: accessToken })).status).toBe(403);
    }
  });

  it('H15: template preview authorized for templates.view (no separate manage permission)', async () => {
    const { accessToken } = await issuePlatformToken();
    const res = await http(
      'POST',
      '/platform/notifications/templates/tpl.platform.invitation.sent/preview',
      { token: accessToken, body: { locale: 'en-US' } },
    );
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ templateKey: 'tpl.platform.invitation.sent', locale: 'en-US' });
  });

  it('H16: preview uses safe synthetic data only (sample_ variables, no PHI/secret markers, no intent created)', async () => {
    const { accessToken } = await issuePlatformToken();
    const res = await http(
      'POST',
      '/platform/notifications/templates/tpl.platform.invitation.sent/preview',
      { token: accessToken, body: { locale: 'en-US' } },
    );
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.json);
    expect(body).toMatch(/sample_/);
    expect(body).not.toMatch(PHI_MARKERS);
    expect(body).not.toMatch(SECRET_MARKERS);
    expect(await prisma.notificationIntent.count()).toBe(0);
  });

  it('H17: delivery list authorized — dispatched Step 27 intents are listed with their template key', async () => {
    const { accessToken } = await issuePlatformToken();
    await dispatchInvitation(`h17-${randomUUID()}@test.local`);
    const res = await http('GET', '/platform/notifications/deliveries?pageSize=10', {
      token: accessToken,
    });
    expect(res.status).toBe(200);
    expect((res.json as { total: number }).total).toBe(1);
    expect((res.json as { items: Array<{ templateKey: string }> }).items[0].templateKey).toBe(
      'tpl.platform.invitation.sent',
    );
  });

  it('H18: delivery direct-ID read is scope-enforced (own Step 27 intent 200; anything outside that scope 404)', async () => {
    const { accessToken } = await issuePlatformToken();
    const result = await dispatchInvitation(`h18-${randomUUID()}@test.local`);
    const ok = await http('GET', `/platform/notifications/deliveries/${result.intentId}`, {
      token: accessToken,
    });
    expect(ok.status).toBe(200);
    expect((ok.json as { id: string }).id).toBe(result.intentId);

    const outOfScope = await http('GET', `/platform/notifications/deliveries/${randomUUID()}`, {
      token: accessToken,
    });
    expect(outOfScope.status).toBe(404);
  });

  it('H19: retry authorized with reason + Idempotency-Key', async () => {
    const { accessToken } = await issuePlatformToken();
    const { intentId, jobId } = await dispatchRetryableInvitation();
    const res = await http('POST', `/platform/notifications/deliveries/${intentId}/retry`, {
      token: accessToken,
      body: { reason: 'manual recovery', jobId },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ accepted: true });
  });

  it('H20: retry reason is required (blank reason → 4xx, no requeue)', async () => {
    const { accessToken } = await issuePlatformToken();
    const { intentId, jobId } = await dispatchRetryableInvitation();
    const res = await http('POST', `/platform/notifications/deliveries/${intentId}/retry`, {
      token: accessToken,
      body: { reason: '   ', jobId },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect((await prisma.deliveryJob.findUniqueOrThrow({ where: { id: jobId } })).status).toBe(
      'pending',
    );
  });

  it('H21: step-up required → N/A — no Step 27 route declares a step-up/MFA re-auth requirement (permission + Idempotency-Key only)', async () => {
    const controllerSource = readFileSync(
      resolve(__dirname, '../api/platform-notifications.controller.ts'),
      'utf8',
    );
    expect(controllerSource).not.toMatch(/StepUp|step_up|stepUpVerifiedAt|RequireMfa/i);
    // Consequence: a normal (non step-up) session performs the highest-privilege Step 27 mutation.
    const { accessToken } = await issuePlatformToken();
    const { intentId, jobId } = await dispatchRetryableInvitation();
    const res = await http('POST', `/platform/notifications/deliveries/${intentId}/retry`, {
      token: accessToken,
      body: { reason: 'no step-up required', jobId },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(res.status).toBe(200);
  });

  it('H22: OCC conflict on preference mutation returns 409 for a stale expectedRowVersion', async () => {
    const { accessToken } = await issuePlatformToken();
    const first = await http('PATCH', '/platform/notifications/preferences', {
      token: accessToken,
      body: { category: 'usage', channel: 'email', enabled: false },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(first.status).toBe(200);
    const rowVersion = (first.json as { rowVersion: number }).rowVersion;
    const second = await http('PATCH', '/platform/notifications/preferences', {
      token: accessToken,
      body: { category: 'usage', channel: 'email', enabled: true, expectedRowVersion: rowVersion },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(second.status).toBe(200);
    expect((second.json as { rowVersion: number }).rowVersion).toBeGreaterThan(rowVersion);

    const conflict = await http('PATCH', '/platform/notifications/preferences', {
      token: accessToken,
      body: { category: 'usage', channel: 'email', enabled: false, expectedRowVersion: rowVersion },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(conflict.status).toBe(409);
  });

  it('H23: deterministic pagination — repeated identical page requests return identical ordered ids', async () => {
    const { accessToken } = await issuePlatformToken();
    for (let i = 0; i < 3; i++) {
      await dispatchInvitation(`h23-${i}-${randomUUID()}@test.local`);
    }
    const first = await http('GET', '/platform/notifications/deliveries?page=1&pageSize=2', {
      token: accessToken,
    });
    const repeat = await http('GET', '/platform/notifications/deliveries?page=1&pageSize=2', {
      token: accessToken,
    });
    const page2 = await http('GET', '/platform/notifications/deliveries?page=2&pageSize=2', {
      token: accessToken,
    });
    const ids = (r: typeof first) => (r.json as { items: Array<{ id: string }> }).items.map((i) => i.id);

    expect(first.status).toBe(200);
    expect((first.json as { pageSize: number }).pageSize).toBe(2);
    expect(ids(first)).toHaveLength(2);
    expect(ids(repeat)).toEqual(ids(first));
    expect(ids(page2).some((id) => ids(first).includes(id))).toBe(false);
  });

  it('H24: bounded filtering — pageSize is clamped and the status filter never widens the result set', async () => {
    const { accessToken } = await issuePlatformToken();
    await dispatchInvitation(`h24-${randomUUID()}@test.local`);
    const clamped = await http('GET', '/platform/notifications/deliveries?pageSize=500', {
      token: accessToken,
    });
    expect(clamped.status).toBe(200);
    expect((clamped.json as { pageSize: number }).pageSize).toBe(100);

    const status = (clamped.json as { items: Array<{ status: string }> }).items[0]?.status;
    expect(status).toBeTruthy();
    const filtered = await http(
      'GET',
      `/platform/notifications/deliveries?status=${encodeURIComponent(status!)}`,
      { token: accessToken },
    );
    expect(filtered.status).toBe(200);
    expect(
      (filtered.json as { items: Array<{ status: string }> }).items.every((i) => i.status === status),
    ).toBe(true);

    const noMatch = await http('GET', '/platform/notifications/deliveries?status=not_a_status', {
      token: accessToken,
    });
    expect(noMatch.status).toBe(200);
    expect((noMatch.json as { total: number }).total).toBe(0);
  });

  it('H25: no existence oracle — an unauthorized caller gets the same 403 for an existing and a missing delivery id', async () => {
    const { accessToken: adminToken } = await issuePlatformToken();
    const existing = await dispatchInvitation(`h25-${randomUUID()}@test.local`);
    const authorized404 = await http('GET', `/platform/notifications/deliveries/${randomUUID()}`, {
      token: adminToken,
    });
    expect(authorized404.status).toBe(404);

    const { accessToken: deniedToken } = await issuePlatformToken(['sales_representative']);
    const deniedExisting = await http(
      'GET',
      `/platform/notifications/deliveries/${existing.intentId}`,
      { token: deniedToken },
    );
    const deniedMissing = await http('GET', `/platform/notifications/deliveries/${randomUUID()}`, {
      token: deniedToken,
    });
    expect(deniedExisting.status).toBe(403);
    expect(deniedMissing.status).toBe(403);
    expect((deniedExisting.json as { message?: string }).message).toBe(
      (deniedMissing.json as { message?: string }).message,
    );
  });

  it('H26: infrastructure error is reported safely (no stack trace, driver text or connection string)', async () => {
    const { accessToken } = await issuePlatformToken();
    setPlatformNotificationFailureInjection('preference_lookup');
    const res = await http('GET', '/platform/notifications/preferences', { token: accessToken });
    clearPlatformNotificationFailureInjection();

    expect(res.status).toBeGreaterThanOrEqual(400);
    const body = JSON.stringify(res.json);
    expect(body).not.toMatch(/at Object\.|\.ts:\d+|node_modules|prisma|postgres|databaseUrl/i);
    expect(body).not.toMatch(SECRET_MARKERS);
  });

  it('H27: no PHI / secrets / tokens in any authorized response body', async () => {
    const { accessToken } = await issuePlatformToken();
    await dispatchInvitation(`h27-${randomUUID()}@test.local`);
    const bodies = [
      await http('GET', '/platform/notifications/templates', { token: accessToken }),
      await http('GET', '/platform/notifications/preferences', { token: accessToken }),
      await http('GET', '/platform/notifications/deliveries', { token: accessToken }),
    ].map((r) => JSON.stringify(r.json));

    for (const body of bodies) {
      expect(body).not.toMatch(PHI_MARKERS);
      expect(body).not.toMatch(SECRET_MARKERS);
      expect(body).not.toContain(accessToken);
    }
  });

  it('H28: provider credentials are absent from every response (no SMTP host / API key / sender secret)', async () => {
    const { accessToken } = await issuePlatformToken();
    const result = await dispatchInvitation(`h28-${randomUUID()}@test.local`);
    const detail = await http('GET', `/platform/notifications/deliveries/${result.intentId}`, {
      token: accessToken,
    });
    const list = await http('GET', '/platform/notifications/deliveries', { token: accessToken });
    for (const res of [detail, list]) {
      expect(JSON.stringify(res.json)).not.toMatch(
        /smtp|sendgrid|mailgun|resend|api[_-]?key|providerSecret/i,
      );
    }
  });

  it('H29: passive read preserves session state (no rotation, revocation or authzRevision bump)', async () => {
    const { accessToken, user, session } = await issuePlatformToken();
    const before = await prisma.platformRefreshToken.findFirstOrThrow({
      where: { sessionId: session.sessionId },
    });
    const userBefore = await prisma.platformUser.findUniqueOrThrow({ where: { id: user.id } });

    expect((await http('GET', '/platform/notifications/deliveries', { token: accessToken })).status).toBe(200);
    expect((await http('GET', '/platform/notifications/templates', { token: accessToken })).status).toBe(200);

    const after = await prisma.platformRefreshToken.findFirstOrThrow({
      where: { sessionId: session.sessionId },
    });
    expect(after.revokedAt).toBeNull();
    expect(after.tokenHash).toBe(before.tokenHash);
    expect(
      (await prisma.platformUser.findUniqueOrThrow({ where: { id: user.id } })).authzRevision,
    ).toBe(userBefore.authzRevision);
  });

  it('H30: the application service is never invoked after an authorization denial', async () => {
    const listSpy = jest.spyOn(stack.query, 'listDeliveries');
    const retrySpy = jest.spyOn(stack.query, 'retryDelivery');
    const { accessToken } = await issuePlatformToken(['sales_representative']);

    expect((await http('GET', '/platform/notifications/deliveries', { token: accessToken })).status).toBe(403);
    expect(
      (
        await http('POST', `/platform/notifications/deliveries/${randomUUID()}/retry`, {
          token: accessToken,
          body: { reason: 'ops' },
          headers: { 'Idempotency-Key': randomUUID() },
        })
      ).status,
    ).toBe(403);

    expect(listSpy).not.toHaveBeenCalled();
    expect(retrySpy).not.toHaveBeenCalled();
  });

  it('H31: zero business side effects after a denial (no SoR mutation, no preference row, no intent)', async () => {
    const { accessToken } = await issuePlatformToken(['sales_representative']);
    const sorBefore = await protectedNotificationsSoR(prisma);
    const prefsBefore = await prisma.platformNotificationPreference.count();
    const intentsBefore = await prisma.notificationIntent.count();

    await http('PATCH', '/platform/notifications/preferences', {
      token: accessToken,
      body: { category: 'usage', channel: 'email', enabled: false },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    await http('GET', '/platform/notifications/deliveries', { token: accessToken });

    const delta = diffSoR(sorBefore, await protectedNotificationsSoR(prisma));
    expect(Object.values(delta).every((v) => v === 0)).toBe(true);
    expect(await prisma.platformNotificationPreference.count()).toBe(prefsBefore);
    expect(await prisma.notificationIntent.count()).toBe(intentsBefore);
  });

  const eventSafeMetadataCases: Array<{
    id: string;
    canonical: string;
    dispatch: (email: string) => Promise<{ intentId?: string }>;
    templateKey: string;
    extraAssert?: (ctx: {
      resJson: unknown;
      metadata: Record<string, unknown>;
      intentId: string;
      email: string;
    }) => Promise<void> | void;
  }> = [
    {
      id: 'H32',
      canonical: 'invitation message metadata safe',
      templateKey: 'tpl.platform.invitation.sent',
      dispatch: (email) => dispatchInvitation(email),
    },
    {
      id: 'H33',
      canonical: 'MFA alert metadata safe',
      templateKey: 'tpl.platform.mfa.security_alert',
      dispatch: (email) =>
        stack.adapters.mfaSecurityAlert({
          alertId: randomUUID(),
          platformUserId: randomUUID(),
          recipientEmail: email,
          recipientDisplayName: 'Admin',
          alertSummary: 'new device login',
          occurredAt: new Date().toISOString(),
        }),
    },
    {
      id: 'H34',
      canonical: 'lifecycle event delivery status safe',
      templateKey: 'tpl.platform.tenant.lifecycle',
      dispatch: (email) =>
        stack.adapters.lifecycleTransition({
          platformTenantId: randomUUID(),
          organizationName: 'Acme',
          fromState: 'ACTIVE',
          toState: 'SUSPENDED',
          occurredAt: new Date().toISOString(),
          recipientPlatformUserId: randomUUID(),
          recipientEmail: email,
        }),
    },
    {
      id: 'H35',
      canonical: 'Trial warning status safe',
      templateKey: 'tpl.platform.trial.approaching_expiry',
      dispatch: (email) =>
        stack.adapters.trialExpiry({
          approaching: true,
          trialId: randomUUID(),
          organizationName: 'Acme',
          expiryDate: new Date().toISOString(),
          planVersionId: randomUUID(),
          windowKey: 'd7',
          recipientPlatformUserId: randomUUID(),
          recipientEmail: email,
        }),
    },
    {
      id: 'H36',
      canonical: 'Subscription warning status safe',
      templateKey: 'tpl.platform.subscription.approaching_expiry',
      dispatch: (email) =>
        stack.adapters.subscriptionEvent({
          kind: 'approaching',
          configId: randomUUID(),
          organizationName: 'Acme',
          expiryDate: new Date().toISOString(),
          planVersionId: randomUUID(),
          windowKey: 'd7',
          recipientPlatformUserId: randomUUID(),
          recipientEmail: email,
        }),
    },
    {
      id: 'H37',
      canonical: 'Add-on warning status safe',
      templateKey: 'tpl.platform.addon.approaching_expiry',
      dispatch: (email) =>
        stack.adapters.addOnExpiry({
          approaching: true,
          assignmentId: randomUUID(),
          organizationName: 'Acme',
          addOnLabel: 'addon.telehealth',
          addOnVersionId: randomUUID(),
          expiryDate: new Date().toISOString(),
          windowKey: 'd7',
          recipientPlatformUserId: randomUUID(),
          recipientEmail: email,
        }),
    },
    {
      id: 'H38',
      canonical: 'Override warning status safe',
      templateKey: 'tpl.platform.override.approaching_expiry',
      dispatch: (email) =>
        stack.adapters.overrideExpiry({
          approaching: true,
          overrideId: randomUUID(),
          organizationName: 'Acme',
          overrideLabel: 'SALES_CONCESSION',
          expiryDate: new Date().toISOString(),
          windowKey: 'd7',
          recipientPlatformUserId: randomUUID(),
          recipientEmail: email,
        }),
    },
    {
      id: 'H39',
      canonical: 'effective-limit alert provenance safe',
      templateKey: 'tpl.platform.limit.warning',
      dispatch: (email) =>
        stack.adapters.limitAlert({
          level: 'warning',
          evidenceId: randomUUID(),
          organizationName: 'Acme',
          limitKey: 'sms_monthly',
          effectiveLimit: '1000',
          currentUsage: '820',
          thresholdPercent: '82',
          limitProvenance: 'PLAN',
          windowKey: 'default',
          recipientPlatformUserId: randomUUID(),
          recipientEmail: email,
        }),
      extraAssert: async ({ resJson, metadata, intentId, email }) => {
        expect(metadata.sourceType).toBe('platform_usage_limit_evidence');
        expect(String(metadata.eventKey)).toMatch(/limit\.warning/);
        const payload = JSON.stringify(resJson);
        expect(payload).toMatch(/provenance\s+PLAN/i);
        expect(payload).toMatch(/effective\s+1000/i);
        const intent = await prisma.notificationIntent.findUniqueOrThrow({ where: { id: intentId } });
        expect(intent.body).toMatch(/provenance\s+PLAN/i);
        expect(intent.body).toMatch(/effective\s+1000/i);
        const sent = stack.emailService.sent.find((m) => m.to === email);
        expect(sent?.text).toMatch(/provenance\s+PLAN/i);
        expect(sent?.text).toMatch(/limitProvenance|PLAN/i);
      },
    },
    {
      id: 'H40',
      canonical: 'compatibility notification safe',
      templateKey: 'tpl.platform.compatibility.issue',
      dispatch: (email) =>
        stack.adapters.compatibilityIssue({
          resultId: randomUUID(),
          organizationName: 'Acme',
          issueSummary: 'module/specialty mismatch',
          ruleReference: 'RULE-1',
          recipientPlatformUserId: randomUUID(),
          recipientEmail: email,
        }),
    },
    {
      id: 'H41',
      canonical: 'provisioning failure sanitized',
      templateKey: 'tpl.platform.provisioning.failure',
      dispatch: (email) =>
        stack.adapters.provisioning({
          recovered: false,
          operationId: randomUUID(),
          organizationName: 'Acme',
          operationReference: 'op-41',
          failureClass: 'timeout',
          at: new Date().toISOString(),
          recipientPlatformUserId: randomUUID(),
          recipientEmail: email,
        }),
      extraAssert: ({ resJson }) => {
        const payload = JSON.stringify(resJson);
        expect(payload).toMatch(/timeout/);
        expect(payload).not.toMatch(/at Object\.|\.ts:\d+|stack trace/i);
      },
    },
    {
      id: 'H42',
      canonical: 'sales reminder scoped',
      templateKey: 'tpl.platform.sales.lead_next_action',
      dispatch: (email) =>
        stack.adapters.leadNextActionReminder({
          leadId: randomUUID(),
          leadReference: 'LEAD-42',
          organizationName: 'Acme',
          nextActionDate: new Date().toISOString(),
          nextActionType: 'call',
          windowKey: 'd1',
          ownerPlatformUserId: randomUUID(),
          recipientEmail: email,
        }),
      extraAssert: ({ metadata, email }) => {
        expect(metadata.sourceType).toBe('platform_sales_lead');
        expect(metadata.recipientEmail).toBe(email);
        expect(String(metadata.eventKey)).toMatch(/sales\.lead_next_action/);
      },
    },
    {
      id: 'H43',
      canonical: 'manager alert scoped',
      templateKey: 'tpl.platform.sales.manager_ops',
      dispatch: (email) =>
        stack.adapters.managerAlert({
          ops: true,
          alertId: randomUUID(),
          managerPlatformUserId: randomUUID(),
          recipientEmail: email,
          managerDisplayName: 'Mgr',
          alertSummary: 'ops threshold',
          operationReference: 'op-43',
        }),
      extraAssert: ({ metadata, email }) => {
        expect(metadata.sourceType).toBe('platform_ops_alert');
        expect(metadata.recipientEmail).toBe(email);
        expect(String(metadata.eventKey)).toMatch(/sales\.manager_ops/);
      },
    },
  ];

  for (const testCase of eventSafeMetadataCases) {
    it(`${testCase.id}: ${testCase.canonical} — event-safe metadata delivery readable over HTTP with sanitized metadata only`, async () => {
      const { accessToken } = await issuePlatformToken();
      const email = `${testCase.id.toLowerCase()}-${randomUUID()}@test.local`;
      const result = await testCase.dispatch(email);
      expect(result.intentId).toBeTruthy();

      const res = await http('GET', `/platform/notifications/deliveries/${result.intentId}`, {
        token: accessToken,
      });
      expect(res.status).toBe(200);
      const body = JSON.stringify(res.json);
      const metadata = (res.json as { metadata: Record<string, unknown> }).metadata;
      expect(metadata.templateKey).toBe(testCase.templateKey);
      expect(metadata.step27).toBe(true);
      expect(body).not.toMatch(PHI_MARKERS);
      expect(body).not.toMatch(SECRET_MARKERS);
      expect(body).not.toMatch(STEP28_MARKERS);
      await testCase.extraAssert?.({
        resJson: res.json,
        metadata,
        intentId: result.intentId!,
        email,
      });
    });
  }

  it('H44: preferences cannot cross principal scope (mutating another platform user is denied)', async () => {
    const { accessToken } = await issuePlatformToken();
    const other = await createPlatformUserFixture(prisma, {
      email: `h44-other-${randomUUID()}@test.local`,
    });
    const res = await http('PATCH', '/platform/notifications/preferences', {
      token: accessToken,
      body: { platformUserId: other.id, category: 'usage', channel: 'email', enabled: false },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(res.status).toBe(403);
    expect(
      await prisma.platformNotificationPreference.count({ where: { platformUserId: other.id } }),
    ).toBe(0);
  });

  it('H45: retry does not duplicate the logical delivery (same intent, same single email)', async () => {
    const { accessToken } = await issuePlatformToken();
    setPlatformNotificationFailureInjection('provider_transient');
    const email = `h45-${randomUUID()}@test.local`;
    const dispatched = await dispatchInvitation(email);
    clearPlatformNotificationFailureInjection();
    const intent = await prisma.notificationIntent.findUniqueOrThrow({
      where: { id: dispatched.intentId! },
      include: { jobs: true },
    });
    await prisma.notificationIntent.update({
      where: { id: dispatched.intentId! },
      data: {
        metadata: { ...(intent.metadata as Record<string, unknown>), deliveryGateForceFail: false },
      },
    });

    const res = await http('POST', `/platform/notifications/deliveries/${dispatched.intentId}/retry`, {
      token: accessToken,
      body: { reason: 'single logical delivery', jobId: intent.jobs[0].id },
      headers: { 'Idempotency-Key': randomUUID() },
    });

    expect(res.status).toBe(200);
    expect(await prisma.notificationIntent.count()).toBe(1);
    expect(await prisma.deliveryJob.count({ where: { intentId: dispatched.intentId! } })).toBe(1);
    expect(stack.emailService.sent.filter((m) => m.to === email)).toHaveLength(1);
  });

  it('H46: missing template / unknown key fails safely (4xx, no catalog enumeration in the error)', async () => {
    const { accessToken } = await issuePlatformToken();
    const detail = await http('GET', '/platform/notifications/templates/tpl.platform.does_not_exist', {
      token: accessToken,
    });
    const preview = await http(
      'POST',
      '/platform/notifications/templates/tpl.platform.does_not_exist/preview',
      { token: accessToken, body: { locale: 'en-US' } },
    );
    for (const res of [detail, preview]) {
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      expect(JSON.stringify(res.json)).not.toMatch(/tpl\.platform\.invitation\.sent/);
    }
  });

  it('H47: unknown locale is handled safely (deterministic en-US fallback, no renderer crash)', async () => {
    const { accessToken } = await issuePlatformToken();
    const enUs = await http(
      'POST',
      '/platform/notifications/templates/tpl.platform.invitation.sent/preview',
      { token: accessToken, body: { locale: 'en-US' } },
    );
    const unknown = await http(
      'POST',
      '/platform/notifications/templates/tpl.platform.invitation.sent/preview',
      { token: accessToken, body: { locale: 'zz-ZZ' } },
    );
    expect(enUs.status).toBe(200);
    expect([200, 400]).toContain(unknown.status);
    if (unknown.status === 200) {
      expect((unknown.json as { subject: string }).subject).toBe(
        (enUs.json as { subject: string }).subject,
      );
    }
    expect(JSON.stringify(unknown.json)).not.toMatch(/at Object\.|\.ts:\d+/);
  });

  it('H48: no raw message secret in the delivery response (rendered body carries no credentials or raw tokens)', async () => {
    const { accessToken } = await issuePlatformToken();
    const result = await dispatchInvitation(`h48-${randomUUID()}@test.local`);
    const res = await http('GET', `/platform/notifications/deliveries/${result.intentId}`, {
      token: accessToken,
    });
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.json);
    expect(body).not.toMatch(/rawInviteToken|bearer |authorization|mfaSeed|encryptionKey/i);
    expect(body).not.toMatch(SECRET_MARKERS);
  });

  it('H49: no Step 28 endpoint or surface is exposed by the Step 27 controller', async () => {
    const { accessToken } = await issuePlatformToken();
    for (const path of [
      '/platform/notifications/hardening',
      '/platform/notifications/release-gate',
      '/platform/notifications/step28',
    ]) {
      const res = await http('GET', path, { token: accessToken });
      expect(res.status).toBe(404);
    }
    const templates = await http('GET', '/platform/notifications/templates', { token: accessToken });
    expect(JSON.stringify(templates.json)).not.toMatch(STEP28_MARKERS);
  });

  it('H50: error bodies are safe and shaped (statusCode/code/message only, no stack or internals)', async () => {
    const { accessToken } = await issuePlatformToken();
    const notFound = await http('GET', `/platform/notifications/deliveries/${randomUUID()}`, {
      token: accessToken,
    });
    expect(notFound.status).toBe(404);
    const body = notFound.json as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['code', 'message', 'statusCode']);
    expect(JSON.stringify(body)).not.toMatch(/at Object\.|\.ts:\d+|node_modules|stack/i);
  });

  it('HTTP headers: every Step 27 route responds with Cache-Control private, no-store', async () => {
    const { accessToken } = await issuePlatformToken();
    const result = await dispatchInvitation(`h-cache-${randomUUID()}@test.local`);
    const responses = [
      await http('GET', '/platform/notifications/templates', { token: accessToken }),
      await http('GET', '/platform/notifications/templates/tpl.platform.invitation.sent', {
        token: accessToken,
      }),
      await http('GET', '/platform/notifications/preferences', { token: accessToken }),
      await http('GET', '/platform/notifications/deliveries', { token: accessToken }),
      await http('GET', `/platform/notifications/deliveries/${result.intentId}`, {
        token: accessToken,
      }),
    ];
    for (const res of responses) {
      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toMatch(/private/i);
      expect(res.headers.get('cache-control')).toMatch(/no-store/i);
    }
  });

  it('HTTP idempotency: mutating routes require an Idempotency-Key header', async () => {
    const { accessToken } = await issuePlatformToken();
    const { intentId, jobId } = await dispatchRetryableInvitation();
    const prefs = await http('PATCH', '/platform/notifications/preferences', {
      token: accessToken,
      body: { category: 'usage', channel: 'email', enabled: false },
    });
    const retry = await http('POST', `/platform/notifications/deliveries/${intentId}/retry`, {
      token: accessToken,
      body: { reason: 'ops', jobId },
    });
    expect(prefs.status).toBeGreaterThanOrEqual(400);
    expect(retry.status).toBeGreaterThanOrEqual(400);
  });

  it('HTTP locale: ar-SY preview renders the Arabic catalog entry', async () => {
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

  it('HTTP validation: malformed and foreign-signed bearer tokens are rejected', async () => {
    const malformed = await http('GET', '/platform/notifications/templates', {
      headers: { Authorization: 'Bearer not-a-jwt' },
    });
    expect(malformed.status).toBe(401);

    const { user, session } = await issuePlatformToken();
    const foreignSigned = jwtService.sign(
      {
        type: 'access',
        sub: user.id,
        tenantId: null,
        roles: [NOTIFICATIONS_ADMIN_ROLE],
        sessionId: session.sessionId,
        sessionClass: 'platform',
        principalType: 'platform',
        aud: 'platform',
        iss: 'booking-platform',
      },
      { secret: 'a-different-secret-not-used-by-the-app-x', expiresIn: 900 },
    );
    expect(
      (await http('GET', '/platform/notifications/templates', { token: foreignSigned })).status,
    ).toBe(401);
  });

  it('HTTP delivery counters: HTTP-driven reads and retries never perform a real external delivery', async () => {
    const { accessToken } = await issuePlatformToken();
    const { intentId, jobId } = await dispatchRetryableInvitation();
    await http('GET', '/platform/notifications/templates', { token: accessToken });
    await http(
      'POST',
      '/platform/notifications/templates/tpl.platform.invitation.sent/preview',
      { token: accessToken, body: { locale: 'en-US' } },
    );
    await http('POST', `/platform/notifications/deliveries/${intentId}/retry`, {
      token: accessToken,
      body: { reason: 'counter check', jobId },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(stack.emailService.realExternalDeliveriesDuringTests).toBe(0);
    expect(stack.emailService.sent.every((m) => m.to.endsWith('@test.local'))).toBe(true);
  });

  it('HTTP empty state: an authorized deliveries read with no data returns a deterministic empty page', async () => {
    const { accessToken } = await issuePlatformToken();
    const res = await http('GET', '/platform/notifications/deliveries', { token: accessToken });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ page: 1, total: 0, items: [] });
  });
});
