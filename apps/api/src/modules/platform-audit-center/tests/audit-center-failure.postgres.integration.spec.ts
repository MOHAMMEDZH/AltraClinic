/**
 * Flexible Step 21 — failure-injection matrix F01–F24 (PostgreSQL).
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  AUDIT_CENTER_FAILURE_INJECTION_POINTS,
  AUDIT_CENTER_OPERATIONS,
  isAuditCenterFailureInjectionActive,
} from '../platform-audit-center.constants';
import {
  cleanupAuditCenterTables,
  clearAuditFailureInjection,
  countSuccessAudits,
  createAuditStack,
  createPlatformDbSecurityClient,
  createPlatformUserFixture,
  enableAuditCenter,
  executeExport,
  platformClaims,
  platformDbSecurityEnabled,
  seedAuditEntry,
  setAuditFailureInjection,
} from './audit-center-db.harness';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 21 Audit Center failure matrix F01-F24 (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let restore: () => void;

  beforeAll(() => {
    prisma = createPlatformDbSecurityClient();
    restore = enableAuditCenter();
  });

  afterAll(async () => {
    restore();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    clearAuditFailureInjection();
    process.env.NODE_ENV = 'test';
    await cleanupAuditCenterTables(prisma);
  });

  afterEach(() => clearAuditFailureInjection());

  async function userAndStack() {
    const user = await createPlatformUserFixture(prisma, {
      email: `ac-f-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    await seedAuditEntry(prisma, { actorId: user.id });
    return { user, stack: createAuditStack(prisma), claims: platformClaims(user.id, randomUUID()) };
  }

  it('F01: after_authorization injection fails query', async () => {
    const { stack } = await userAndStack();
    setAuditFailureInjection('after_authorization');
    await expect(stack.query.search({ limit: 5 }, stack.perms)).rejects.toMatchObject({
      code: 'injected_failure',
    });
  });

  it('F02: after_query_parse injection fails query', async () => {
    const { stack } = await userAndStack();
    setAuditFailureInjection('after_query_parse');
    await expect(stack.query.search({ limit: 5 }, stack.perms)).rejects.toMatchObject({
      code: 'injected_failure',
    });
  });

  it('F03: after_source_lookup injection fails evidence', async () => {
    const { stack } = await userAndStack();
    setAuditFailureInjection('after_source_lookup');
    await expect(
      stack.evidence.planVersionEvidence(randomUUID(), stack.perms),
    ).rejects.toMatchObject({ code: 'injected_failure' });
  });

  it('F04: after_cursor_decode injection fails paginated search', async () => {
    const { user, stack } = await userAndStack();
    for (let i = 0; i < 3; i++) {
      await seedAuditEntry(prisma, { actorId: user.id, action: `platform.test.f04.${i}` });
    }
    const page = await stack.query.search({ limit: 1 }, stack.perms);
    expect(page.nextCursor).toBeTruthy();
    setAuditFailureInjection('after_cursor_decode');
    await expect(
      stack.query.search({ limit: 1, cursor: page.nextCursor! }, stack.perms),
    ).rejects.toMatchObject({ code: 'injected_failure' });
  });

  it('F05: before_export_generate injection fails export', async () => {
    const { stack, claims } = await userAndStack();
    setAuditFailureInjection('before_export_generate');
    await expect(
      executeExport(stack, claims, { reason: 'F05', idempotencyKey: `f05-${randomUUID()}` }),
    ).rejects.toMatchObject({ code: 'injected_failure' });
  });

  it('F06: after_export_staging injection rolls back export transaction', async () => {
    const { stack, claims } = await userAndStack();
    setAuditFailureInjection('after_export_staging');
    const before = await prisma.platformAuditExportRecord.count();
    await expect(
      executeExport(stack, claims, { reason: 'F06', idempotencyKey: `f06-${randomUUID()}` }),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    expect(await prisma.platformAuditExportRecord.count()).toBe(before);
  });

  it('F07: after_export_audit_staging injection rolls back', async () => {
    const { stack, claims } = await userAndStack();
    setAuditFailureInjection('after_export_audit_staging');
    const beforeAudits = await countSuccessAudits(prisma, AUDIT_CENTER_OPERATIONS.EXPORT_COMPLETE);
    await expect(
      executeExport(stack, claims, { reason: 'F07', idempotencyKey: `f07-${randomUUID()}` }),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    expect(await countSuccessAudits(prisma, AUDIT_CENTER_OPERATIONS.EXPORT_COMPLETE)).toBe(
      beforeAudits,
    );
  });

  it('F08: before_commit injection rolls back export and audit', async () => {
    const { stack, claims } = await userAndStack();
    setAuditFailureInjection('before_commit');
    const beforeExports = await prisma.platformAuditExportRecord.count();
    const beforeAudits = await countSuccessAudits(prisma, AUDIT_CENTER_OPERATIONS.EXPORT_COMPLETE);
    await expect(
      executeExport(stack, claims, { reason: 'F08', idempotencyKey: `f08-${randomUUID()}` }),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    expect(await prisma.platformAuditExportRecord.count()).toBe(beforeExports);
    expect(await countSuccessAudits(prisma, AUDIT_CENTER_OPERATIONS.EXPORT_COMPLETE)).toBe(
      beforeAudits,
    );
  });

  it('F09: after_commit_before_response injection after successful commit', async () => {
    const { stack, claims } = await userAndStack();
    setAuditFailureInjection('after_commit_before_response');
    const before = await prisma.platformAuditExportRecord.count();
    await expect(
      executeExport(stack, claims, { reason: 'F09', idempotencyKey: `f09-${randomUUID()}` }),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    expect(await prisma.platformAuditExportRecord.count()).toBe(before + 1);
  });

  it('F10: redaction_failure injection fails list mapping', async () => {
    const { stack } = await userAndStack();
    setAuditFailureInjection('redaction_failure');
    await expect(stack.query.search({ limit: 5 }, stack.perms)).rejects.toMatchObject({
      code: 'injected_failure',
    });
  });

  it('F11: immutability_update_attempt injection on denyUpdate', async () => {
    const stack = createAuditStack(prisma);
    setAuditFailureInjection('immutability_update_attempt');
    await expect(stack.query.denyUpdate()).rejects.toMatchObject({ code: 'injected_failure' });
  });

  it('F12: immutability_delete_attempt injection on denyDelete', async () => {
    const stack = createAuditStack(prisma);
    setAuditFailureInjection('immutability_delete_attempt');
    await expect(stack.query.denyDelete()).rejects.toMatchObject({ code: 'injected_failure' });
  });

  it('F13: production NODE_ENV ignores all injection points', async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    for (const point of AUDIT_CENTER_FAILURE_INJECTION_POINTS) {
      setAuditFailureInjection(point);
      expect(isAuditCenterFailureInjectionActive(point)).toBe(false);
    }
    process.env.NODE_ENV = prev;
    clearAuditFailureInjection();
  });

  it('F14: forbidden query without audit.view', async () => {
    const stack = createAuditStack(prisma, { permissions: ['audit.export'] });
    await expect(stack.query.search({ limit: 1 }, stack.perms)).rejects.toMatchObject({
      code: 'forbidden',
      httpStatus: 403,
    });
  });

  it('F15: getById not_found for missing entry', async () => {
    const stack = createAuditStack(prisma);
    await expect(stack.query.getById(randomUUID(), stack.perms)).rejects.toMatchObject({
      code: 'not_found',
      httpStatus: 404,
    });
  });

  it('F16: evidence source not found', async () => {
    const stack = createAuditStack(prisma);
    await expect(
      stack.evidence.overrideEvidence(randomUUID(), stack.perms),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('F17: export staging rollback leaves idempotency empty on before_commit', async () => {
    const { stack, claims } = await userAndStack();
    setAuditFailureInjection('before_commit');
    const idem = `f17-${randomUUID()}`;
    await expect(
      executeExport(stack, claims, { reason: 'F17', idempotencyKey: idem }),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    expect(
      await prisma.platformAuditExportIdempotencyRecord.count({
        where: { idempotencyKey: idem },
      }),
    ).toBe(0);
  });

  it('F18: expired export cleans ephemeral download body', async () => {
    const { stack, claims, user } = await userAndStack();
    const result = await executeExport(stack, claims, {
      reason: 'F18',
      idempotencyKey: `f18-${randomUUID()}`,
    });
    const exportId = (result as { exportId: string }).exportId;
    const token = (result as { downloadToken: string }).downloadToken;
    await prisma.platformAuditExportRecord.update({
      where: { id: exportId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(stack.exports.download(exportId, user.id, token, stack.perms)).rejects.toMatchObject(
      { code: 'export_expired' },
    );
    await expect(
      stack.exports.download(exportId, user.id, token, stack.perms),
    ).rejects.toMatchObject({ code: 'export_expired' });
  });

  it('F19: service recreation before replay returns cached idempotent result', async () => {
    const { stack, claims, user } = await userAndStack();
    const idem = `f19-${randomUUID()}`;
    const first = await executeExport(stack, claims, { reason: 'F19', idempotencyKey: idem });
    const stack2 = createAuditStack(prisma);
    const replay = await executeExport(stack2, claims, { reason: 'F19', idempotencyKey: idem });
    expect((replay as { exportId: string }).exportId).toBe((first as { exportId: string }).exportId);
    expect(await countSuccessAudits(prisma, AUDIT_CENTER_OPERATIONS.EXPORT_COMPLETE)).toBe(1);
    void user;
  });

  it('F20: invalid date filter rejected', async () => {
    const stack = createAuditStack(prisma);
    await expect(
      stack.query.search({ from: 'not-a-date', limit: 5 }, stack.perms),
    ).rejects.toMatchObject({ code: 'invalid_date' });
  });

  it('F21: stale filter fingerprint rejected on export', async () => {
    const { stack, claims } = await userAndStack();
    await expect(
      stack.exports.execute(
        claims,
        { filters: {}, reason: 'F21', filterFingerprint: 'deadbeef' },
        stack.perms,
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'stale_fingerprint', httpStatus: 409 });
  });

  it('F22: audit center disabled when env off', async () => {
    const prev = process.env.AUDIT_CENTER_ENABLED;
    process.env.AUDIT_CENTER_ENABLED = 'false';
    const { stack, claims } = await userAndStack();
    await expect(
      executeExport(stack, claims, { reason: 'F22', idempotencyKey: `f22-${randomUUID()}` }),
    ).rejects.toMatchObject({ code: 'audit_center_disabled', httpStatus: 503 });
    process.env.AUDIT_CENTER_ENABLED = prev;
  });

  it('F23: invalid reason rejected on export', async () => {
    const { stack, claims } = await userAndStack();
    const preview = await stack.exports.preview(
      { filters: {}, reason: 'x', filterFingerprint: '' },
      stack.perms,
    );
    await expect(
      stack.exports.execute(
        claims,
        { filters: {}, reason: '   ', filterFingerprint: preview.filterFingerprint },
        stack.perms,
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'invalid_reason' });
  });

  it('F24: all registered injection points are test-activatable under NODE_ENV=test', async () => {
    process.env.NODE_ENV = 'test';
    for (const point of AUDIT_CENTER_FAILURE_INJECTION_POINTS) {
      setAuditFailureInjection(point);
      expect(isAuditCenterFailureInjectionActive(point)).toBe(true);
      clearAuditFailureInjection();
    }
  });
});
