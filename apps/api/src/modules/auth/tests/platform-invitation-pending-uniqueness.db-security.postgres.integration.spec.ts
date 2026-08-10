/**
 * Migration upgrade evidence for duplicate pending invitations + partial unique index.
 * Runs only when RUN_PLATFORM_DB_SECURITY=true against booking_test.
 */
import { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import {
  cleanupPlatformSecurityTables,
  createPlatformDbSecurityClient,
  createPlatformUserFixture,
  platformDbSecurityEnabled,
} from './platform-db-security.harness';

const run = platformDbSecurityEnabled();

describe('platform invitation pending uniqueness (postgres)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    if (!run) return;
    process.env.ALLOW_TEST_DATABASE_RESET = 'true';
    process.env.RUN_PLATFORM_DB_SECURITY = 'true';
    prisma = createPlatformDbSecurityClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    if (!run || !prisma) return;
    await cleanupPlatformSecurityTables(prisma);
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    if (!run) return;
    await cleanupPlatformSecurityTables(prisma);
  });

  (run ? it : it.skip)('partial unique index allows one pending invitation per user', async () => {
    const inviter = await createPlatformUserFixture(prisma, {
      email: `inviter-uniq-${randomUUID()}@example.com`,
      roleKeys: ['platform_owner'],
    });
    const invitee = await createPlatformUserFixture(prisma, {
      email: `invitee-uniq-${randomUUID()}@example.com`,
      status: 'pending_activation',
    });

    await prisma.platformUserInvitation.create({
      data: {
        platformUserId: invitee.id,
        email: invitee.email,
        tokenHash: createHash('sha256').update(`a-${randomUUID()}`).digest('hex'),
        invitedById: inviter.id,
        roleKeysJson: '[]',
        expiresAt: new Date(Date.now() + 60_000),
        status: 'pending',
      },
    });

    await expect(
      prisma.platformUserInvitation.create({
        data: {
          platformUserId: invitee.id,
          email: invitee.email,
          tokenHash: createHash('sha256').update(`b-${randomUUID()}`).digest('hex'),
          invitedById: inviter.id,
          roleKeysJson: '[]',
          expiresAt: new Date(Date.now() + 60_000),
          status: 'pending',
        },
      }),
    ).rejects.toThrow();

    const pending = await prisma.platformUserInvitation.count({
      where: { platformUserId: invitee.id, status: 'pending' },
    });
    expect(pending).toBe(1);
  });

  (run ? it : it.skip)('index exists after migrate deploy', async () => {
    const rows = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'platform_user_invitations'
        AND indexname = 'platform_user_invitations_one_pending_per_user'
    `;
    expect(rows).toHaveLength(1);
  });
});
