/**
 * Flexible Step 21 — A01/A02 Durable Audit Atomicity (Model A).
 * Independently named A01-D01–D12 and A02-D01–D12.
 */
import { randomUUID } from 'crypto';
import { NotFoundException } from '@nestjs/common';
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
import {
  PLATFORM_SECURITY_AUDIT_FAILURE_INJECTION_ENV,
  PlatformSecurityAuditInjectedFailure,
} from '../../auth/platform-security-audit.constants';
import { PLATFORM_AUDIT_SENTINEL_TENANT_ID } from '../../platform-tenants/platform-tenants.tokens';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

const ROLE_ACTION = 'platform.user.role.assigned';
const SESSION_ACTION = 'platform.user.session.revoked';
const ROLE_KEY = 'sales_representative';

function report(row: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.log(`A01_A02_DURABILITY ${JSON.stringify(row)}`);
}

function clearInjection(): void {
  delete process.env[PLATFORM_SECURITY_AUDIT_FAILURE_INJECTION_ENV];
}

function setInjection(point: string): void {
  process.env[PLATFORM_SECURITY_AUDIT_FAILURE_INJECTION_ENV] = point;
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

async function countRole(
  prisma: PrismaClient,
  userId: string,
  roleKey = ROLE_KEY,
): Promise<number> {
  return prisma.platformUserRole.count({
    where: { platformUserId: userId, roleKey, revokedAt: null },
  });
}

async function countAudits(
  prisma: PrismaClient,
  action: string,
  resourceId: string,
): Promise<number> {
  return prisma.auditEntry.count({ where: { action, resourceId } });
}

async function countActiveSessions(prisma: PrismaClient, sessionId: string): Promise<number> {
  return prisma.platformRefreshToken.count({
    where: { sessionId, revokedAt: null },
  });
}

async function actorTarget(prisma: PrismaClient, tag: string) {
  const actor = await createPlatformUserFixture(prisma, {
    email: `${tag}-actor-${randomUUID()}@test.local`,
    roleKeys: ['security_administrator'],
  });
  const target = await createPlatformUserFixture(prisma, {
    email: `${tag}-target-${randomUUID()}@test.local`,
    roleKeys: ['auditor'],
  });
  const session = await createPlatformRefreshSession(prisma, actor.id, {
    stepUpVerifiedAt: new Date(),
  });
  return { actor, target, claims: platformClaims(actor.id, session.sessionId) };
}

describeDb('Step 21 A01/A02 durable audit atomicity Model A (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let restoreAudit: () => void;

  beforeAll(async () => {
    prisma = createPlatformDbSecurityClient();
    restoreAudit = enableAuditCenter();
    await ensureSentinel(prisma);
  });

  afterAll(async () => {
    restoreAudit();
    clearInjection();
    await prisma.$disconnect();
  });

  beforeEach(() => clearInjection());
  afterEach(() => clearInjection());

  // ─── A01 ───────────────────────────────────────────────────────────────

  it('A01-D01 first success — role=1 audit=1', async () => {
    const { target, claims } = await actorTarget(prisma, 'a01d01');
    const svc = buildMutations(prisma);
    const first = await svc.assignRole(claims, target.id, {
      roleKey: ROLE_KEY,
      reason: 'A01-D01',
    });
    expect(first.audited).toBe(true);
    expect(await countRole(prisma, target.id)).toBe(1);
    expect(await countAudits(prisma, ROLE_ACTION, target.id)).toBe(1);
    const row = await prisma.auditEntry.findFirst({
      where: { action: ROLE_ACTION, resourceId: target.id },
    });
    expect(row?.actorId).toBe(claims.sub);
    expect(row?.tenantId).toBe(PLATFORM_AUDIT_SENTINEL_TENANT_ID);
    expect(JSON.stringify(row?.details)).toContain(ROLE_KEY);
    expect(JSON.stringify(row)).not.toMatch(/Bearer |password|cookie/i);
    report({
      id: 'A01-D01',
      business: 1,
      audit: 1,
      outbox: 0,
      result: 'PASS',
    });
  });

  it('A01-D02 exact replay — no additional role/audit', async () => {
    const { target, claims } = await actorTarget(prisma, 'a01d02');
    const svc = buildMutations(prisma);
    await svc.assignRole(claims, target.id, { roleKey: ROLE_KEY, reason: 'first' });
    const replay = await svc.assignRole(claims, target.id, {
      roleKey: ROLE_KEY,
      reason: 'replay',
    });
    expect(replay.audited).toBe(false);
    expect(await countRole(prisma, target.id)).toBe(1);
    expect(await countAudits(prisma, ROLE_ACTION, target.id)).toBe(1);
    report({ id: 'A01-D02', business: 1, audit: 1, additional: 0, result: 'PASS' });
  });

  it('A01-D03 conflicting replay — already-active no false success audit', async () => {
    const { target, claims } = await actorTarget(prisma, 'a01d03');
    const svc = buildMutations(prisma);
    await svc.assignRole(claims, target.id, { roleKey: ROLE_KEY, reason: 'seed' });
    const again = await svc.assignRole(claims, target.id, {
      roleKey: ROLE_KEY,
      reason: 'conflict',
    });
    expect(again).toEqual({ ok: true, audited: false });
    expect(await countAudits(prisma, ROLE_ACTION, target.id)).toBe(1);
    report({ id: 'A01-D03', conflict: 'already-active-noop', audit: 1, result: 'PASS' });
  });

  it('A01-D04 failure after business staging before audit — full rollback', async () => {
    const { target, claims } = await actorTarget(prisma, 'a01d04');
    const svc = buildMutations(prisma);
    setInjection('after_business_mutation_staging');
    await expect(
      svc.assignRole(claims, target.id, { roleKey: ROLE_KEY, reason: 'A01-D04' }),
    ).rejects.toBeInstanceOf(PlatformSecurityAuditInjectedFailure);
    expect(await countRole(prisma, target.id)).toBe(0);
    expect(await countAudits(prisma, ROLE_ACTION, target.id)).toBe(0);
    report({
      id: 'A01-D04',
      business: 0,
      audit: 0,
      outbox: 0,
      result: 'PASS',
    });
  });

  it('A01-D05 failure after audit staging before commit — full rollback', async () => {
    const { target, claims } = await actorTarget(prisma, 'a01d05');
    const svc = buildMutations(prisma);
    setInjection('after_audit_staging');
    await expect(
      svc.assignRole(claims, target.id, { roleKey: ROLE_KEY, reason: 'A01-D05' }),
    ).rejects.toBeInstanceOf(PlatformSecurityAuditInjectedFailure);
    expect(await countRole(prisma, target.id)).toBe(0);
    expect(await countAudits(prisma, ROLE_ACTION, target.id)).toBe(0);
    report({ id: 'A01-D05', business: 0, audit: 0, result: 'PASS' });
  });

  it('A01-D06 failure before transaction commit — full rollback', async () => {
    const { target, claims } = await actorTarget(prisma, 'a01d06');
    const svc = buildMutations(prisma);
    setInjection('before_commit');
    await expect(
      svc.assignRole(claims, target.id, { roleKey: ROLE_KEY, reason: 'A01-D06' }),
    ).rejects.toBeInstanceOf(PlatformSecurityAuditInjectedFailure);
    expect(await countRole(prisma, target.id)).toBe(0);
    expect(await countAudits(prisma, ROLE_ACTION, target.id)).toBe(0);
    report({ id: 'A01-D06', business: 0, audit: 0, result: 'PASS' });
  });

  it('A01-D07 after commit before response — durable evidence retained', async () => {
    const { target, claims } = await actorTarget(prisma, 'a01d07');
    const svc = buildMutations(prisma);
    setInjection('after_commit_before_response');
    await expect(
      svc.assignRole(claims, target.id, { roleKey: ROLE_KEY, reason: 'A01-D07' }),
    ).rejects.toBeInstanceOf(PlatformSecurityAuditInjectedFailure);
    expect(await countRole(prisma, target.id)).toBe(1);
    expect(await countAudits(prisma, ROLE_ACTION, target.id)).toBe(1);
    clearInjection();
    const replay = await svc.assignRole(claims, target.id, {
      roleKey: ROLE_KEY,
      reason: 'A01-D07-retry',
    });
    expect(replay.audited).toBe(false);
    expect(await countAudits(prisma, ROLE_ACTION, target.id)).toBe(1);
    report({
      id: 'A01-D07',
      business: 1,
      audit: 1,
      retryAdditional: 0,
      result: 'PASS',
    });
  });

  it('A01-D08 service recreation before replay — no duplicate evidence', async () => {
    const { target, claims } = await actorTarget(prisma, 'a01d08');
    const first = buildMutations(prisma);
    await first.assignRole(claims, target.id, { roleKey: ROLE_KEY, reason: 'A01-D08' });
    const recreated = buildMutations(prisma);
    const replay = await recreated.assignRole(claims, target.id, {
      roleKey: ROLE_KEY,
      reason: 'recreate-replay',
    });
    expect(replay.audited).toBe(false);
    expect(await countRole(prisma, target.id)).toBe(1);
    expect(await countAudits(prisma, ROLE_ACTION, target.id)).toBe(1);
    report({ id: 'A01-D08', recreation: true, audit: 1, result: 'PASS' });
  });

  it('A01-D09 duplicate projector delivery — N/A Model A', () => {
    report({
      id: 'A01-D09',
      model: 'A',
      result: 'N/A',
      note: 'same-transaction append; no projector',
    });
    expect(true).toBe(true);
  });

  it('A01-D10 projector failure and recovery — N/A Model A', () => {
    report({
      id: 'A01-D10',
      model: 'A',
      result: 'N/A',
      note: 'same-transaction append; no projector',
    });
    expect(true).toBe(true);
  });

  it('A01-D11 concurrent duplicate role assignment — one audit', async () => {
    const { target, claims } = await actorTarget(prisma, 'a01d11');
    const a = buildMutations(prisma);
    const b = buildMutations(prisma);
    const settled = await Promise.allSettled([
      a.assignRole(claims, target.id, { roleKey: ROLE_KEY, reason: 'c1' }),
      b.assignRole(claims, target.id, { roleKey: ROLE_KEY, reason: 'c2' }),
    ]);
    const ok = settled.filter((s) => s.status === 'fulfilled');
    expect(ok.length).toBe(2);
    expect(await countRole(prisma, target.id)).toBe(1);
    expect(await countAudits(prisma, ROLE_ACTION, target.id)).toBe(1);
    const auditedTrue = ok.filter(
      (s) => s.status === 'fulfilled' && s.value.audited === true,
    ).length;
    expect(auditedTrue).toBe(1);
    report({
      id: 'A01-D11',
      concurrent: 2,
      auditedTrue,
      audit: 1,
      result: 'PASS',
    });
  });

  it('A01-D12 cross-user isolation', async () => {
    const a = await actorTarget(prisma, 'a01d12a');
    const b = await actorTarget(prisma, 'a01d12b');
    const svc = buildMutations(prisma);
    await svc.assignRole(a.claims, a.target.id, { roleKey: ROLE_KEY, reason: 'user-a' });
    expect(await countRole(prisma, a.target.id)).toBe(1);
    expect(await countRole(prisma, b.target.id)).toBe(0);
    expect(await countAudits(prisma, ROLE_ACTION, a.target.id)).toBe(1);
    expect(await countAudits(prisma, ROLE_ACTION, b.target.id)).toBe(0);
    report({ id: 'A01-D12', isolation: true, result: 'PASS' });
  });

  // ─── A02 ───────────────────────────────────────────────────────────────

  it('A02-D01 first success — revoke=1 audit=1', async () => {
    const { actor, target, claims } = await actorTarget(prisma, 'a02d01');
    void actor;
    const targetSession = await createPlatformRefreshSession(prisma, target.id);
    const svc = buildMutations(prisma);
    await svc.revokeSession(claims, target.id, targetSession.sessionId, 'A02-D01');
    expect(await countActiveSessions(prisma, targetSession.sessionId)).toBe(0);
    expect(await countAudits(prisma, SESSION_ACTION, target.id)).toBe(1);
    const row = await prisma.auditEntry.findFirst({
      where: { action: SESSION_ACTION, resourceId: target.id },
    });
    const blob = JSON.stringify(row);
    expect(blob).not.toContain(targetSession.sessionId);
    expect(blob).toContain('[redacted]');
    expect(blob).not.toMatch(/Bearer |refresh|cookie/i);
    report({ id: 'A02-D01', business: 1, audit: 1, privacy: 'session-redacted', result: 'PASS' });
  });

  it('A02-D02 exact replay — no second revoke/audit', async () => {
    const { target, claims } = await actorTarget(prisma, 'a02d02');
    const targetSession = await createPlatformRefreshSession(prisma, target.id);
    const svc = buildMutations(prisma);
    await svc.revokeSession(claims, target.id, targetSession.sessionId, 'A02-D02');
    await expect(
      svc.revokeSession(claims, target.id, targetSession.sessionId, 'replay'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(await countAudits(prisma, SESSION_ACTION, target.id)).toBe(1);
    report({ id: 'A02-D02', audit: 1, replayAdditional: 0, result: 'PASS' });
  });

  it('A02-D03 already-revoked conflict/no-op', async () => {
    const { target, claims } = await actorTarget(prisma, 'a02d03');
    const targetSession = await createPlatformRefreshSession(prisma, target.id);
    const svc = buildMutations(prisma);
    await svc.revokeSession(claims, target.id, targetSession.sessionId, 'first');
    await expect(
      svc.revokeSession(claims, target.id, targetSession.sessionId, 'again'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(await countAudits(prisma, SESSION_ACTION, target.id)).toBe(1);
    report({ id: 'A02-D03', conflict: 'NotFound', audit: 1, result: 'PASS' });
  });

  it('A02-D04 failure after revocation staging before audit — session remains active', async () => {
    const { target, claims } = await actorTarget(prisma, 'a02d04');
    const targetSession = await createPlatformRefreshSession(prisma, target.id);
    const svc = buildMutations(prisma);
    setInjection('after_business_mutation_staging');
    await expect(
      svc.revokeSession(claims, target.id, targetSession.sessionId, 'A02-D04'),
    ).rejects.toBeInstanceOf(PlatformSecurityAuditInjectedFailure);
    expect(await countActiveSessions(prisma, targetSession.sessionId)).toBe(1);
    expect(await countAudits(prisma, SESSION_ACTION, target.id)).toBe(0);
    report({ id: 'A02-D04', sessionActive: 1, audit: 0, result: 'PASS' });
  });

  it('A02-D05 failure after audit staging before commit — session remains active', async () => {
    const { target, claims } = await actorTarget(prisma, 'a02d05');
    const targetSession = await createPlatformRefreshSession(prisma, target.id);
    const svc = buildMutations(prisma);
    setInjection('after_audit_staging');
    await expect(
      svc.revokeSession(claims, target.id, targetSession.sessionId, 'A02-D05'),
    ).rejects.toBeInstanceOf(PlatformSecurityAuditInjectedFailure);
    expect(await countActiveSessions(prisma, targetSession.sessionId)).toBe(1);
    expect(await countAudits(prisma, SESSION_ACTION, target.id)).toBe(0);
    report({ id: 'A02-D05', sessionActive: 1, audit: 0, result: 'PASS' });
  });

  it('A02-D06 failure before transaction commit — session remains active', async () => {
    const { target, claims } = await actorTarget(prisma, 'a02d06');
    const targetSession = await createPlatformRefreshSession(prisma, target.id);
    const svc = buildMutations(prisma);
    setInjection('before_commit');
    await expect(
      svc.revokeSession(claims, target.id, targetSession.sessionId, 'A02-D06'),
    ).rejects.toBeInstanceOf(PlatformSecurityAuditInjectedFailure);
    expect(await countActiveSessions(prisma, targetSession.sessionId)).toBe(1);
    expect(await countAudits(prisma, SESSION_ACTION, target.id)).toBe(0);
    report({ id: 'A02-D06', sessionActive: 1, audit: 0, result: 'PASS' });
  });

  it('A02-D07 after commit before response — durable evidence retained', async () => {
    const { target, claims } = await actorTarget(prisma, 'a02d07');
    const targetSession = await createPlatformRefreshSession(prisma, target.id);
    const svc = buildMutations(prisma);
    setInjection('after_commit_before_response');
    await expect(
      svc.revokeSession(claims, target.id, targetSession.sessionId, 'A02-D07'),
    ).rejects.toBeInstanceOf(PlatformSecurityAuditInjectedFailure);
    expect(await countActiveSessions(prisma, targetSession.sessionId)).toBe(0);
    expect(await countAudits(prisma, SESSION_ACTION, target.id)).toBe(1);
    clearInjection();
    await expect(
      svc.revokeSession(claims, target.id, targetSession.sessionId, 'retry'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(await countAudits(prisma, SESSION_ACTION, target.id)).toBe(1);
    report({ id: 'A02-D07', business: 1, audit: 1, retryAdditional: 0, result: 'PASS' });
  });

  it('A02-D08 service recreation before replay — no duplicate evidence', async () => {
    const { target, claims } = await actorTarget(prisma, 'a02d08');
    const targetSession = await createPlatformRefreshSession(prisma, target.id);
    await buildMutations(prisma).revokeSession(
      claims,
      target.id,
      targetSession.sessionId,
      'A02-D08',
    );
    await expect(
      buildMutations(prisma).revokeSession(claims, target.id, targetSession.sessionId, 'recreate'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(await countAudits(prisma, SESSION_ACTION, target.id)).toBe(1);
    report({ id: 'A02-D08', recreation: true, audit: 1, result: 'PASS' });
  });

  it('A02-D09 duplicate projector delivery — N/A Model A', () => {
    report({
      id: 'A02-D09',
      model: 'A',
      result: 'N/A',
      note: 'same-transaction append; no projector',
    });
    expect(true).toBe(true);
  });

  it('A02-D10 projector failure and recovery — N/A Model A', () => {
    report({
      id: 'A02-D10',
      model: 'A',
      result: 'N/A',
      note: 'same-transaction append; no projector',
    });
    expect(true).toBe(true);
  });

  it('A02-D11 concurrent duplicate revocation — one audit', async () => {
    const { target, claims } = await actorTarget(prisma, 'a02d11');
    const targetSession = await createPlatformRefreshSession(prisma, target.id);
    const a = buildMutations(prisma);
    const b = buildMutations(prisma);
    const settled = await Promise.allSettled([
      a.revokeSession(claims, target.id, targetSession.sessionId, 'c1'),
      b.revokeSession(claims, target.id, targetSession.sessionId, 'c2'),
    ]);
    const fulfilled = settled.filter((s) => s.status === 'fulfilled').length;
    const rejected = settled.filter((s) => s.status === 'rejected').length;
    expect(fulfilled).toBe(1);
    expect(rejected).toBe(1);
    expect(await countActiveSessions(prisma, targetSession.sessionId)).toBe(0);
    expect(await countAudits(prisma, SESSION_ACTION, target.id)).toBe(1);
    report({
      id: 'A02-D11',
      fulfilled,
      rejected,
      audit: 1,
      result: 'PASS',
    });
  });

  it('A02-D12 cross-session and cross-user isolation', async () => {
    const a = await actorTarget(prisma, 'a02d12a');
    const b = await actorTarget(prisma, 'a02d12b');
    const sessA1 = await createPlatformRefreshSession(prisma, a.target.id);
    const sessA2 = await createPlatformRefreshSession(prisma, a.target.id);
    const sessB = await createPlatformRefreshSession(prisma, b.target.id);
    const svc = buildMutations(prisma);
    await svc.revokeSession(a.claims, a.target.id, sessA1.sessionId, 'isolate');
    expect(await countActiveSessions(prisma, sessA1.sessionId)).toBe(0);
    expect(await countActiveSessions(prisma, sessA2.sessionId)).toBe(1);
    expect(await countActiveSessions(prisma, sessB.sessionId)).toBe(1);
    expect(await countAudits(prisma, SESSION_ACTION, a.target.id)).toBe(1);
    expect(await countAudits(prisma, SESSION_ACTION, b.target.id)).toBe(0);
    report({ id: 'A02-D12', isolation: true, result: 'PASS' });
  });
});
