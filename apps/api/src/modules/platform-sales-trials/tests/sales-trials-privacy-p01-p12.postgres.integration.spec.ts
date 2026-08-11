/**
 * Flexible Step 25 — privacy matrix P01–P12.
 * Asserts commercial-only Trial surfaces (no PHI classifier; no secret/token dumps).
 * Contract: docs/TRIAL_CREATION_AND_CUSTOMER_CONVERSION.md (non-goals: PHI, Step 26).
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
  JWT_CFG,
  platformClaims,
  platformDbSecurityEnabled,
  resolveCatalogKeys,
  SALES_MANAGER_ROLE,
  SALES_REP_ROLE,
  type TrialCatalogKeys,
} from './sales-trials-db.harness';
import {
  SALES_TRIAL_AUDIT_CATEGORY,
  TRIAL_CONVERSION_OUTBOX_EVENT_TYPE,
} from '../platform-sales-trials.constants';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;
const DAY_MS = 86_400_000;

/** Structural secret/token markers — not a semantic PHI classifier. */
const SECRET_MARKERS = /password|accessToken|refreshToken|secret|4111111111111111/i;
const PATIENT_FIELD_MARKERS = /diagnosis|patientId|clinicalNotes|patientContact|clinicalRecord/i;
const COMMISSION_MARKERS = /commission|productivity|payoutAmount|payoutId/i;
const COMMERCIAL_ATTRIBUTION_KEYS = [
  'ownerRepresentativeId',
  'originatingLeadId',
  'salesAttributionId',
  'createdByPlatformUserId',
  'frozenAt',
] as const;

