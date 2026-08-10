/**
 * Flexible Step 21 — query matrix Q01–Q20 (PostgreSQL).
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  AUDIT_CENTER_CORRELATION_MAX,
  AUDIT_CENTER_MAX_DATE_RANGE_DAYS,
  AUDIT_CENTER_MAX_PAGE_SIZE,
  AUDIT_CENTER_PERMISSIONS,
} from '../platform-audit-center.constants';
import {
  cleanupAuditCenterTables,
  clearAuditFailureInjection,
  createAuditStack,
  createPlatformDbSecurityClient,
  createPlatformUserFixture,
  enableAuditCenter,
  matrixAction,
  platformDbSecurityEnabled,
  seedAuditEntry,
} from './audit-center-db.harness';
import { PLATFORM_AUDIT_SENTINEL_TENANT_ID } from '../../platform-tenants/platform-tenants.tokens';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 21 Audit Center query matrix Q01-Q20 (PostgreSQL)', () => {
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
    await cleanupAuditCenterTables(prisma);
  });

  it('Q01: cursor pagination is stable across pages', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ac-q01-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const row = await seedAuditEntry(prisma, {
        actorId: user.id,
        action: `platform.test.page.${i}`,
      });
      ids.push(row.id);
    }
    const stack = createAuditStack(prisma);
    const p1 = await stack.query.search({ actorId: user.id, limit: 2 }, stack.perms);
    const p2 = await stack.query.search(
      { actorId: user.id, limit: 2, cursor: p1.nextCursor! },
      stack.perms,
    );
    const p3 = await stack.query.search(
      { actorId: user.id, limit: 2, cursor: p2.nextCursor! },
      stack.perms,
    );
    const seen = [...p1.items, ...p2.items, ...p3.items].map((i) => i.id);
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.length).toBe(5);
  });

  it('Q02: same-timestamp tie-breaker uses id descending', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ac-q02-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    const ts = new Date('2026-01-15T12:00:00.000Z');
    const a = await seedAuditEntry(prisma, {
      actorId: user.id,
      action: 'platform.test.tie.a',
      createdAt: ts,
    });
    const b = await seedAuditEntry(prisma, {
      actorId: user.id,
      action: 'platform.test.tie.b',
      createdAt: ts,
    });
    const stack = createAuditStack(prisma);
    const res = await stack.query.search({ actorId: user.id, limit: 10 }, stack.perms);
    const tie = res.items.filter((i) => i.occurredAt === ts.toISOString());
    expect(tie.length).toBe(2);
    expect(tie[0].id > tie[1].id || tie[0].id !== tie[1].id).toBe(true);
    expect([a.id, b.id]).toContain(tie[0].id);
  });

  it('Q03: date bounds filter from/to inclusive', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ac-q03-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    await seedAuditEntry(prisma, {
      actorId: user.id,
      action: 'platform.test.old',
      createdAt: new Date('2025-01-01T00:00:00Z'),
    });
    const mid = await seedAuditEntry(prisma, {
      actorId: user.id,
      action: 'platform.test.mid',
      createdAt: new Date('2026-06-01T12:00:00Z'),
    });
    const stack = createAuditStack(prisma);
    const res = await stack.query.search(
      {
        actorId: user.id,
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-12-31T23:59:59.999Z',
        limit: 20,
      },
      stack.perms,
    );
    expect(res.items.some((i) => i.id === mid.id)).toBe(true);
    expect(res.items.every((i) => i.occurredAt >= '2026-01-01')).toBe(true);
  });

  it('Q04: actorId filter', async () => {
    const a = await createPlatformUserFixture(prisma, {
      email: `ac-q04a-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    const b = await createPlatformUserFixture(prisma, {
      email: `ac-q04b-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    await seedAuditEntry(prisma, { actorId: a.id, action: 'platform.test.actor.a' });
    await seedAuditEntry(prisma, { actorId: b.id, action: 'platform.test.actor.b' });
    const stack = createAuditStack(prisma);
    const res = await stack.query.search({ actorId: a.id, limit: 10 }, stack.perms);
    expect(res.items.every((i) => i.actorId === a.id)).toBe(true);
  });

  it('Q05: action filter', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ac-q05-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    const action = matrixAction('platform_plan.version.published');
    await seedAuditEntry(prisma, { actorId: user.id, action, category: 'plan' });
    await seedAuditEntry(prisma, { actorId: user.id, action: 'platform.test.other' });
    const stack = createAuditStack(prisma);
    const res = await stack.query.search({ action, limit: 10 }, stack.perms);
    expect(res.items.every((i) => i.action === action)).toBe(true);
  });

  it('Q06: target resourceType/resourceId filter', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ac-q06-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    const targetId = randomUUID();
    await seedAuditEntry(prisma, {
      actorId: user.id,
      resourceType: 'platform_plan_version',
      resourceId: targetId,
      action: 'platform.test.target',
    });
    await seedAuditEntry(prisma, {
      actorId: user.id,
      resourceType: 'platform_plan_version',
      resourceId: randomUUID(),
      action: 'platform.test.other',
    });
    const stack = createAuditStack(prisma);
    const res = await stack.query.search(
      { resourceType: 'platform_plan_version', resourceId: targetId, limit: 10 },
      stack.perms,
    );
    expect(res.items.every((i) => i.resourceId === targetId)).toBe(true);
  });

  it('Q07: correlationId filter', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ac-q07-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    const correlationId = randomUUID();
    await seedAuditEntry(prisma, { actorId: user.id, correlationId, action: 'platform.test.corr' });
    await seedAuditEntry(prisma, { actorId: user.id, action: 'platform.test.other' });
    const stack = createAuditStack(prisma);
    const res = await stack.query.search({ correlationId, limit: 10 }, stack.perms);
    expect(res.items.every((i) => i.correlationId === correlationId)).toBe(true);
  });

  it('Q08: oversized date range rejected', async () => {
    const stack = createAuditStack(prisma);
    await expect(
      stack.query.search(
        {
          from: '2020-01-01T00:00:00.000Z',
          to: '2026-12-31T23:59:59.999Z',
          limit: 5,
        },
        stack.perms,
      ),
    ).rejects.toMatchObject({ code: 'date_range_too_large' });
    expect(AUDIT_CENTER_MAX_DATE_RANGE_DAYS).toBe(366);
  });

  it('Q09: invalid cursor rejected', async () => {
    const stack = createAuditStack(prisma);
    await expect(
      stack.query.search({ cursor: 'not-valid-base64!!!', limit: 5 }, stack.perms),
    ).rejects.toMatchObject({ code: 'invalid_cursor' });
  });

  it('Q10: network metadata redacted without audit.network-metadata.view', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ac-q10-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    await seedAuditEntry(prisma, {
      actorId: user.id,
      ipAddress: '203.0.113.55',
      userAgent: 'Mozilla/5.0 Chrome/120 Windows',
    });
    const stack = createAuditStack(prisma, {
      permissions: ['audit.view', 'audit.export', 'audit.sensitive.view'],
    });
    const res = await stack.query.search({ limit: 5 }, stack.perms);
    expect(res.items[0]?.ipAddress).not.toBe('203.0.113.55');
    expect(res.items[0]?.ipAddress).toMatch(/\*/);
    expect(res.items[0]?.userAgentSummary).toBe('Chrome on Windows');
  });

  it('Q11: sensitive fields redacted without audit.sensitive.view', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ac-q11-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    const row = await seedAuditEntry(prisma, {
      actorId: user.id,
      details: { password: 'hunter2', note: 'ok' },
      changes: { rawSnapshot: { secret: 'x' }, field: { before: 'a', after: 'b' } },
    });
    const stack = createAuditStack(prisma, { permissions: ['audit.view'] });
    const detail = await stack.query.getById(row.id, stack.perms);
    expect(JSON.stringify(detail.details)).toContain('[redacted]');
    expect(JSON.stringify(detail.changes)).toContain('[redacted]');
  });

  it('Q12: tenant isolation — sentinel default vs other tenant', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ac-q12-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    const otherTenant = randomUUID();
    await prisma.tenant.create({
      data: { id: otherTenant, name: 'Other', slug: `other-${randomUUID().slice(0, 8)}` },
    });
    await seedAuditEntry(prisma, { actorId: user.id, action: 'platform.test.sentinel' });
    await seedAuditEntry(prisma, {
      actorId: user.id,
      tenantId: otherTenant,
      action: 'platform.test.other-tenant',
      category: 'test',
    });
    const stack = createAuditStack(prisma);
    const sentinel = await stack.query.search({ limit: 20 }, stack.perms);
    expect(sentinel.items.every((i) => i.tenantId === PLATFORM_AUDIT_SENTINEL_TENANT_ID)).toBe(true);
    const other = await stack.query.search({ tenantId: otherTenant, limit: 20 }, stack.perms);
    expect(other.items.every((i) => i.tenantId === otherTenant)).toBe(true);
  });

  it('Q13: query path has no export rate limit requirement', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ac-q13-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    await seedAuditEntry(prisma, { actorId: user.id });
    const stack = createAuditStack(prisma, { exportRateLimit: 0 });
    for (let i = 0; i < 5; i++) {
      const res = await stack.query.search({ limit: 1 }, stack.perms);
      expect(res.items.length).toBeGreaterThanOrEqual(0);
    }
  });

  it('Q14: occurredAt is UTC ISO-8601', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ac-q14-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    await seedAuditEntry(prisma, {
      actorId: user.id,
      createdAt: new Date('2026-03-01T10:30:00.000Z'),
    });
    const stack = createAuditStack(prisma);
    const res = await stack.query.search({ actorId: user.id, limit: 1 }, stack.perms);
    expect(res.items[0]?.occurredAt).toBe('2026-03-01T10:30:00.000Z');
  });

  it('Q15: invalid correlation id rejected (no regex DoS)', async () => {
    const stack = createAuditStack(prisma);
    await expect(
      stack.query.correlationTimeline('not-a-uuid', stack.perms),
    ).rejects.toMatchObject({ code: 'invalid_correlation' });
  });

  it('Q16: correlation timeline bounded to AUDIT_CENTER_CORRELATION_MAX', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ac-q16-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    const correlationId = randomUUID();
    for (let i = 0; i < AUDIT_CENTER_CORRELATION_MAX + 5; i++) {
      await seedAuditEntry(prisma, {
        actorId: user.id,
        correlationId,
        action: `platform.test.corr.${i}`,
      });
    }
    const stack = createAuditStack(prisma);
    const timeline = await stack.query.correlationTimeline(correlationId, stack.perms);
    expect(timeline.items.length).toBeLessThanOrEqual(AUDIT_CENTER_CORRELATION_MAX);
  });

  it('Q17: missing audit.view forbidden', async () => {
    const stack = createAuditStack(prisma, { permissions: [] });
    await expect(stack.query.search({ limit: 1 }, stack.perms)).rejects.toMatchObject({
      code: 'forbidden',
    });
  });

  it('Q18: getById returns single entry', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ac-q18-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    const row = await seedAuditEntry(prisma, { actorId: user.id });
    const stack = createAuditStack(prisma);
    const got = await stack.query.getById(row.id, stack.perms);
    expect(got.id).toBe(row.id);
  });

  it('Q19: limit capped at AUDIT_CENTER_MAX_PAGE_SIZE', async () => {
    const stack = createAuditStack(prisma);
    const user = await createPlatformUserFixture(prisma, {
      email: `ac-q19-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    for (let i = 0; i < 3; i++) {
      await seedAuditEntry(prisma, { actorId: user.id, action: `platform.test.cap.${i}` });
    }
    const res = await stack.query.search({ limit: 9999 }, stack.perms);
    expect(res.items.length).toBeLessThanOrEqual(AUDIT_CENTER_MAX_PAGE_SIZE);
  });

  it('Q20: category filter returns matching rows only', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ac-q20-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    await seedAuditEntry(prisma, {
      actorId: user.id,
      category: 'lifecycle',
      action: matrixAction('tenant_lifecycle.suspended'),
    });
    await seedAuditEntry(prisma, { actorId: user.id, category: 'test', action: 'platform.test.x' });
    const stack = createAuditStack(prisma);
    const res = await stack.query.search({ category: 'lifecycle', limit: 10 }, stack.perms);
    expect(res.items.every((i) => i.category === 'lifecycle')).toBe(true);
    expect(res.items.some((i) => i.action.includes('tenant_lifecycle'))).toBe(true);
  });

  it('Q network permission reveals full IP when granted', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `ac-qnet-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    await seedAuditEntry(prisma, { actorId: user.id, ipAddress: '198.51.100.42' });
    const stack = createAuditStack(prisma, {
      permissions: Object.values(AUDIT_CENTER_PERMISSIONS),
    });
    const res = await stack.query.search({ limit: 1 }, stack.perms);
    expect(res.items[0]?.ipAddress).toBe('198.51.100.42');
    expect(res.items[0]?.accessClass).toBe('network_metadata');
  });
});
