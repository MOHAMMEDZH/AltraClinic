/**
 * Flexible Step 27 — query / index bounds matrix.
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  createPlatformNotificationsStack,
  NOTIFICATIONS_ADMIN_PERMS,
  type PlatformNotificationsStack,
} from './platform-notifications-stack';
import {
  assertSafePlatformTestDatabaseUrl,
  cleanupPlatformNotificationsTables,
  clearPlatformNotificationFailureInjection,
  createPlatformDbSecurityClient,
  createPlatformUserFixture,
  createQueryCountingClient,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  ensureSentinel,
  platformClaims,
  platformDbSecurityEnabled,
} from './platform-notifications-db.harness';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 27 query/index bounds (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let stack: PlatformNotificationsStack;
  const perms = new Set(NOTIFICATIONS_ADMIN_PERMS);

  beforeAll(async () => {
    assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
    prisma = createPlatformDbSecurityClient();
    await ensureSentinel(prisma);
  });

  afterAll(async () => {
    await cleanupPlatformNotificationsTables(prisma);
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    clearPlatformNotificationFailureInjection();
    process.env.NODE_ENV = 'test';
    await cleanupPlatformNotificationsTables(prisma);
    stack = createPlatformNotificationsStack(prisma);
  });

  async function seedInvites(n: number) {
    for (let i = 0; i < n; i++) {
      await stack.adapters.invitationSent({
        invitationId: randomUUID(),
        platformUserId: randomUUID(),
        recipientEmail: `q-${i}-${randomUUID()}@test.local`,
        recipientDisplayName: 'Admin',
        inviterDisplayName: 'Root',
        expiresAt: new Date().toISOString(),
      });
    }
  }

  it('Q01: listDeliveries pageSize is capped at 100', async () => {
    await seedInvites(3);
    const list = await stack.query.listDeliveries(perms, { pageSize: 500 });
    expect(list.pageSize).toBe(100);
  });

  it('Q02: listDeliveries ordering is createdAt desc, id desc', async () => {
    await seedInvites(3);
    const list = await stack.query.listDeliveries(perms, { pageSize: 10 });
    const pairs = list.items.map((i) => `${i.createdAt}|${i.id}`);
    const sorted = [...list.items]
      .sort((a, b) => {
        const t = b.createdAt.localeCompare(a.createdAt);
        return t !== 0 ? t : b.id.localeCompare(a.id);
      })
      .map((i) => `${i.createdAt}|${i.id}`);
    expect(pairs).toEqual(sorted);
  });

  it('Q03: preference unique index (user, category, channel) enforced', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `q03-${randomUUID()}@test.local`,
    });
    await prisma.platformNotificationPreference.create({
      data: {
        platformUserId: user.id,
        category: 'usage',
        channel: 'email',
        enabled: true,
      },
    });
    await expect(
      prisma.platformNotificationPreference.create({
        data: {
          platformUserId: user.id,
          category: 'usage',
          channel: 'email',
          enabled: false,
        },
      }),
    ).rejects.toThrow();
  });

  it('Q04: preference list ordered by category, channel, id', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `q04-${randomUUID()}@test.local`,
    });
    const claims = platformClaims(user.id, randomUUID());
    await stack.prefs.upsert(
      claims,
      perms,
      { category: 'usage', channel: 'email', enabled: true },
      randomUUID(),
    );
    await stack.prefs.upsert(
      claims,
      perms,
      { category: 'sales', channel: 'email', enabled: true },
      randomUUID(),
    );
    const rows = await stack.prefs.list(claims, perms);
    const keys = rows.map((r) => `${r.category}|${r.channel}`);
    expect(keys).toEqual([...keys].sort());
  });

  it('Q05: template list is bounded (exactly 24, no DB scan)', () => {
    const list = stack.query.listTemplates(perms);
    expect(list).toHaveLength(24);
  });

  it('Q06: listDeliveries query count is bounded for small N', async () => {
    const qc = createQueryCountingClient();
    try {
      await ensureSentinel(qc.client);
      await cleanupPlatformNotificationsTables(qc.client);
      const local = createPlatformNotificationsStack(qc.client);
      for (let i = 0; i < 5; i++) {
        await local.adapters.invitationSent({
          invitationId: randomUUID(),
          platformUserId: randomUUID(),
          recipientEmail: `qc-${i}-${randomUUID()}@test.local`,
          recipientDisplayName: 'Admin',
          inviterDisplayName: 'Root',
          expiresAt: new Date().toISOString(),
        });
      }
      qc.reset();
      await local.query.listDeliveries(new Set(NOTIFICATIONS_ADMIN_PERMS), { pageSize: 25 });
      expect(qc.counted()).toBeLessThan(40);
    } finally {
      await cleanupPlatformNotificationsTables(qc.client);
      await qc.client.$disconnect();
    }
  });

  it('Q07: preference index definitions include user+category(+channel)', async () => {
    const rows = await prisma.$queryRawUnsafe<Array<{ indexdef: string }>>(
      `SELECT indexdef FROM pg_indexes WHERE tablename = 'platform_notification_preferences'`,
    );
    const defs = rows.map((r) => r.indexdef).join('\n');
    expect(defs).toContain('platformUserId');
    expect(defs).toContain('category');
    expect(defs).toContain('channel');
    expect(defs).toMatch(/UNIQUE|unique/i);
  });

  it('Q08: status filter on listDeliveries does not invent rows', async () => {
    await seedInvites(2);
    const list = await stack.query.listDeliveries(perms, {
      pageSize: 50,
      status: 'does_not_exist_status',
    });
    expect(list.total).toBe(0);
    expect(list.items).toHaveLength(0);
  });
});
