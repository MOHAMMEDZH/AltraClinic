/**
 * Phase 47 Step 08 — concurrent bootstrap + rollback against PostgreSQL.
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  bootstrapPlatformOwnerAtomic,
  hashBootstrapPassword,
  PlatformBootstrapConflictError,
} from '../application/services/platform-bootstrap.service';
import {
  cleanupPlatformSecurityTables,
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
} from './platform-db-security.harness';

const run = platformDbSecurityEnabled();

describe('platform bootstrap DB concurrency (postgres)', () => {
  let a: PrismaClient;
  let b: PrismaClient;

  beforeAll(async () => {
    if (!run) return;
    process.env.ALLOW_TEST_DATABASE_RESET = 'true';
    process.env.RUN_PLATFORM_DB_SECURITY = 'true';
    a = createPlatformDbSecurityClient();
    b = createPlatformDbSecurityClient();
    await a.$connect();
    await b.$connect();
  });

  afterAll(async () => {
    if (!run) return;
    await cleanupPlatformSecurityTables(a);
    await a.$disconnect();
    await b.$disconnect();
  });

  beforeEach(async () => {
    if (!run) return;
    await cleanupPlatformSecurityTables(a);
  });

  (run ? it : it.skip)('concurrent bootstrap creates exactly one owner', async () => {
    const hashA = await hashBootstrapPassword('BootstrapPass12!!');
    const hashB = await hashBootstrapPassword('BootstrapPass12!!');
    const emailA = `owner-a-${randomUUID()}@example.com`;
    const emailB = `owner-b-${randomUUID()}@example.com`;

    const results = await Promise.allSettled([
      bootstrapPlatformOwnerAtomic(a, { email: emailA, passwordHash: hashA }),
      bootstrapPlatformOwnerAtomic(b, { email: emailB, passwordHash: hashB }),
    ]);

    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect((failed[0] as PromiseRejectedResult).reason).toBeInstanceOf(PlatformBootstrapConflictError);

    expect(await a.platformUser.count()).toBe(1);
    expect(await a.platformUserRole.count({ where: { roleKey: 'platform_owner', revokedAt: null } })).toBe(1);
    expect(await a.platformRefreshToken.count()).toBe(0);

    const user = await a.platformUser.findFirstOrThrow();
    expect(user.mfaEnabled).toBe(false);
    expect(user.passwordHash.startsWith('$2')).toBe(true);
    expect(user.passwordHash).not.toContain('BootstrapPass');

    await expect(
      bootstrapPlatformOwnerAtomic(a, {
        email: `again-${randomUUID()}@example.com`,
        passwordHash: hashA,
      }),
    ).rejects.toBeInstanceOf(PlatformBootstrapConflictError);
  });

  (run ? it : it.skip)('injected failure after user create rolls back completely', async () => {
    const hash = await hashBootstrapPassword('BootstrapPass12!!');
    await expect(
      bootstrapPlatformOwnerAtomic(
        a,
        { email: `partial-${randomUUID()}@example.com`, passwordHash: hash },
        { failAfterUserCreate: true },
      ),
    ).rejects.toThrow(/Injected bootstrap failure/);

    expect(await a.platformUser.count()).toBe(0);
    expect(await a.platformUserRole.count()).toBe(0);

    await expect(
      bootstrapPlatformOwnerAtomic(a, {
        email: `recover-${randomUUID()}@example.com`,
        passwordHash: hash,
      }),
    ).resolves.toMatchObject({ email: expect.stringContaining('recover-') });
    expect(await a.platformUser.count()).toBe(1);
  });
});
