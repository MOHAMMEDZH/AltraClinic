/**
 * Flexible Step 25 — narrow Passport HTTP closure H25–H50 for /platform/sales/trials.
 * Real production Passport/JWT/session/RBAC wiring (same stack as H01–H24).
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
import { PlatformSalesTrialsController } from '../api/platform-sales-trials.controller';
import { TrialAdminService } from '../application/trial-admin.service';
import { TrialConversionService } from '../application/trial-conversion.service';
import { TrialEntitlementPreviewService } from '../application/trial-entitlement-preview.service';
import { TRIAL_CONVERSION_OUTBOX_EVENT_TYPE } from '../platform-sales-trials.constants';
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
  createRepProfile,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  deletePlanVersionFixtures,
  diffSnapshots,
  JWT_CFG,
  platformDbSecurityEnabled,
  protectedSoRSnapshot,
  resolveCatalogKeys,
  SALES_MANAGER_ROLE,
  SALES_REP_ROLE,
  setSalesTrialsFailureInjection,
  type TrialCatalogKeys,
} from './sales-trials-db.harness';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;
const DAY_MS = 86_400_000;
const UNSAFE_BODY = /password|accessToken|refreshToken|secret|stack/i;
const UNSAFE_ERROR = /password|token|secret|stack/i;

describeDb('Step 25 Trial HTTP H25–H50 (PostgreSQL)', () => {
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
    clearSalesTrialsFailureInjection();
    await app?.close();
  });

  async function issuePlatformToken(roleKeys: string[] = [SALES_MANAGER_ROLE]) {
    const user = await createPlatformUserFixture(prisma, {
      email: `trial-h25-${randomUUID()}@test.local`,
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

  function createBody(overrides: Record<string, unknown> = {}) {
    return {
      organizationName: 'HTTP H25 Trial Clinic',
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
    return res.json as {
      id: string;
      rowVersion: number;
      status: string;
      platformTenantId: string | null;
      attributionSnapshot: unknown;
      organizationName: string;
    };
  }

  async function expireTrial(trialId: string) {
    const future = createSalesTrialsStack(prisma, {
      clock: () => new Date(Date.now() + 5 * DAY_MS),
    });
    const run = await future.expiry.processDueTrials(10);
    expect(run.expired).toBeGreaterThanOrEqual(1);
    expect(run.trialIds).toContain(trialId);
  }

  async function tenantIdForTrial(platformTenantId: string) {
    return (
      await prisma.platformTenant.findUniqueOrThrow({ where: { id: platformTenantId } })
    ).tenantId;
  }

  // Clinic-audience deny smoke (wiring parity with H02; keep available for deny cases).
  it('H25: no existence oracle — foreign-owner vs missing id return same not_found status', async () => {
    const manager = await issuePlatformToken([SALES_MANAGER_ROLE]);
    const otherRep = await issuePlatformToken([SALES_REP_ROLE]);
    const otherProfile = await createRepProfile(prisma, otherRep.user.id);
    const trial = await createTrialViaHttp(manager.accessToken, {
      organizationName: 'OracleTrialOrg',
      ownerRepresentativeId: otherProfile.id,
    });

    const accessor = await issuePlatformToken([SALES_REP_ROLE]);
    await createRepProfile(prisma, accessor.user.id);

    const clinicToken = jwtService.sign(
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
    const clinicDenied = await http('GET', `/platform/sales/trials/${trial.id}`, {
      token: clinicToken,
    });
    expect([401, 403]).toContain(clinicDenied.status);

    const missing = await http('GET', `/platform/sales/trials/${randomUUID()}`, {
      token: accessor.accessToken,
    });
    const foreign = await http('GET', `/platform/sales/trials/${trial.id}`, {
      token: accessor.accessToken,
    });
    expect(missing.status).toBe(404);
    expect(foreign.status).toBe(404);
    expect(foreign.status).toBe(missing.status);
    expect(JSON.stringify(foreign.json)).not.toMatch(/OracleTrialOrg/i);
  });

  it('H26: safe infrastructure error — injected failure surfaces without stack/secrets', async () => {
    const { accessToken } = await issuePlatformToken();
    setSalesTrialsFailureInjection('after_audit_staging_before_commit');
    const res = await http('POST', '/platform/sales/trials', {
      token: accessToken,
      body: createBody({ organizationName: 'InjectFail Clinic' }),
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(600);
    expect(JSON.stringify(res.json)).not.toMatch(UNSAFE_BODY);
  });

  it('H27: no PHI/secrets/tokens — successful create/get JSON omits secret patterns', async () => {
    const { accessToken } = await issuePlatformToken();
    const created = await createTrialViaHttp(accessToken);
    const detail = await http('GET', `/platform/sales/trials/${created.id}`, {
      token: accessToken,
    });
    expect(detail.status).toBe(200);
    expect(JSON.stringify(created)).not.toMatch(/password|accessToken|refreshToken|secret/i);
    expect(JSON.stringify(detail.json)).not.toMatch(/password|accessToken|refreshToken|secret/i);
  });

  it('H28: exact Trial-create replay — same Idempotency-Key → same id; trial count=1', async () => {
    const { accessToken } = await issuePlatformToken();
    const key = randomUUID();
    const body = createBody({ organizationName: 'H28 Replay Clinic' });
    const a = await http('POST', '/platform/sales/trials', {
      token: accessToken,
      body,
      headers: { 'Idempotency-Key': key },
    });
    const b = await http('POST', '/platform/sales/trials', {
      token: accessToken,
      body,
      headers: { 'Idempotency-Key': key },
    });
    expect([200, 201]).toContain(a.status);
    expect([200, 201]).toContain(b.status);
    expect((b.json as { id: string }).id).toBe((a.json as { id: string }).id);
    expect(await prisma.platformSalesTrial.count()).toBe(1);
  });

  it('H29: conflicting create replay — same key different org name → 409 idempotency_conflict', async () => {
    const { accessToken } = await issuePlatformToken();
    const key = randomUUID();
    await http('POST', '/platform/sales/trials', {
      token: accessToken,
      body: createBody({ organizationName: 'H29 A' }),
      headers: { 'Idempotency-Key': key },
    });
    const conflict = await http('POST', '/platform/sales/trials', {
      token: accessToken,
      body: createBody({ organizationName: 'H29 B' }),
      headers: { 'Idempotency-Key': key },
    });
    expect(conflict.status).toBe(409);
    expect(conflict.json).toMatchObject({ code: 'idempotency_conflict' });
  });

  it('H30: extension authorization — token without trial.extend → 403 on POST .../extend', async () => {
    const manager = await issuePlatformToken([SALES_MANAGER_ROLE]);
    const trial = await createTrialViaHttp(manager.accessToken);
    const rep = await issuePlatformToken([SALES_REP_ROLE]);
    await createRepProfile(prisma, rep.user.id);
    const res = await http('POST', `/platform/sales/trials/${trial.id}/extend`, {
      token: rep.accessToken,
      body: { extensionDays: 5, reason: 'no extend perm', expectedRowVersion: trial.rowVersion },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(res.status).toBe(403);
  });

  it('H31: extension cap enforcement — extend beyond maxExtensions via HTTP → 4xx policy error', async () => {
    const { accessToken } = await issuePlatformToken();
    const trial = await createTrialViaHttp(accessToken, { maxExtensions: 1 });
    const first = await http('POST', `/platform/sales/trials/${trial.id}/extend`, {
      token: accessToken,
      body: { extensionDays: 3, reason: 'budget 1', expectedRowVersion: trial.rowVersion },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect([200, 201]).toContain(first.status);
    const denied = await http('POST', `/platform/sales/trials/${trial.id}/extend`, {
      token: accessToken,
      body: {
        extensionDays: 3,
        reason: 'over budget',
        expectedRowVersion: (first.json as { rowVersion: number }).rowVersion,
      },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(denied.status).toBeGreaterThanOrEqual(400);
    expect(denied.status).toBeLessThan(500);
    expect(denied.json).toMatchObject({ code: 'max_extensions_reached' });
  });

  it('H32: extension exact replay — same key twice → one history row', async () => {
    const { accessToken } = await issuePlatformToken();
    const trial = await createTrialViaHttp(accessToken);
    const key = randomUUID();
    const body = {
      extensionDays: 4,
      reason: 'h32 replay',
      expectedRowVersion: trial.rowVersion,
    };
    const a = await http('POST', `/platform/sales/trials/${trial.id}/extend`, {
      token: accessToken,
      body,
      headers: { 'Idempotency-Key': key },
    });
    const b = await http('POST', `/platform/sales/trials/${trial.id}/extend`, {
      token: accessToken,
      body,
      headers: { 'Idempotency-Key': key },
    });
    expect([200, 201]).toContain(a.status);
    expect([200, 201]).toContain(b.status);
    expect(
      await prisma.platformSalesTrialExtensionHistory.count({ where: { trialId: trial.id } }),
    ).toBe(1);
  });

  it('H33: stale OCC — PATCH stale rowVersion → 409', async () => {
    const { accessToken } = await issuePlatformToken();
    const trial = await createTrialViaHttp(accessToken);
    const res = await http('PATCH', `/platform/sales/trials/${trial.id}`, {
      token: accessToken,
      body: { organizationName: 'H33 Stale', expectedRowVersion: trial.rowVersion - 1 },
    });
    expect(res.status).toBe(409);
    expect(res.json).toMatchObject({ code: 'row_version_conflict' });
  });

  it('H34: expiry state visible — expire via service stack; GET detail shows EXPIRED', async () => {
    const { accessToken } = await issuePlatformToken();
    const trial = await createTrialViaHttp(accessToken, { durationDays: 1 });
    await expireTrial(trial.id);
    const detail = await http('GET', `/platform/sales/trials/${trial.id}`, { token: accessToken });
    expect(detail.status).toBe(200);
    expect((detail.json as { status: string }).status).toBe('EXPIRED');
  });

  it('H35: expired access enforced independently — EER canUseModule denies after expiry', async () => {
    const { accessToken } = await issuePlatformToken();
    const trial = await createTrialViaHttp(accessToken, { durationDays: 1 });
    const tenantId = await tenantIdForTrial(trial.platformTenantId!);
    const before = await stack.eer.canUseModule(tenantId, keys.moduleKeys[0]);
    expect(before.allowed).toBe(true);

    await expireTrial(trial.id);
    const after = await stack.eer.canUseModule(tenantId, keys.moduleKeys[0]);
    expect(after.allowed).toBe(false);

    const reloaded = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    const convert = await http('POST', `/platform/sales/trials/${trial.id}/convert`, {
      token: accessToken,
      body: {
        targetPaidPlanVersionId: paidPlanVersionId,
        expectedRowVersion: reloaded.rowVersion,
      },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(convert.status).toBeGreaterThanOrEqual(400);
    expect(convert.status).toBeLessThan(500);
  });

  it('H36: comparison preview read-only — GET entitlement-preview; protectedSoRSnapshot delta all 0', async () => {
    const { accessToken } = await issuePlatformToken();
    const trial = await createTrialViaHttp(accessToken);
    const before = await protectedSoRSnapshot(prisma);
    const res = await http(
      'GET',
      `/platform/sales/trials/${trial.id}/entitlement-preview?targetPaidPlanVersionId=${paidPlanVersionId}`,
      { token: accessToken },
    );
    expect(res.status).toBe(200);
    const delta = diffSnapshots(before, await protectedSoRSnapshot(prisma));
    for (const value of Object.values(delta)) {
      expect(value).toBe(0);
    }
  });

  it('H37: target paid Plan Version published — POST convert with published paid PV → 200 CONVERTED', async () => {
    const { accessToken } = await issuePlatformToken();
    const trial = await createTrialViaHttp(accessToken);
    const res = await http('POST', `/platform/sales/trials/${trial.id}/convert`, {
      token: accessToken,
      body: {
        targetPaidPlanVersionId: paidPlanVersionId,
        expectedRowVersion: trial.rowVersion,
        reason: 'h37 signed',
      },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect([200, 201]).toContain(res.status);
    expect(res.json).toMatchObject({ status: 'CONVERTED' });
  });

  it('H38: draft paid version denied — convert via HTTP → 4xx', async () => {
    const { accessToken } = await issuePlatformToken();
    const trial = await createTrialViaHttp(accessToken);
    const draft = await createPlanVersionFixture(prisma, { lifecycle: 'DRAFT', paid: true });
    const res = await http('POST', `/platform/sales/trials/${trial.id}/convert`, {
      token: accessToken,
      body: {
        targetPaidPlanVersionId: draft.planVersionId,
        expectedRowVersion: trial.rowVersion,
      },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(res.json).toMatchObject({ code: 'plan_version_not_published' });
  });

  it('H39: conversion exact replay — same Idempotency-Key → same conversion; count=1', async () => {
    const { accessToken } = await issuePlatformToken();
    const trial = await createTrialViaHttp(accessToken);
    const key = randomUUID();
    const body = {
      targetPaidPlanVersionId: paidPlanVersionId,
      expectedRowVersion: trial.rowVersion,
    };
    const a = await http('POST', `/platform/sales/trials/${trial.id}/convert`, {
      token: accessToken,
      body,
      headers: { 'Idempotency-Key': key },
    });
    const b = await http('POST', `/platform/sales/trials/${trial.id}/convert`, {
      token: accessToken,
      body,
      headers: { 'Idempotency-Key': key },
    });
    expect([200, 201]).toContain(a.status);
    expect([200, 201]).toContain(b.status);
    expect((b.json as { conversion: { id: string } }).conversion.id).toBe(
      (a.json as { conversion: { id: string } }).conversion.id,
    );
    expect(await prisma.platformSalesTrialConversion.count({ where: { trialId: trial.id } })).toBe(
      1,
    );
  });

  it('H40: conversion conflicting replay — same key different targetPaidPlanVersionId → 409', async () => {
    const { accessToken } = await issuePlatformToken();
    const trial = await createTrialViaHttp(accessToken);
    const otherPaid = await createPlanVersionFixture(prisma, {
      paid: true,
      moduleKeys: keys.moduleKeys.slice(0, 2),
      specialtyKeys: keys.specialtyKeys.slice(0, 2),
    });
    const key = randomUUID();
    const first = await http('POST', `/platform/sales/trials/${trial.id}/convert`, {
      token: accessToken,
      body: {
        targetPaidPlanVersionId: paidPlanVersionId,
        expectedRowVersion: trial.rowVersion,
      },
      headers: { 'Idempotency-Key': key },
    });
    expect([200, 201]).toContain(first.status);
    const conflict = await http('POST', `/platform/sales/trials/${trial.id}/convert`, {
      token: accessToken,
      body: {
        targetPaidPlanVersionId: otherPaid.planVersionId,
        expectedRowVersion: trial.rowVersion,
      },
      headers: { 'Idempotency-Key': key },
    });
    expect(conflict.status).toBe(409);
    expect(conflict.json).toMatchObject({ code: 'idempotency_conflict' });
  });

  it('H41: trial-only Add-on disposition required — HTTP convert without disposition → 4xx', async () => {
    const { accessToken } = await issuePlatformToken();
    // DTO supports trialOnlyGrants; seed via HTTP create then convert.
    const trial = await createTrialViaHttp(accessToken, {
      trialOnlyGrants: [{ grantKey: 'addon.trial_boost', kind: 'ADD_ON', trialOnly: true }],
    });
    const res = await http('POST', `/platform/sales/trials/${trial.id}/convert`, {
      token: accessToken,
      body: {
        targetPaidPlanVersionId: paidPlanVersionId,
        expectedRowVersion: trial.rowVersion,
      },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(res.json).toMatchObject({ code: 'disposition_required' });
  });

  it('H42: trial-only Override disposition required — HTTP convert without disposition → 4xx', async () => {
    const { accessToken } = await issuePlatformToken();
    const trial = await createTrialViaHttp(accessToken, {
      trialOnlyGrants: [
        { grantKey: 'override.trial_discount', kind: 'OVERRIDE', trialOnly: true },
      ],
    });
    const res = await http('POST', `/platform/sales/trials/${trial.id}/convert`, {
      token: accessToken,
      body: {
        targetPaidPlanVersionId: paidPlanVersionId,
        expectedRowVersion: trial.rowVersion,
      },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(res.json).toMatchObject({ code: 'disposition_required' });
  });

  it('H43: attribution retained — convert via HTTP; attributionSnapshotJson unchanged', async () => {
    const { accessToken } = await issuePlatformToken();
    const trial = await createTrialViaHttp(accessToken);
    const before = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    const res = await http('POST', `/platform/sales/trials/${trial.id}/convert`, {
      token: accessToken,
      body: {
        targetPaidPlanVersionId: paidPlanVersionId,
        expectedRowVersion: trial.rowVersion,
      },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect([200, 201]).toContain(res.status);
    const after = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    expect(after.attributionSnapshotJson).toEqual(before.attributionSnapshotJson);
  });

  it('H44: provisioning handoff idempotent — create replay via HTTP; one platformTenant for trial slug', async () => {
    const { accessToken } = await issuePlatformToken();
    const key = randomUUID();
    const body = createBody({ organizationName: 'H44 Provision Clinic' });
    const a = await http('POST', '/platform/sales/trials', {
      token: accessToken,
      body,
      headers: { 'Idempotency-Key': key },
    });
    const b = await http('POST', '/platform/sales/trials', {
      token: accessToken,
      body,
      headers: { 'Idempotency-Key': key },
    });
    expect([200, 201]).toContain(a.status);
    expect([200, 201]).toContain(b.status);
    expect((b.json as { id: string }).id).toBe((a.json as { id: string }).id);
    const trialId = (a.json as { id: string }).id;
    const expectedSlug = `trial-${trialId.replace(/-/g, '').slice(0, 16)}`;
    const tenants = await prisma.tenant.findMany({ where: { slug: { startsWith: 'trial-' } } });
    expect(tenants).toHaveLength(1);
    expect(tenants[0].slug).toBe(expectedSlug);
    expect(
      await prisma.platformTenant.count({ where: { tenantId: tenants[0].id } }),
    ).toBe(1);
    expect(await prisma.platformSalesTrial.count()).toBe(1);
  });

  it('H45: lifecycle handoff correct — convert via HTTP; PlatformTenant ACTIVE, trialEndsAt null', async () => {
    const { accessToken } = await issuePlatformToken();
    const trial = await createTrialViaHttp(accessToken);
    const res = await http('POST', `/platform/sales/trials/${trial.id}/convert`, {
      token: accessToken,
      body: {
        targetPaidPlanVersionId: paidPlanVersionId,
        expectedRowVersion: trial.rowVersion,
      },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect([200, 201]).toContain(res.status);
    const platformTenant = await prisma.platformTenant.findUniqueOrThrow({
      where: { id: trial.platformTenantId! },
    });
    expect(platformTenant.status).toBe('ACTIVE');
    expect(platformTenant.trialEndsAt).toBeNull();
  });

  it('H46: conversion event durable — outbox count=1 after HTTP convert', async () => {
    const { accessToken } = await issuePlatformToken();
    const trial = await createTrialViaHttp(accessToken);
    await http('POST', `/platform/sales/trials/${trial.id}/convert`, {
      token: accessToken,
      body: {
        targetPaidPlanVersionId: paidPlanVersionId,
        expectedRowVersion: trial.rowVersion,
      },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(
      await prisma.outboxEvent.count({
        where: { aggregateId: trial.id, eventType: TRIAL_CONVERSION_OUTBOX_EVENT_TYPE },
      }),
    ).toBe(1);
  });

  it('H47: conversion creates no duplicate Subscription — commercial current configs = 1', async () => {
    const { accessToken } = await issuePlatformToken();
    const trial = await createTrialViaHttp(accessToken);
    await http('POST', `/platform/sales/trials/${trial.id}/convert`, {
      token: accessToken,
      body: {
        targetPaidPlanVersionId: paidPlanVersionId,
        expectedRowVersion: trial.rowVersion,
      },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(
      await prisma.platformSubscriptionCommercialConfig.count({
        where: { platformTenantId: trial.platformTenantId!, isCurrent: true },
      }),
    ).toBe(1);
  });

  it('H48: conversion EER reflects paid state — SNAPSHOT with paid specialties', async () => {
    const { accessToken } = await issuePlatformToken();
    const trial = await createTrialViaHttp(accessToken);
    await http('POST', `/platform/sales/trials/${trial.id}/convert`, {
      token: accessToken,
      body: {
        targetPaidPlanVersionId: paidPlanVersionId,
        expectedRowVersion: trial.rowVersion,
      },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    const tenantId = await tenantIdForTrial(trial.platformTenantId!);
    const bundle = await createSalesTrialsStack(prisma).eer.resolveEffectiveEntitlements(tenantId);
    expect(bundle.source).toBe('SNAPSHOT');
    expect(bundle.specialties).toContain(keys.specialtyKeys[2]);
  });

  it('H49: expired Trial cannot regain Trial access through retry/conversion edge cases', async () => {
    const { accessToken } = await issuePlatformToken();
    const trial = await createTrialViaHttp(accessToken, { durationDays: 1 });
    const tenantId = await tenantIdForTrial(trial.platformTenantId!);
    await expireTrial(trial.id);

    const reloaded = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    const convert = await http('POST', `/platform/sales/trials/${trial.id}/convert`, {
      token: accessToken,
      body: {
        targetPaidPlanVersionId: paidPlanVersionId,
        expectedRowVersion: reloaded.rowVersion,
      },
      headers: { 'Idempotency-Key': randomUUID() },
    });
    expect(convert.status).toBeGreaterThanOrEqual(400);
    expect(convert.status).toBeLessThan(500);

    const denied = await stack.eer.canUseModule(tenantId, keys.moduleKeys[0]);
    expect(denied.allowed).toBe(false);
  });

  it('H50: safe error body — validation error (missing idempotency) has no stack/password/token', async () => {
    const { accessToken } = await issuePlatformToken();
    const res = await http('POST', '/platform/sales/trials', {
      token: accessToken,
      body: createBody(),
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ code: 'idempotency_required' });
    expect(JSON.stringify(res.json)).not.toMatch(UNSAFE_ERROR);
  });
});
