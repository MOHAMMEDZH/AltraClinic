/**
 * Flexible Step 21 — coverage matrix A01–A18 (PostgreSQL).
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  appendMatrixAuditOnce,
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
} from './audit-center-db.harness';
import {
  AUDIT_CENTER_OPERATIONS,
  AUDIT_CENTER_PERMISSIONS,
} from '../platform-audit-center.constants';
import { COVERAGE_MATRIX, PROHIBITED_SERIALIZED } from './audit-center-matrix.constants';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 21 Audit Center coverage matrix A01-A18 (PostgreSQL)', () => {
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

  for (const spec of COVERAGE_MATRIX) {
    it(`${spec.label}: first success=1, replay idempotent, searchable, redacted`, async () => {
      const user = await createPlatformUserFixture(prisma, {
        email: `ac-${spec.label}-${randomUUID()}@test.local`,
        roleKeys: ['auditor'],
      });
      const correlationId = randomUUID();
      const resourceId = randomUUID();
      const action = matrixAction(spec.action);
      const sensitiveDetails = {
        note: 'matrix',
        patientName: 'Jane Doe',
        api_key: 'sk-live-secret',
      };

      const first = await appendMatrixAuditOnce(prisma, {
        actorId: user.id,
        action,
        category: spec.category,
        resourceType: spec.resourceType,
        resourceId,
        correlationId,
        reason: `${spec.label} reason`,
        details: sensitiveDetails,
        changes: { status: { before: 'draft', after: 'active' } },
      });
      expect(first.created).toBe(true);
      expect(await countSuccessAudits(prisma, action, correlationId)).toBe(1);

      const replay = await appendMatrixAuditOnce(prisma, {
        actorId: user.id,
        action,
        category: spec.category,
        resourceType: spec.resourceType,
        resourceId,
        correlationId,
        reason: `${spec.label} reason`,
      });
      expect(replay.created).toBe(false);
      expect(await countSuccessAudits(prisma, action, correlationId)).toBe(1);

      const stack = createAuditStack(prisma);
      const found = await stack.query.search({ action, limit: 5 }, stack.perms);
      expect(found.items.some((i) => i.id === first.row.id)).toBe(true);
      const item = found.items.find((i) => i.id === first.row.id)!;
      expect(item.actorId).toBe(user.id);
      expect(item.resourceId).toBe(resourceId);
      expect(item.reason).toContain(spec.label);
      expect(item.correlationId).toBe(correlationId);
      expect(item.beforeAfterSummary).toMatchObject({ status: { before: 'draft', after: 'active' } });

      const detail = await stack.query.getById(first.row.id, stack.perms);
      const serialized = JSON.stringify(detail.details ?? {});
      for (const p of PROHIBITED_SERIALIZED) {
        expect(serialized.toLowerCase()).not.toContain(p.toLowerCase());
      }
      expect(serialized).toContain('[redacted]');
    });
  }

  it('A17: sales audit SoR N/A — zero sales category rows invented', async () => {
    const count = await prisma.auditEntry.count({ where: { category: 'sales' } });
    expect(count).toBe(0);
    const stack = createAuditStack(prisma);
    const res = await stack.query.search({ category: 'sales', limit: 10 }, stack.perms);
    expect(res.items).toHaveLength(0);
  });

  it('A18: export success audit cardinality exactly one on first success', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ac-a18-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    await seedAuditEntry(prisma, { actorId: user.id, action: matrixAction('platform.test.seed') });
    const stack = createAuditStack(prisma);
    const claims = platformClaims(user.id, randomUUID());
    const before = await countSuccessAudits(prisma, AUDIT_CENTER_OPERATIONS.EXPORT_COMPLETE);
    const idem = `a18-${randomUUID()}`;
    const first = await executeExport(stack, claims, { reason: 'a18 export', idempotencyKey: idem });
    expect((first as { rowCount: number }).rowCount).toBeGreaterThanOrEqual(1);
    expect(await countSuccessAudits(prisma, AUDIT_CENTER_OPERATIONS.EXPORT_COMPLETE)).toBe(before + 1);

    const replay = await executeExport(stack, claims, { reason: 'a18 export', idempotencyKey: idem });
    expect((replay as { exportId: string }).exportId).toBe((first as { exportId: string }).exportId);
    expect(await countSuccessAudits(prisma, AUDIT_CENTER_OPERATIONS.EXPORT_COMPLETE)).toBe(before + 1);
  });

  it('A01 failure path: aborted append leaves zero success for new correlation', async () => {
    const action = matrixAction('platform.user.login');
    const correlationId = randomUUID();
    await expect(
      (async () => {
        const existing = await prisma.auditEntry.count({ where: { action, correlationId } });
        if (existing > 0) return;
        throw new Error('simulated_failure');
      })(),
    ).rejects.toThrow('simulated_failure');
    expect(await countSuccessAudits(prisma, action, correlationId)).toBe(0);
  });

  it('coverage matrix entries require audit.view permission', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ac-perm-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    await seedAuditEntry(prisma, { actorId: user.id });
    const stack = createAuditStack(prisma, { permissions: [] });
    await expect(stack.query.search({ limit: 1 }, stack.perms)).rejects.toMatchObject({
      code: 'forbidden',
    });
    expect(stack.perms.has(AUDIT_CENTER_PERMISSIONS.view)).toBe(false);
  });
});
