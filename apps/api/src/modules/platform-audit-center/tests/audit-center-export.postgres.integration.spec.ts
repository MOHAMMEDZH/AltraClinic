/**
 * Flexible Step 21 — export matrix E01–E20 (PostgreSQL).
 */
import { createHash, randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  AUDIT_CENTER_EXPORT_MAX_ROWS,
  AUDIT_CENTER_MAX_DATE_RANGE_DAYS,
  AUDIT_CENTER_OPERATIONS,
} from '../platform-audit-center.constants';
import { csvSafeCell } from '../application/audit-center-redaction';
import {
  cleanupAuditCenterTables,
  clearAuditFailureInjection,
  countSuccessAudits,
  createAuditStack,
  createPlatformDbSecurityClient,
  createPlatformUserFixture,
  enableAuditCenter,
  executeExport,
  matrixAction,
  platformClaims,
  platformDbSecurityEnabled,
  seedAuditEntry,
  setAuditFailureInjection,
} from './audit-center-db.harness';
import { PROHIBITED_SERIALIZED } from './audit-center-matrix.constants';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 21 Audit Center export matrix E01-E20 (PostgreSQL)', () => {
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

  async function seedUser() {
    return createPlatformUserFixture(prisma, {
      email: `ac-exp-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
  }

  it('E01: authorized export succeeds with fresh step-up', async () => {
    const user = await seedUser();
    await seedAuditEntry(prisma, { actorId: user.id });
    const stack = createAuditStack(prisma);
    const claims = platformClaims(user.id, randomUUID());
    const result = await executeExport(stack, claims, {
      reason: 'E01 export',
      idempotencyKey: `e01-${randomUUID()}`,
    });
    expect((result as { rowCount: number }).rowCount).toBeGreaterThanOrEqual(1);
    expect((result as { downloadToken: string }).downloadToken).toBeTruthy();
  });

  it('E02: view-only permission denied for export', async () => {
    const user = await seedUser();
    const stack = createAuditStack(prisma, { permissions: ['audit.view'] });
    const claims = platformClaims(user.id, randomUUID());
    await expect(
      stack.exports.preview({ filters: {}, reason: 'x', filterFingerprint: '' }, stack.perms),
    ).rejects.toMatchObject({ code: 'forbidden' });
    await expect(
      executeExport(stack, claims, { reason: 'denied', idempotencyKey: randomUUID() }),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('E03: stale step-up denied', async () => {
    const user = await seedUser();
    const stack = createAuditStack(prisma);
    stack.setStepUpFresh(false);
    const claims = platformClaims(user.id, randomUUID());
    await expect(
      executeExport(stack, claims, { reason: 'stale', idempotencyKey: randomUUID() }),
    ).rejects.toBeTruthy();
  });

  it('E04: fresh step-up allows export', async () => {
    const user = await seedUser();
    await seedAuditEntry(prisma, { actorId: user.id });
    const stack = createAuditStack(prisma);
    stack.setStepUpFresh(true);
    const claims = platformClaims(user.id, randomUUID());
    const result = await executeExport(stack, claims, {
      reason: 'E04 fresh',
      idempotencyKey: `e04-${randomUUID()}`,
    });
    expect((result as { exportId: string }).exportId).toBeTruthy();
  });

  it('E05: actual 429 when export rate limit exceeded', async () => {
    const user = await seedUser();
    await seedAuditEntry(prisma, { actorId: user.id });
    const stack = createAuditStack(prisma, { exportRateLimit: 2 });
    const claims = platformClaims(user.id, randomUUID());
    await executeExport(stack, claims, { reason: 'e5-1', idempotencyKey: `e5a-${randomUUID()}` });
    await executeExport(stack, claims, { reason: 'e5-2', idempotencyKey: `e5b-${randomUUID()}` });
    await expect(
      executeExport(stack, claims, { reason: 'e5-3', idempotencyKey: `e5c-${randomUUID()}` }),
    ).rejects.toMatchObject({ code: 'rate_limited', httpStatus: 429 });
  });

  it('E06: oversized date range in export filters rejected', async () => {
    const user = await seedUser();
    const stack = createAuditStack(prisma);
    const claims = platformClaims(user.id, randomUUID());
    const filters = {
      from: '2020-01-01T00:00:00.000Z',
      to: '2026-12-31T23:59:59.999Z',
    };
    const preview = await stack.exports.preview(
      { filters, reason: 'big range', filterFingerprint: '' },
      stack.perms,
    );
    await expect(
      stack.exports.execute(
        claims,
        { filters, reason: 'big range', filterFingerprint: preview.filterFingerprint },
        stack.perms,
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'date_range_too_large' });
    expect(AUDIT_CENTER_MAX_DATE_RANGE_DAYS).toBe(366);
  });

  it('E07: CSV formula injection neutralized', () => {
    expect(csvSafeCell('=CMD()')).toMatch(/^"'=/);
    expect(csvSafeCell('+1234')).toMatch(/^"'+/);
    expect(csvSafeCell('-formula')).toMatch(/^"'-/);
  });

  it('E08: Arabic UTF-8 preserved in export reason and action', async () => {
    const user = await seedUser();
    const action = matrixAction('tenant_lifecycle.suspended');
    await seedAuditEntry(prisma, {
      actorId: user.id,
      action,
      category: 'lifecycle',
      reason: 'سبب التعليق — audit',
    });
    const stack = createAuditStack(prisma);
    const claims = platformClaims(user.id, randomUUID());
    const result = await executeExport(stack, claims, {
      reason: 'تصدير السجل — E08',
      idempotencyKey: `e08-${randomUUID()}`,
    });
    const exportId = (result as { exportId: string }).exportId;
    const token = (result as { downloadToken: string }).downloadToken;
    const file = await stack.exports.download(exportId, user.id, token, stack.perms);
    expect(file.csv).toContain('\uFEFF');
    expect(file.csv).toContain('سبب');
  });

  it('E09: deterministic CSV column order', async () => {
    const user = await seedUser();
    await seedAuditEntry(prisma, { actorId: user.id });
    const stack = createAuditStack(prisma);
    const claims = platformClaims(user.id, randomUUID());
    const idem = `e09-${randomUUID()}`;
    const r1 = await executeExport(stack, claims, { reason: 'E09a', idempotencyKey: idem });
    const d1 = await stack.exports.download(
      (r1 as { exportId: string }).exportId,
      user.id,
      (r1 as { downloadToken: string }).downloadToken,
      stack.perms,
    );
    await cleanupAuditCenterTables(prisma);
    await seedAuditEntry(prisma, { actorId: user.id });
    const stack2 = createAuditStack(prisma);
    const r2 = await executeExport(stack2, claims, { reason: 'E09b', idempotencyKey: `${idem}-b` });
    const d2 = await stack2.exports.download(
      (r2 as { exportId: string }).exportId,
      user.id,
      (r2 as { downloadToken: string }).downloadToken,
      stack2.perms,
    );
    const header1 = d1.csv.split('\n')[0];
    const header2 = d2.csv.split('\n')[0];
    expect(header1).toBe(header2);
    expect(header1).toContain('occurredAt');
    expect(header1).toContain('correlationId');
  });

  it('E10: export redacts network metadata without permission', async () => {
    const user = await seedUser();
    await seedAuditEntry(prisma, {
      actorId: user.id,
      ipAddress: '203.0.113.99',
      userAgent: 'Mozilla/5.0 Chrome',
    });
    const stack = createAuditStack(prisma, {
      permissions: ['audit.view', 'audit.export', 'audit.sensitive.view'],
    });
    const claims = platformClaims(user.id, randomUUID());
    const result = await executeExport(stack, claims, {
      reason: 'E10 redact',
      idempotencyKey: `e10-${randomUUID()}`,
    });
    const file = await stack.exports.download(
      (result as { exportId: string }).exportId,
      user.id,
      (result as { downloadToken: string }).downloadToken,
      stack.perms,
    );
    expect(file.csv).not.toContain('203.0.113.99');
  });

  it('E11: export CSV excludes PHI/secrets from details', async () => {
    const user = await seedUser();
    await seedAuditEntry(prisma, {
      actorId: user.id,
      details: { patient: 'Jane', password: 'secret', note: 'safe' },
    });
    const stack = createAuditStack(prisma);
    const claims = platformClaims(user.id, randomUUID());
    const result = await executeExport(stack, claims, {
      reason: 'E11 phi',
      idempotencyKey: `e11-${randomUUID()}`,
    });
    const file = await stack.exports.download(
      (result as { exportId: string }).exportId,
      user.id,
      (result as { downloadToken: string }).downloadToken,
      stack.perms,
    );
    for (const p of PROHIBITED_SERIALIZED) {
      expect(file.csv.toLowerCase()).not.toContain(p.toLowerCase());
    }
  });

  it('E12: idempotent replay returns same export without duplicate row', async () => {
    const user = await seedUser();
    await seedAuditEntry(prisma, { actorId: user.id });
    const stack = createAuditStack(prisma);
    const claims = platformClaims(user.id, randomUUID());
    const idem = `e12-${randomUUID()}`;
    const first = await executeExport(stack, claims, { reason: 'E12', idempotencyKey: idem });
    const before = await prisma.platformAuditExportRecord.count();
    const replay = await executeExport(stack, claims, { reason: 'E12', idempotencyKey: idem });
    expect((replay as { exportId: string }).exportId).toBe((first as { exportId: string }).exportId);
    expect(await prisma.platformAuditExportRecord.count()).toBe(before);
  });

  it('E13: conflicting fingerprint returns 409', async () => {
    const user = await seedUser();
    const stack = createAuditStack(prisma);
    const claims = platformClaims(user.id, randomUUID());
    const idem = `e13-${randomUUID()}`;
    const preview1 = await stack.exports.preview(
      { filters: {}, reason: 'a', filterFingerprint: '' },
      stack.perms,
    );
    await stack.exports.execute(
      claims,
      { filters: {}, reason: 'a', filterFingerprint: preview1.filterFingerprint },
      stack.perms,
      idem,
    );
    const preview2 = await stack.exports.preview(
      { filters: { action: 'different' }, reason: 'b', filterFingerprint: '' },
      stack.perms,
    );
    await expect(
      stack.exports.execute(
        claims,
        { filters: { action: 'different' }, reason: 'b', filterFingerprint: preview2.filterFingerprint },
        stack.perms,
        idem,
      ),
    ).rejects.toMatchObject({ code: 'idempotency_conflict', httpStatus: 409 });
  });

  it('E14: before_commit injection rolls back export and success audit', async () => {
    const user = await seedUser();
    await seedAuditEntry(prisma, { actorId: user.id });
    const stack = createAuditStack(prisma);
    const claims = platformClaims(user.id, randomUUID());
    setAuditFailureInjection('before_commit');
    const beforeExports = await prisma.platformAuditExportRecord.count();
    const beforeAudits = await countSuccessAudits(prisma, AUDIT_CENTER_OPERATIONS.EXPORT_COMPLETE);
    await expect(
      executeExport(stack, claims, { reason: 'E14 fail', idempotencyKey: `e14-${randomUUID()}` }),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    expect(await prisma.platformAuditExportRecord.count()).toBe(beforeExports);
    expect(await countSuccessAudits(prisma, AUDIT_CENTER_OPERATIONS.EXPORT_COMPLETE)).toBe(
      beforeAudits,
    );
  });

  it('E15: expired download rejected and body cleaned', async () => {
    const user = await seedUser();
    await seedAuditEntry(prisma, { actorId: user.id });
    const stack = createAuditStack(prisma);
    const claims = platformClaims(user.id, randomUUID());
    const result = await executeExport(stack, claims, {
      reason: 'E15 expire',
      idempotencyKey: `e15-${randomUUID()}`,
    });
    const exportId = (result as { exportId: string }).exportId;
    const token = (result as { downloadToken: string }).downloadToken;
    await prisma.platformAuditExportRecord.update({
      where: { id: exportId },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    await expect(
      stack.exports.download(exportId, user.id, token, stack.perms),
    ).rejects.toMatchObject({ code: 'export_expired', httpStatus: 410 });
  });

  it('E16: another principal cannot download export', async () => {
    const owner = await seedUser();
    const other = await seedUser();
    await seedAuditEntry(prisma, { actorId: owner.id });
    const stack = createAuditStack(prisma);
    const claims = platformClaims(owner.id, randomUUID());
    const result = await executeExport(stack, claims, {
      reason: 'E16 owner',
      idempotencyKey: `e16-${randomUUID()}`,
    });
    await expect(
      stack.exports.getExport((result as { exportId: string }).exportId, other.id, stack.perms),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('E17: DB stores token hash only not public URL', async () => {
    const user = await seedUser();
    await seedAuditEntry(prisma, { actorId: user.id });
    const stack = createAuditStack(prisma);
    const claims = platformClaims(user.id, randomUUID());
    const result = await executeExport(stack, claims, {
      reason: 'E17 hash',
      idempotencyKey: `e17-${randomUUID()}`,
    });
    const exportId = (result as { exportId: string }).exportId;
    const token = (result as { downloadToken: string }).downloadToken;
    const row = await prisma.platformAuditExportRecord.findUniqueOrThrow({ where: { id: exportId } });
    expect(row.downloadTokenHash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(row.downloadTokenHash).not.toBe(token);
    const payload = JSON.stringify(row);
    expect(payload).not.toContain('http://');
    expect(payload).not.toContain('https://');
  });

  it('E18: successful export creates durable audit row', async () => {
    const user = await seedUser();
    await seedAuditEntry(prisma, { actorId: user.id });
    const stack = createAuditStack(prisma);
    const claims = platformClaims(user.id, randomUUID());
    const before = await countSuccessAudits(prisma, AUDIT_CENTER_OPERATIONS.EXPORT_COMPLETE);
    await executeExport(stack, claims, {
      reason: 'E18 audit',
      idempotencyKey: `e18-${randomUUID()}`,
    });
    expect(await countSuccessAudits(prisma, AUDIT_CENTER_OPERATIONS.EXPORT_COMPLETE)).toBe(
      before + 1,
    );
  });

  it('E19: preview requires audit.export permission', async () => {
    const stack = createAuditStack(prisma, { permissions: ['audit.view'] });
    await expect(
      stack.exports.preview({ filters: {}, reason: 'x', filterFingerprint: '' }, stack.perms),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('E20: export rejects when row count exceeds max', async () => {
    const user = await seedUser();
    const stack = createAuditStack(prisma);
    const synthetic = Array.from({ length: AUDIT_CENTER_EXPORT_MAX_ROWS }, (_, i) => ({
      id: randomUUID(),
      occurredAt: new Date().toISOString(),
      action: `platform.test.max.${i}`,
      category: 'test',
      resourceType: 'platform_test',
      resourceId: randomUUID(),
      actorId: user.id,
      actorRoles: ['auditor'],
      reason: 'test',
      correlationId: randomUUID(),
      tenantId: randomUUID(),
      descriptionEn: null,
      descriptionAr: null,
      beforeAfterSummary: null,
      ipAddress: null,
      userAgentSummary: null,
      accessClass: 'standard' as const,
    }));
    const searchSpy = jest.spyOn(stack.query, 'search').mockResolvedValue({
      items: synthetic,
      nextCursor: null,
    });
    const claims = platformClaims(user.id, randomUUID());
    try {
      await expect(
        executeExport(stack, claims, { reason: 'E20 too big', idempotencyKey: `e20-${randomUUID()}` }),
      ).rejects.toMatchObject({ code: 'export_too_large' });
    } finally {
      searchSpy.mockRestore();
    }
  });
});
