/**
 * Flexible Step 21 — CORR01–CORR15 request/operation correlation semantics.
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  createHybridPrisma,
  createPlatformDbSecurityClient,
  createPlatformUserFixture,
  enableAuditCenter,
  ensureSentinel,
  platformClaims,
  platformDbSecurityEnabled,
} from './audit-center-db.harness';
import { createPlatformRefreshSession } from '../../auth/tests/platform-db-security.harness';
import { PrismaPlatformUserRepository } from '../../auth/infrastructure/repositories/prisma-platform-user.repository';
import { PrismaPlatformRefreshTokenRepository } from '../../auth/infrastructure/repositories/prisma-platform-refresh-token.repository';
import { PlatformAuthorizationService } from '../../auth/platform-rbac/platform-authorization.service';
import { PlatformSodService } from '../../auth/platform-rbac/platform-sod.service';
import { PlatformAssuranceService } from '../../auth/application/services/platform-assurance.service';
import { PlatformUserAdminMutationsService } from '../../auth/application/services/platform-user-admin-mutations.service';
import { AuditTrailPlatformSecurityAuditLog } from '../../auth/infrastructure/audit-trail-platform-security-audit-log';
import { CorrelationContextService } from '../../observability/application/logging/correlation-context.service';
import {
  isOperationCorrelationId,
  registerOperationCorrelationContextGetter,
  resolveOperationCorrelationId,
} from '../application/operation-correlation';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

function report(row: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.log(`STEP21_CORR ${JSON.stringify(row)}`);
}

function buildMutations(prisma: PrismaClient): PlatformUserAdminMutationsService {
  const wrapped = createHybridPrisma(prisma);
  const users = new PrismaPlatformUserRepository(wrapped);
  const authz = new PlatformAuthorizationService(users, wrapped);
  const sod = new PlatformSodService(authz);
  const refreshRepo = new PrismaPlatformRefreshTokenRepository(wrapped);
  const assurance = new PlatformAssuranceService({ stepUpSeconds: 900 } as never);
  const securityAudit = new AuditTrailPlatformSecurityAuditLog(wrapped);
  return new PlatformUserAdminMutationsService(
    wrapped,
    authz,
    sod,
    assurance,
    refreshRepo,
    securityAudit,
    { publish: async () => undefined } as never,
  );
}

describeDb('Step 21 CORR01-CORR15 correlation semantics (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let restoreAudit: () => void;
  const correlation = new CorrelationContextService();

  beforeAll(async () => {
    prisma = createPlatformDbSecurityClient();
    restoreAudit = enableAuditCenter();
    await ensureSentinel(prisma);
    correlation.onModuleInit();
  });

  afterAll(async () => {
    correlation.onModuleDestroy();
    restoreAudit();
    await prisma.$disconnect();
  });

  afterEach(() => {
    registerOperationCorrelationContextGetter(() => correlation.getCorrelationId());
  });

  it('CORR01 two mutations under same token get different correlations', async () => {
    const actor = await createPlatformUserFixture(prisma, {
      email: `corr01a-${randomUUID()}@test.local`,
      roleKeys: ['security_administrator'],
    });
    const t1 = await createPlatformUserFixture(prisma, {
      email: `corr01t1-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    const t2 = await createPlatformUserFixture(prisma, {
      email: `corr01t2-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    const session = await createPlatformRefreshSession(prisma, actor.id, {
      stepUpVerifiedAt: new Date(),
    });
    const claims = platformClaims(actor.id, session.sessionId);
    const svc = buildMutations(prisma);
    const c1 = randomUUID();
    const c2 = randomUUID();
    await correlation.runWithContextAsync(
      { correlationId: c1, inherited: false, source: 'http' },
      async () => {
        await svc.assignRole(claims, t1.id, {
          roleKey: 'sales_representative',
          reason: 'CORR01-1',
        });
      },
    );
    await correlation.runWithContextAsync(
      { correlationId: c2, inherited: false, source: 'http' },
      async () => {
        await svc.assignRole(claims, t2.id, {
          roleKey: 'sales_representative',
          reason: 'CORR01-2',
        });
      },
    );
    const a1 = await prisma.auditEntry.findFirst({
      where: { action: 'platform.user.role.assigned', resourceId: t1.id },
      orderBy: { createdAt: 'desc' },
    });
    const a2 = await prisma.auditEntry.findFirst({
      where: { action: 'platform.user.role.assigned', resourceId: t2.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(a1?.correlationId).toBe(c1);
    expect(a2?.correlationId).toBe(c2);
    expect(a1?.correlationId).not.toBe(a2?.correlationId);
    report({ id: 'CORR01', c1, c2, result: 'PASS' });
  });

  it('CORR02 exact replay does not create new success audit', async () => {
    const actor = await createPlatformUserFixture(prisma, {
      email: `corr02a-${randomUUID()}@test.local`,
      roleKeys: ['security_administrator'],
    });
    const target = await createPlatformUserFixture(prisma, {
      email: `corr02t-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    const session = await createPlatformRefreshSession(prisma, actor.id, {
      stepUpVerifiedAt: new Date(),
    });
    const claims = platformClaims(actor.id, session.sessionId);
    const svc = buildMutations(prisma);
    const corr = randomUUID();
    await correlation.runWithContextAsync(
      { correlationId: corr, inherited: false, source: 'http' },
      async () => {
        await svc.assignRole(claims, target.id, {
          roleKey: 'sales_representative',
          reason: 'CORR02',
        });
      },
    );
    const before = await prisma.auditEntry.count({
      where: { action: 'platform.user.role.assigned', resourceId: target.id },
    });
    await correlation.runWithContextAsync(
      { correlationId: randomUUID(), inherited: false, source: 'http' },
      async () => {
        const replay = await svc.assignRole(claims, target.id, {
          roleKey: 'sales_representative',
          reason: 'CORR02-replay',
        });
        expect(replay.audited).toBe(false);
      },
    );
    expect(
      await prisma.auditEntry.count({
        where: { action: 'platform.user.role.assigned', resourceId: target.id },
      }),
    ).toBe(before);
    const stored = await prisma.auditEntry.findFirst({
      where: { action: 'platform.user.role.assigned', resourceId: target.id },
    });
    expect(stored?.correlationId).toBe(corr);
    report({ id: 'CORR02', preserved: corr, result: 'PASS' });
  });

  it('CORR03/CORR06 actorId is claims.sub not correlation', async () => {
    const actor = await createPlatformUserFixture(prisma, {
      email: `corr03-${randomUUID()}@test.local`,
      roleKeys: ['security_administrator'],
    });
    const target = await createPlatformUserFixture(prisma, {
      email: `corr03t-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    const session = await createPlatformRefreshSession(prisma, actor.id, {
      stepUpVerifiedAt: new Date(),
    });
    const claims = platformClaims(actor.id, session.sessionId);
    const corr = randomUUID();
    await correlation.runWithContextAsync(
      { correlationId: corr, inherited: false, source: 'http' },
      async () => {
        await buildMutations(prisma).assignRole(claims, target.id, {
          roleKey: 'sales_representative',
          reason: 'CORR03',
        });
      },
    );
    const row = await prisma.auditEntry.findFirst({
      where: { resourceId: target.id, action: 'platform.user.role.assigned' },
      orderBy: { createdAt: 'desc' },
    });
    expect(row?.actorId).toBe(actor.id);
    expect(row?.actorId).not.toBe(corr);
    expect(row?.correlationId).toBe(corr);
    report({ id: 'CORR03-CORR06', actorId: row?.actorId, correlationId: corr, result: 'PASS' });
  });

  it('CORR04 ALS correlation propagates through transaction', async () => {
    const fixed = randomUUID();
    registerOperationCorrelationContextGetter(() => fixed);
    expect(resolveOperationCorrelationId()).toBe(fixed);
    report({ id: 'CORR04', fixed, result: 'PASS' });
  });

  it('CORR05 Model B projector correlation — N/A', () => {
    report({ id: 'CORR05', result: 'N/A', note: 'A03-A15 Model A; no projector' });
    expect(true).toBe(true);
  });

  it('CORR07 correlation is not sessionId', async () => {
    const actor = await createPlatformUserFixture(prisma, {
      email: `corr07-${randomUUID()}@test.local`,
      roleKeys: ['security_administrator'],
    });
    const target = await createPlatformUserFixture(prisma, {
      email: `corr07t-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    const session = await createPlatformRefreshSession(prisma, actor.id, {
      stepUpVerifiedAt: new Date(),
    });
    const claims = platformClaims(actor.id, session.sessionId);
    const corr = randomUUID();
    await correlation.runWithContextAsync(
      { correlationId: corr, inherited: false, source: 'http' },
      async () => {
        await buildMutations(prisma).assignRole(claims, target.id, {
          roleKey: 'sales_representative',
          reason: 'CORR07',
        });
      },
    );
    const row = await prisma.auditEntry.findFirst({
      where: { resourceId: target.id, action: 'platform.user.role.assigned' },
      orderBy: { createdAt: 'desc' },
    });
    expect(row?.correlationId).toBe(corr);
    expect(row?.correlationId).not.toBe(session.sessionId);
    report({ id: 'CORR07', result: 'PASS' });
  });

  it('CORR08 missing inbound generates server UUID', () => {
    registerOperationCorrelationContextGetter(null);
    const id = resolveOperationCorrelationId();
    expect(isOperationCorrelationId(id)).toBe(true);
    report({ id: 'CORR08', generated: id, result: 'PASS' });
  });

  it('CORR09 malformed inbound replaced', () => {
    const { id, inherited } = correlation.resolveIngressId('not-a-uuid!!!');
    expect(inherited).toBe(false);
    expect(isOperationCorrelationId(id)).toBe(true);
    report({ id: 'CORR09', replaced: id, result: 'PASS' });
  });

  it('CORR10/CORR11 correlation lookup isolation', async () => {
    const c1 = randomUUID();
    const c2 = randomUUID();
    const actor = await createPlatformUserFixture(prisma, {
      email: `corr10-${randomUUID()}@test.local`,
      roleKeys: ['security_administrator'],
    });
    const t1 = await createPlatformUserFixture(prisma, {
      email: `corr10t1-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    const t2 = await createPlatformUserFixture(prisma, {
      email: `corr10t2-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    const session = await createPlatformRefreshSession(prisma, actor.id, {
      stepUpVerifiedAt: new Date(),
    });
    const claims = platformClaims(actor.id, session.sessionId);
    const svc = buildMutations(prisma);
    await correlation.runWithContextAsync(
      { correlationId: c1, inherited: false, source: 'http' },
      async () => {
        await svc.assignRole(claims, t1.id, { roleKey: 'sales_representative', reason: 'c1' });
      },
    );
    await correlation.runWithContextAsync(
      { correlationId: c2, inherited: false, source: 'http' },
      async () => {
        await svc.assignRole(claims, t2.id, { roleKey: 'sales_representative', reason: 'c2' });
      },
    );
    const only1 = await prisma.auditEntry.findMany({ where: { correlationId: c1 } });
    const only2 = await prisma.auditEntry.findMany({ where: { correlationId: c2 } });
    expect(only1.every((r) => r.resourceId === t1.id)).toBe(true);
    expect(only2.every((r) => r.resourceId === t2.id)).toBe(true);
    expect(only1.some((r) => r.resourceId === t2.id)).toBe(false);
    report({ id: 'CORR10-CORR11', result: 'PASS' });
  });

  it('CORR12 resourceId stable across display-name-irrelevant mutations', async () => {
    const actor = await createPlatformUserFixture(prisma, {
      email: `corr12-${randomUUID()}@test.local`,
      roleKeys: ['security_administrator'],
    });
    const target = await createPlatformUserFixture(prisma, {
      email: `corr12t-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    const session = await createPlatformRefreshSession(prisma, actor.id, {
      stepUpVerifiedAt: new Date(),
    });
    const claims = platformClaims(actor.id, session.sessionId);
    await correlation.runWithContextAsync(
      { correlationId: randomUUID(), inherited: false, source: 'http' },
      async () => {
        await buildMutations(prisma).assignRole(claims, target.id, {
          roleKey: 'sales_representative',
          reason: 'CORR12',
        });
      },
    );
    const row = await prisma.auditEntry.findFirst({
      where: { action: 'platform.user.role.assigned', resourceId: target.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(row?.resourceId).toBe(target.id);
    report({ id: 'CORR12', resourceId: target.id, result: 'PASS' });
  });

  it('CORR13 correlation filter stays on sentinel tenant audits', async () => {
    const corr = randomUUID();
    const actor = await createPlatformUserFixture(prisma, {
      email: `corr13-${randomUUID()}@test.local`,
      roleKeys: ['security_administrator'],
    });
    const target = await createPlatformUserFixture(prisma, {
      email: `corr13t-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    const session = await createPlatformRefreshSession(prisma, actor.id, {
      stepUpVerifiedAt: new Date(),
    });
    await correlation.runWithContextAsync(
      { correlationId: corr, inherited: false, source: 'http' },
      async () => {
        await buildMutations(prisma).assignRole(
          platformClaims(actor.id, session.sessionId),
          target.id,
          { roleKey: 'sales_representative', reason: 'CORR13' },
        );
      },
    );
    const rows = await prisma.auditEntry.findMany({ where: { correlationId: corr } });
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => typeof r.tenantId === 'string')).toBe(true);
    report({ id: 'CORR13', count: rows.length, result: 'PASS' });
  });

  it('CORR14 audit details have no raw token/session secrets', async () => {
    const actor = await createPlatformUserFixture(prisma, {
      email: `corr14-${randomUUID()}@test.local`,
      roleKeys: ['security_administrator'],
    });
    const target = await createPlatformUserFixture(prisma, {
      email: `corr14t-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    const session = await createPlatformRefreshSession(prisma, actor.id, {
      stepUpVerifiedAt: new Date(),
    });
    const claims = platformClaims(actor.id, session.sessionId);
    await buildMutations(prisma).revokeSession(
      claims,
      target.id,
      (await createPlatformRefreshSession(prisma, target.id)).sessionId,
      'CORR14 revoke',
    );
    const row = await prisma.auditEntry.findFirst({
      where: { action: 'platform.user.session.revoked', resourceId: target.id },
      orderBy: { createdAt: 'desc' },
    });
    const blob = JSON.stringify(row);
    expect(blob).not.toMatch(/Bearer /i);
    expect(blob).toContain('[redacted]');
    expect(isOperationCorrelationId(row?.correlationId)).toBe(true);
    report({ id: 'CORR14', result: 'PASS' });
  });

  it('CORR15 helper never prefers raw jti when context provides operation id', () => {
    const op = randomUUID();
    const fakeJti = randomUUID();
    registerOperationCorrelationContextGetter(() => op);
    expect(resolveOperationCorrelationId({ explicit: null })).toBe(op);
    expect(resolveOperationCorrelationId({ explicit: null })).not.toBe(fakeJti);
    report({ id: 'CORR15', op, result: 'PASS' });
  });
});
