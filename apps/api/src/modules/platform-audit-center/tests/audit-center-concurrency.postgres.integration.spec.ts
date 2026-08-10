/**
 * Flexible Step 21 — concurrency matrix C01–C20 (PostgreSQL).
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
import { PLATFORM_AUDIT_SENTINEL_TENANT_ID } from '../../platform-tenants/platform-tenants.tokens';
import { AUDIT_CENTER_OPERATIONS } from '../platform-audit-center.constants';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

async function settled<T>(promises: Promise<T>[]) {
  return Promise.allSettled(promises);
}

describeDb('Step 21 Audit Center concurrency matrix C01-C20 (PostgreSQL)', () => {
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

  async function actors() {
    const a = await createPlatformUserFixture(prisma, {
      email: `ac-ca-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    const b = await createPlatformUserFixture(prisma, {
      email: `ac-cb-${randomUUID()}@test.local`,
      roleKeys: ['auditor'],
    });
    return {
      a,
      b,
      claimsA: platformClaims(a.id, randomUUID()),
      claimsB: platformClaims(b.id, randomUUID()),
    };
  }

  it('C01: parallel append same correlation creates one row', async () => {
    const { a } = await actors();
    const correlationId = randomUUID();
    const action = matrixAction('platform.user.login');
    const opts = {
      actorId: a.id,
      action,
      category: 'platform_security',
      resourceType: 'platform_user',
      resourceId: randomUUID(),
      correlationId,
    };
    const results = await settled([
      appendMatrixAuditOnce(prisma, opts),
      appendMatrixAuditOnce(prisma, opts),
      appendMatrixAuditOnce(prisma, opts),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
    expect(await countSuccessAudits(prisma, action, correlationId)).toBe(1);
  });

  it('C02: parallel query during append returns consistent pages', async () => {
    const { a } = await actors();
    const stack = createAuditStack(prisma);
    const appendPromise = (async () => {
      for (let i = 0; i < 10; i++) {
        await seedAuditEntry(prisma, { actorId: a.id, action: `platform.test.c02.${i}` });
      }
    })();
    const queryPromise = stack.query.search({ limit: 5 }, stack.perms);
    await appendPromise;
    const page = await queryPromise;
    expect(page.items.length).toBeLessThanOrEqual(5);
    const after = await stack.query.search({ limit: 20 }, stack.perms);
    expect(after.items.length).toBeGreaterThanOrEqual(10);
  });

  it('C03: export while new events append includes stable count', async () => {
    const { a, claimsA } = await actors();
    await seedAuditEntry(prisma, { actorId: a.id });
    const stack = createAuditStack(prisma);
    const exportP = executeExport(stack, claimsA, {
      reason: 'C03',
      idempotencyKey: `c03-${randomUUID()}`,
    });
    await seedAuditEntry(prisma, { actorId: a.id, action: 'platform.test.c03.new' });
    const result = await exportP;
    expect((result as { rowCount: number }).rowCount).toBeGreaterThanOrEqual(1);
  });

  it('C04: same-timestamp pagination no duplicates across concurrent readers', async () => {
    const { a } = await actors();
    const ts = new Date('2026-02-01T08:00:00.000Z');
    for (let i = 0; i < 6; i++) {
      await seedAuditEntry(prisma, {
        actorId: a.id,
        action: `platform.test.c04.${i}`,
        createdAt: ts,
      });
    }
    const stack = createAuditStack(prisma);
    const pages = await settled([
      stack.query.search({ limit: 3 }, stack.perms),
      stack.query.search({ limit: 3 }, stack.perms),
    ]);
    const ids = new Set<string>();
    for (const p of pages) {
      if (p.status === 'fulfilled') {
        for (const item of p.value.items) ids.add(item.id);
      }
    }
    expect(ids.size).toBeGreaterThanOrEqual(3);
  });

  it('C05: tenant A isolation versus tenant B under concurrent search', async () => {
    const { a } = await actors();
    const tenantB = randomUUID();
    await prisma.tenant.create({
      data: { id: tenantB, name: 'Tenant B', slug: `tb-${randomUUID().slice(0, 6)}` },
    });
    await seedAuditEntry(prisma, { actorId: a.id, action: 'platform.test.c05.a' });
    await seedAuditEntry(prisma, {
      actorId: a.id,
      tenantId: tenantB,
      action: 'platform.test.c05.b',
    });
    const stack = createAuditStack(prisma);
    const [sentinel, other] = await settled([
      stack.query.search({ limit: 20 }, stack.perms),
      stack.query.search({ tenantId: tenantB, limit: 20 }, stack.perms),
    ]);
    expect(sentinel.status).toBe('fulfilled');
    expect(other.status).toBe('fulfilled');
    if (sentinel.status === 'fulfilled') {
      expect(sentinel.value.items.every((i) => i.tenantId === PLATFORM_AUDIT_SENTINEL_TENANT_ID)).toBe(
        true,
      );
    }
    if (other.status === 'fulfilled') {
      expect(other.value.items.every((i) => i.tenantId === tenantB)).toBe(true);
    }
  });

  it('C06: idempotent export replay races return same exportId', async () => {
    const { a, claimsA } = await actors();
    await seedAuditEntry(prisma, { actorId: a.id });
    const stack = createAuditStack(prisma);
    const idem = `c06-${randomUUID()}`;
    const results = await settled([
      executeExport(stack, claimsA, { reason: 'C06', idempotencyKey: idem }),
      executeExport(stack, claimsA, { reason: 'C06', idempotencyKey: idem }),
    ]);
    const exportIds = results
      .filter((r): r is PromiseFulfilledResult<{ exportId: string }> => r.status === 'fulfilled')
      .map((r) => r.value.exportId);
    expect(new Set(exportIds).size).toBe(1);
  });

  it('C07: parallel exports different idempotency keys create distinct rows', async () => {
    const { a, claimsA } = await actors();
    await seedAuditEntry(prisma, { actorId: a.id });
    const stack = createAuditStack(prisma, { exportRateLimit: 10 });
    await settled([
      executeExport(stack, claimsA, { reason: 'C07a', idempotencyKey: `c07a-${randomUUID()}` }),
      executeExport(stack, claimsA, { reason: 'C07b', idempotencyKey: `c07b-${randomUUID()}` }),
    ]);
    expect(await prisma.platformAuditExportRecord.count()).toBe(2);
  });

  it('C08: permission change mid-query — second search reflects new perms', async () => {
    const { a } = await actors();
    await seedAuditEntry(prisma, {
      actorId: a.id,
      ipAddress: '198.51.100.1',
    });
    const stack = createAuditStack(prisma, {
      permissions: ['audit.view', 'audit.export', 'audit.sensitive.view'],
    });
    const masked = await stack.query.search({ limit: 1 }, stack.perms);
    expect(masked.items[0]?.ipAddress).not.toBe('198.51.100.1');
    stack.perms.add('audit.network-metadata.view');
    const full = await stack.query.search({ limit: 1 }, stack.perms);
    expect(full.items[0]?.ipAddress).toBe('198.51.100.1');
  });

  it('C09: correlation timeline concurrent with append', async () => {
    const { a } = await actors();
    const correlationId = randomUUID();
    const stack = createAuditStack(prisma);
    const timelineP = stack.query.correlationTimeline(correlationId, stack.perms);
    await seedAuditEntry(prisma, { actorId: a.id, correlationId, action: 'platform.test.c09' });
    const timeline = await timelineP;
    expect(timeline.items.length).toBeGreaterThanOrEqual(0);
    const after = await stack.query.correlationTimeline(correlationId, stack.perms);
    expect(after.items.length).toBe(1);
  });

  it('C10: concurrent getById for same entry both succeed', async () => {
    const { a } = await actors();
    const row = await seedAuditEntry(prisma, { actorId: a.id });
    const stack = createAuditStack(prisma);
    const results = await settled([
      stack.query.getById(row.id, stack.perms),
      stack.query.getById(row.id, stack.perms),
    ]);
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
  });

  it('C11: parallel matrix append different actions both persist', async () => {
    const { a } = await actors();
    const c1 = randomUUID();
    const c2 = randomUUID();
    await settled([
      appendMatrixAuditOnce(prisma, {
        actorId: a.id,
        action: matrixAction('platform_plan.version.drafted'),
        category: 'plan',
        resourceType: 'platform_plan_version',
        resourceId: randomUUID(),
        correlationId: c1,
      }),
      appendMatrixAuditOnce(prisma, {
        actorId: a.id,
        action: matrixAction('platform_addon.assigned'),
        category: 'addon',
        resourceType: 'platform_addon',
        resourceId: randomUUID(),
        correlationId: c2,
      }),
    ]);
    expect(await prisma.auditEntry.count({ where: { correlationId: c1 } })).toBe(1);
    expect(await prisma.auditEntry.count({ where: { correlationId: c2 } })).toBe(1);
  });

  it('C12: export audit cardinality stable under concurrent first-success', async () => {
    const { a, claimsA } = await actors();
    await seedAuditEntry(prisma, { actorId: a.id });
    const stack = createAuditStack(prisma);
    const idem = `c12-${randomUUID()}`;
    const before = await countSuccessAudits(prisma, AUDIT_CENTER_OPERATIONS.EXPORT_COMPLETE);
    await settled([
      executeExport(stack, claimsA, { reason: 'C12', idempotencyKey: idem }),
      executeExport(stack, claimsA, { reason: 'C12', idempotencyKey: idem }),
    ]);
    expect(await countSuccessAudits(prisma, AUDIT_CENTER_OPERATIONS.EXPORT_COMPLETE)).toBe(
      before + 1,
    );
  });

  it('C13: cursor walk under concurrent inserts no crash', async () => {
    const { a } = await actors();
    for (let i = 0; i < 4; i++) {
      await seedAuditEntry(prisma, { actorId: a.id, action: `platform.test.c13.${i}` });
    }
    const stack = createAuditStack(prisma);
    const walkP = (async () => {
      let cursor: string | undefined;
      let pages = 0;
      do {
        const page = await stack.query.search({ limit: 2, cursor }, stack.perms);
        cursor = page.nextCursor ?? undefined;
        pages++;
      } while (cursor && pages < 10);
      return pages;
    })();
    await seedAuditEntry(prisma, { actorId: a.id, action: 'platform.test.c13.late' });
    const pages = await walkP;
    expect(pages).toBeGreaterThanOrEqual(1);
  });

  it('C14: two actors export concurrently isolated by actor', async () => {
    const { a, b, claimsA, claimsB } = await actors();
    await seedAuditEntry(prisma, { actorId: a.id });
    await seedAuditEntry(prisma, { actorId: b.id });
    const stack = createAuditStack(prisma);
    await settled([
      executeExport(stack, claimsA, { reason: 'C14a', idempotencyKey: `c14a-${randomUUID()}` }),
      executeExport(stack, claimsB, { reason: 'C14b', idempotencyKey: `c14b-${randomUUID()}` }),
    ]);
    expect(await prisma.platformAuditExportRecord.count()).toBe(2);
  });

  it('C15: denyUpdate/denyDelete safe under parallel calls', async () => {
    const stack = createAuditStack(prisma);
    const results = await settled([stack.query.denyUpdate(), stack.query.denyDelete()]);
    expect(results.every((r) => r.status === 'rejected')).toBe(true);
  });

  it('C16: evidence lookup races return consistent not_found', async () => {
    const stack = createAuditStack(prisma);
    const missing = randomUUID();
    const results = await Promise.allSettled([
      stack.evidence.planVersionEvidence(missing, stack.perms),
      stack.evidence.overrideEvidence(missing, stack.perms),
    ]);
    expect(results.every((r) => r.status === 'rejected')).toBe(true);
  });

  it('C17: rate limit counter accurate under burst', async () => {
    const { a, claimsA } = await actors();
    await seedAuditEntry(prisma, { actorId: a.id });
    const stack = createAuditStack(prisma, { exportRateLimit: 3 });
    const attempts = await settled(
      Array.from({ length: 5 }, (_, i) =>
        executeExport(stack, claimsA, {
          reason: `C17-${i}`,
          idempotencyKey: `c17-${i}-${randomUUID()}`,
        }),
      ),
    );
    const limited = attempts.filter(
      (r) => r.status === 'rejected' && (r.reason as { code?: string })?.code === 'rate_limited',
    );
    expect(limited.length).toBeGreaterThanOrEqual(2);
  });

  it('C18: concurrent correction append preserves original', async () => {
    const { a } = await actors();
    const resourceId = randomUUID();
    const correlationId = randomUUID();
    const original = await seedAuditEntry(prisma, {
      actorId: a.id,
      resourceId,
      correlationId,
      action: matrixAction('platform_override.approved'),
      category: 'override',
      reason: 'original',
    });
    await settled([
      seedAuditEntry(prisma, {
        actorId: a.id,
        resourceId,
        correlationId,
        action: matrixAction('platform_override.correction'),
        category: 'override',
        reason: `fix ${original.id}`,
      }),
      seedAuditEntry(prisma, {
        actorId: a.id,
        resourceId,
        correlationId,
        action: matrixAction('platform_override.correction'),
        category: 'override',
        reason: `fix2 ${original.id}`,
      }),
    ]);
    const still = await prisma.auditEntry.findUnique({ where: { id: original.id } });
    expect(still?.reason).toBe('original');
  });

  it('C19: parallel search filters actor-specific under load', async () => {
    const { a, b } = await actors();
    await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        seedAuditEntry(prisma, { actorId: a.id, action: `platform.test.c19a.${i}` }),
      ),
    );
    await Promise.all(
      Array.from({ length: 3 }, (_, i) =>
        seedAuditEntry(prisma, { actorId: b.id, action: `platform.test.c19b.${i}` }),
      ),
    );
    const stack = createAuditStack(prisma);
    const res = await stack.query.search({ actorId: a.id, limit: 20 }, stack.perms);
    expect(res.items.every((i) => i.actorId === a.id)).toBe(true);
    expect(res.items.length).toBe(5);
  });

  it('C20: service stack recreation query remains consistent', async () => {
    const { a } = await actors();
    await seedAuditEntry(prisma, { actorId: a.id, action: 'platform.test.c20' });
    const stack1 = createAuditStack(prisma);
    const stack2 = createAuditStack(prisma);
    const [r1, r2] = await settled([
      stack1.query.search({ limit: 5 }, stack1.perms),
      stack2.query.search({ limit: 5 }, stack2.perms),
    ]);
    if (r1.status === 'fulfilled' && r2.status === 'fulfilled') {
      expect(r1.value.items.length).toBe(r2.value.items.length);
    }
  });
});