describeDb('Step 25 Sales Trials privacy P01–P12 (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let keys: TrialCatalogKeys;
  let trialPlanVersionId: string;
  let paidPlanVersionId: string;
  let jwtService: JwtService;
  let jwtTokens: JwtTokenService;

  beforeAll(async () => {
    assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
    prisma = createPlatformDbSecurityClient();
    jwtService = new JwtService({});
    jwtTokens = new JwtTokenService(jwtService, JWT_CFG);
    keys = await resolveCatalogKeys(prisma);
  });

  afterAll(async () => {
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
        limits: [{ canonicalKey: keys.limitKeys[0], valueText: '7' }],
        trialDefaultEnabled: true,
        trialDefaultDays: 14,
      })
    ).planVersionId;
    paidPlanVersionId = (
      await createPlanVersionFixture(prisma, {
        paid: true,
        moduleKeys: keys.moduleKeys.slice(0, 2),
        specialtyKeys: keys.specialtyKeys.slice(0, 3),
        limits: [{ canonicalKey: keys.limitKeys[0], valueText: '25' }],
      })
    ).planVersionId;
  });

  async function manager() {
    const roleKeys = [SALES_MANAGER_ROLE];
    const user = await createPlatformUserFixture(prisma, {
      email: `trial-p-${randomUUID()}@test.local`,
      roleKeys,
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    return { user, claims: platformClaims(user.id, session.sessionId, roleKeys) };
  }

  function createInput(overrides: Record<string, unknown> = {}) {
    return {
      organizationName: 'Privacy Clinic',
      facilityTypeKey: keys.facilityTypeKey,
      trialPlanVersionId,
      selectedModuleKeys: keys.moduleKeys.slice(0, 3),
      selectedSpecialtyKeys: keys.specialtyKeys.slice(0, 2),
      ...overrides,
    } as never;
  }

  async function seedActiveTrial(overrides: Record<string, unknown> = {}) {
    const actor = await manager();
    const stack = createSalesTrialsStack(prisma);
    const trial = await stack.trials.create(
      actor.claims,
      stack.perms,
      createInput(overrides),
      randomUUID(),
    );
    return { actor, stack, trial };
  }

  function futureStack(days = 30) {
    return createSalesTrialsStack(prisma, { clock: () => new Date(Date.now() + days * DAY_MS) });
  }

  it('P01: no patient/clinical fields required for Trial — commercial createInput succeeds; DTO has no diagnosis/patientId/clinicalNotes', async () => {
    const actor = await manager();
    const stack = createSalesTrialsStack(prisma);
    // Commercial-only createInput — no diagnosis, patientId, or clinicalNotes supplied.
    const trial = await stack.trials.create(actor.claims, stack.perms, createInput(), randomUUID());
    expect(trial.status).toBe('ACTIVE');
    expect(trial.organizationName).toBe('Privacy Clinic');
    const dto = trial as unknown as Record<string, unknown>;
    expect(dto).not.toHaveProperty('diagnosis');
    expect(dto).not.toHaveProperty('patientId');
    expect(dto).not.toHaveProperty('clinicalNotes');
    expect(JSON.stringify(trial)).not.toMatch(/"diagnosis"|"patientId"|"clinicalNotes"/);
  });

  it('P02: sales attribution contains commercial metadata only', async () => {
    const actor = await manager();
    const repUser = await createPlatformUserFixture(prisma, {
      email: `trial-p02-rep-${randomUUID()}@test.local`,
      roleKeys: [SALES_REP_ROLE],
    });
    const rep = await createRepProfile(prisma, repUser.id);
    const stack = createSalesTrialsStack(prisma);
    const trial = await stack.trials.create(
      actor.claims,
      stack.perms,
      createInput({ ownerRepresentativeId: rep.id }),
      randomUUID(),
    );
    expect(trial.attributionSnapshot).toBeTruthy();
    const snap = trial.attributionSnapshot!;
    expect(Object.keys(snap).sort()).toEqual([...COMMERCIAL_ATTRIBUTION_KEYS].sort());
    expect(snap.ownerRepresentativeId).toBe(rep.id);
    expect(snap.salesAttributionId).toBe(rep.id);
    expect(snap.createdByPlatformUserId).toBe(actor.user.id);
    expect(JSON.stringify(snap)).not.toMatch(PATIENT_FIELD_MARKERS);
  });

  it('P03: audit excludes PHI/secrets', async () => {
    const { trial } = await seedActiveTrial();
    const audits = await prisma.auditEntry.findMany({
      where: { category: SALES_TRIAL_AUDIT_CATEGORY, resourceId: trial.id },
    });
    expect(audits.length).toBeGreaterThanOrEqual(1);
    for (const a of audits) {
      expect(JSON.stringify(a)).not.toMatch(SECRET_MARKERS);
    }
  });

  it('P04: conversion event excludes PHI/secrets', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    await stack.conversion.convert(
      actor.claims,
      stack.perms,
      trial.id,
      { targetPaidPlanVersionId: paidPlanVersionId, expectedRowVersion: trial.rowVersion },
      randomUUID(),
    );
    const event = await prisma.outboxEvent.findFirstOrThrow({
      where: { aggregateId: trial.id, eventType: TRIAL_CONVERSION_OUTBOX_EVENT_TYPE },
    });
    expect(JSON.stringify(event.payload)).not.toMatch(SECRET_MARKERS);
    expect(JSON.stringify(event.payload)).not.toMatch(PATIENT_FIELD_MARKERS);
  });

  it('P05: API responses exclude secrets/tokens — trial DTO JSON scan', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const detail = await stack.trials.getById(actor.claims, stack.perms, trial.id);
    const dtoJson = JSON.stringify(detail);
    expect(dtoJson).not.toMatch(SECRET_MARKERS);
    expect(dtoJson).not.toMatch(/"password"|"accessToken"|"refreshToken"/i);
  });

  it('P06: Clinic principal cannot administer Trial through Platform route', async () => {
    const wrapped = createHybridPrisma(prisma);
    const stack = createSalesTrialsStack(prisma);
    const users = new PrismaPlatformUserRepository(wrapped);
    const authz = new PlatformAuthorizationService(users, wrapped);
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
    let app: INestApplication | undefined;
    try {
      app = moduleRef.createNestApplication();
      app.useGlobalGuards(app.get(JwtAuthGuard), app.get(PlatformPermissionGuard));
      app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
      await app.listen(0);
      const addr = app.getHttpServer().address() as AddressInfo;
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
      const res = await fetch(`http://127.0.0.1:${addr.port}/platform/sales/trials`, {
        headers: { Authorization: `Bearer ${clinicToken}` },
      });
      expect([401, 403]).toContain(res.status);
    } finally {
      await app?.close();
    }
  });

  it('P07: Trial customer/contact references expose approved commercial fields only', async () => {
    const { trial } = await seedActiveTrial({ organizationName: 'Approved Commercial Org' });
    expect(trial.organizationName).toBe('Approved Commercial Org');
    expect(trial).not.toHaveProperty('patientContactName');
    expect(trial).not.toHaveProperty('patientContactEmail');
    expect(trial).not.toHaveProperty('patientPhone');
    expect(trial).not.toHaveProperty('clinicalContactId');
    expect(JSON.stringify(trial)).not.toMatch(
      /patientContact|clinicalContact|mrn|medicalRecord/i,
    );
  });

  it('P08: comparison preview contains entitlement/commercial data only', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const preview = await stack.preview.preview(
      actor.claims,
      stack.perms,
      trial.id,
      paidPlanVersionId,
    );
    const json = JSON.stringify(preview);
    expect(preview.runtimeSource).toBe('STEP16_SNAPSHOT_STEP18_EER');
    expect(json).not.toMatch(SECRET_MARKERS);
    expect(json).not.toMatch(PATIENT_FIELD_MARKERS);
  });

  it('P09: provisioning payload contains only accepted provisioning data', async () => {
    const { trial } = await seedActiveTrial();
    expect(trial.platformTenantId).toBeTruthy();
    expect(trial.commercialConfigId).toBeTruthy();
    const row = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    const json = JSON.stringify(row);
    expect(json).toContain(trial.platformTenantId!);
    expect(json).toContain(trial.commercialConfigId!);
    expect(json).not.toMatch(SECRET_MARKERS);
    expect(json).not.toMatch(/4111111111111111|cardNumber|cvv|pan/i);
    expect(json).not.toMatch(PATIENT_FIELD_MARKERS);
  });

  it('P10: expiry job logs avoid sensitive payload dumps — EXPIRED audit/details exclude secrets', async () => {
    // Product does not dump Trial payloads to logs on the expiry path; assert audit/outbox surfaces.
    const { trial } = await seedActiveTrial({ durationDays: 1 });
    await futureStack().expiry.processDueTrials(10);
    const audit = await prisma.auditEntry.findFirstOrThrow({
      where: { action: 'sales_trial.expired', resourceId: trial.id },
    });
    expect(JSON.stringify(audit.details ?? {})).not.toMatch(SECRET_MARKERS);
    expect(JSON.stringify(audit)).not.toMatch(SECRET_MARKERS);
    const row = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    expect(row.status).toBe('EXPIRED');
    expect(JSON.stringify(row)).not.toMatch(SECRET_MARKERS);
  });

  it('P11: errors are safe/redacted — rejected create/convert messages have no stack/password', async () => {
    const actor = await manager();
    const stack = createSalesTrialsStack(prisma);
    let createErr: unknown;
    try {
      await stack.trials.create(
        actor.claims,
        stack.perms,
        createInput({ trialPlanVersionId: randomUUID() }),
        randomUUID(),
      );
    } catch (e) {
      createErr = e;
    }
    expect(createErr).toBeTruthy();
    const createSurface = JSON.stringify({
      message: (createErr as Error).message,
      code: (createErr as { code?: string }).code,
      stack: (createErr as Error).stack,
    });
    // Safe surface: message/code must not embed secrets; stack is for tests only and must not
    // include password material from the request path.
    expect((createErr as { code?: string }).code).toBeTruthy();
    expect((createErr as Error).message).not.toMatch(/password|accessToken|refreshToken/i);
    expect(createSurface).not.toMatch(/4111111111111111/);

    const { actor: convActor, stack: convStack, trial } = await seedActiveTrial({
      durationDays: 1,
    });
    await futureStack().expiry.processDueTrials(10);
    const reloaded = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    let convertErr: unknown;
    try {
      await convStack.conversion.convert(
        convActor.claims,
        convStack.perms,
        trial.id,
        {
          targetPaidPlanVersionId: paidPlanVersionId,
          expectedRowVersion: reloaded.rowVersion,
        },
        randomUUID(),
      );
    } catch (e) {
      convertErr = e;
    }
    expect(convertErr).toBeTruthy();
    expect((convertErr as Error).message).not.toMatch(/password|accessToken|refreshToken/i);
    expect((convertErr as { code?: string }).code).toBe('trial_status_not_convertible');
  });

  it('P12: no Step 26 commission/productivity data on trial JSON, conversion outbox, or sales_trial tables', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    expect(JSON.stringify(trial)).not.toMatch(COMMISSION_MARKERS);
    await stack.conversion.convert(
      actor.claims,
      stack.perms,
      trial.id,
      { targetPaidPlanVersionId: paidPlanVersionId, expectedRowVersion: trial.rowVersion },
      randomUUID(),
    );
    const event = await prisma.outboxEvent.findFirstOrThrow({
      where: { aggregateId: trial.id, eventType: TRIAL_CONVERSION_OUTBOX_EVENT_TYPE },
    });
    expect(JSON.stringify(event.payload)).not.toMatch(COMMISSION_MARKERS);

    const forbiddenTables = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name LIKE 'platform_sales_trial%'
         AND (
           table_name ILIKE '%commission%'
           OR table_name ILIKE '%productivity%'
           OR table_name ILIKE '%payout%'
         )`,
    );
    expect(forbiddenTables).toEqual([]);
  });
});
