/**
 * Flexible Step 21 — foundation + immutability + query + export smoke (PostgreSQL).
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  cleanupAuditCenterTables,
  clearAuditFailureInjection,
  createAuditStack,
  createPlatformDbSecurityClient,
  createPlatformUserFixture,
  enableAuditCenter,
  ensureAuditImmutabilityTrigger,
  platformClaims,
  platformDbSecurityEnabled,
  seedAuditEntry,
  setAuditFailureInjection,
} from './audit-center-db.harness';
import { PLATFORM_AUDIT_SENTINEL_TENANT_ID } from '../../platform-tenants/platform-tenants.tokens';
import { isAuditCenterFailureInjectionActive } from '../platform-audit-center.constants';
import { csvSafeCell } from '../application/audit-center-redaction';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 21 Audit Center core (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let restore: () => void;

  beforeAll(async () => {
    prisma = createPlatformDbSecurityClient();
    restore = enableAuditCenter();
    await ensureAuditImmutabilityTrigger(prisma);
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

  it('I01-I02 application denies update/delete', async () => {
    const stack = createAuditStack(prisma);
    await expect(stack.query.denyUpdate()).rejects.toMatchObject({ code: 'immutable' });
    await expect(stack.query.denyDelete()).rejects.toMatchObject({ code: 'immutable' });
  });

  it('I05-I06 runtime SQL update/delete on audit_entries denied by trigger', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ac-i-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    const row = await seedAuditEntry(prisma, { actorId: user.id });
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE "audit_entries" SET "reason" = 'hacked' WHERE "id" = $1::uuid`,
        row.id,
      ),
    ).rejects.toBeTruthy();
    await expect(
      prisma.$executeRawUnsafe(`DELETE FROM "audit_entries" WHERE "id" = $1::uuid`, row.id),
    ).rejects.toBeTruthy();
    const still = await prisma.auditEntry.findUnique({ where: { id: row.id } });
    expect(still?.reason).toBe('test reason');
  });

  it('Q01 cursor pagination is stable', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ac-q-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    for (let i = 0; i < 5; i++) {
      await seedAuditEntry(prisma, { actorId: user.id, action: `platform.test.page.${i}` });
    }
    const stack = createAuditStack(prisma);
    const page1 = await stack.query.search({ limit: 2 }, stack.perms);
    expect(page1.items).toHaveLength(2);
    expect(page1.nextCursor).toBeTruthy();
    const page2 = await stack.query.search(
      { limit: 2, cursor: page1.nextCursor! },
      stack.perms,
    );
    expect(page2.items[0].id).not.toBe(page1.items[0].id);
  });

  it('Q redaction masks network metadata without network permission', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ac-r-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    await seedAuditEntry(prisma, {
      actorId: user.id,
      ipAddress: '203.0.113.10',
      userAgent: 'Mozilla/5.0 Chrome/120 Windows',
    });
    const stack = createAuditStack(prisma, {
      permissions: ['audit.view', 'audit.export', 'audit.sensitive.view'],
    });
    const res = await stack.query.search({ limit: 5 }, stack.perms);
    expect(res.items.some((i) => i.ipAddress === '203.0.113.10')).toBe(false);
    expect(res.items[0]?.ipAddress).toMatch(/\*/);
  });

  it('E01 export succeeds with step-up; E13 replay no duplicate audit', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ac-e-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    await seedAuditEntry(prisma, { actorId: user.id });
    const stack = createAuditStack(prisma);
    const claims = platformClaims(user.id, randomUUID());
    const filters = {};
    const preview = await stack.exports.preview({ filters, reason: 'e01', filterFingerprint: '' }, stack.perms);
    const body = {
      filters,
      reason: 'e01 export',
      filterFingerprint: preview.filterFingerprint,
    };
    const idem = `e01-${randomUUID()}`;
    const first = await stack.exports.execute(claims, body, stack.perms, idem);
    expect((first as { rowCount: number }).rowCount).toBeGreaterThanOrEqual(1);
    const auditsBefore = await prisma.auditEntry.count({
      where: { action: 'AUDIT_EXPORT_COMPLETE' },
    });
    const replay = await stack.exports.execute(claims, body, stack.perms, idem);
    expect((replay as { exportId: string }).exportId).toBe((first as { exportId: string }).exportId);
    const auditsAfter = await prisma.auditEntry.count({
      where: { action: 'AUDIT_EXPORT_COMPLETE' },
    });
    expect(auditsAfter).toBe(auditsBefore);
  });

  it('E03 stale step-up denied', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ac-e3-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    const stack = createAuditStack(prisma);
    stack.setStepUpFresh(false);
    const claims = platformClaims(user.id, randomUUID());
    const preview = await stack.exports.preview(
      { filters: {}, reason: 'x', filterFingerprint: '' },
      stack.perms,
    );
    await expect(
      stack.exports.execute(
        claims,
        { filters: {}, reason: 'stale', filterFingerprint: preview.filterFingerprint },
        stack.perms,
        randomUUID(),
      ),
    ).rejects.toBeTruthy();
  });

  it('E08 CSV formula neutralized', () => {
    expect(csvSafeCell('=CMD()')).toMatch(/^"'=/);
  });

  it('A18 export creates exactly one success audit on first success', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ac-a18-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    await seedAuditEntry(prisma, { actorId: user.id });
    const stack = createAuditStack(prisma);
    const claims = platformClaims(user.id, randomUUID());
    const preview = await stack.exports.preview(
      { filters: {}, reason: 'a18', filterFingerprint: '' },
      stack.perms,
    );
    const before = await prisma.auditEntry.count({ where: { action: 'AUDIT_EXPORT_COMPLETE' } });
    await stack.exports.execute(
      claims,
      { filters: {}, reason: 'a18', filterFingerprint: preview.filterFingerprint },
      stack.perms,
      randomUUID(),
    );
    const after = await prisma.auditEntry.count({ where: { action: 'AUDIT_EXPORT_COMPLETE' } });
    expect(after - before).toBe(1);
  });

  it('F Model B: production NODE_ENV ignores injection', async () => {
    setAuditFailureInjection('after_query_parse');
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    expect(isAuditCenterFailureInjectionActive('after_query_parse')).toBe(false);
    process.env.NODE_ENV = prev;
    clearAuditFailureInjection();
  });

  it('F01 test runtime can inject after_query_parse', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ac-f-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    await seedAuditEntry(prisma, { actorId: user.id });
    const stack = createAuditStack(prisma);
    setAuditFailureInjection('after_query_parse');
    await expect(stack.query.search({}, stack.perms)).rejects.toMatchObject({
      code: 'injected_failure',
    });
  });
});
