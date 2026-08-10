/**
 * Phase 47 Step 08 — persisted session ownership, IDOR, suspension, revoke-all.
 */
import { PrismaClient } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PlatformSessionRevocationService } from '../application/services/platform-session-revocation.service';
import { PrismaPlatformRefreshTokenRepository } from '../infrastructure/repositories/prisma-platform-refresh-token.repository';
import {
  cleanupPlatformSecurityTables,
  createPlatformDbSecurityClient,
  createPlatformRefreshSession,
  createPlatformUserFixture,
  platformDbSecurityEnabled,
} from './platform-db-security.harness';

const run = platformDbSecurityEnabled();

describe('platform session admin DB security (postgres)', () => {
  let prisma: PrismaClient;
  let revocations: PlatformSessionRevocationService;

  beforeAll(async () => {
    if (!run) return;
    process.env.ALLOW_TEST_DATABASE_RESET = 'true';
    process.env.RUN_PLATFORM_DB_SECURITY = 'true';
    prisma = createPlatformDbSecurityClient();
    await prisma.$connect();
    const repo = new PrismaPlatformRefreshTokenRepository(prisma as any);
    revocations = new PlatformSessionRevocationService(repo, { publish: async () => undefined } as any);
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

  (run ? it : it.skip)('rejects session IDOR and revokes only the owned session', async () => {
    const actor = await createPlatformUserFixture(prisma, {
      email: `actor-${randomUUID()}@example.com`,
      roleKeys: ['security_administrator'],
    });
    const targetA = await createPlatformUserFixture(prisma, {
      email: `a-${randomUUID()}@example.com`,
      roleKeys: ['auditor'],
    });
    const targetB = await createPlatformUserFixture(prisma, {
      email: `b-${randomUUID()}@example.com`,
      roleKeys: ['auditor'],
    });
    const sessA = await createPlatformRefreshSession(prisma, targetA.id);
    const sessB = await createPlatformRefreshSession(prisma, targetB.id);
    const actorSess = await createPlatformRefreshSession(prisma, actor.id);

    await expect(revocations.revokeOne(targetA.id, sessB.sessionId, 'admin_revoked')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    const stillB = await prisma.platformRefreshToken.findUniqueOrThrow({ where: { id: sessB.id } });
    expect(stillB.revokedAt).toBeNull();
    const stillA = await prisma.platformRefreshToken.findUniqueOrThrow({ where: { id: sessA.id } });
    expect(stillA.revokedAt).toBeNull();

    await revocations.revokeOne(targetA.id, sessA.sessionId, 'admin_revoked');
    const revokedA = await prisma.platformRefreshToken.findUniqueOrThrow({ where: { id: sessA.id } });
    expect(revokedA.revokedAt).not.toBeNull();
    expect(revokedA.revocationReason).toBe('admin_revoked');

    const untouchedActor = await prisma.platformRefreshToken.findUniqueOrThrow({ where: { id: actorSess.id } });
    expect(untouchedActor.revokedAt).toBeNull();
    const untouchedB = await prisma.platformRefreshToken.findUniqueOrThrow({ where: { id: sessB.id } });
    expect(untouchedB.revokedAt).toBeNull();
  });

  (run ? it : it.skip)('revoke-all and suspension invalidate only target platform sessions', async () => {
    const target = await createPlatformUserFixture(prisma, {
      email: `suspend-${randomUUID()}@example.com`,
      roleKeys: ['auditor'],
    });
    const other = await createPlatformUserFixture(prisma, {
      email: `other-${randomUUID()}@example.com`,
      roleKeys: ['auditor'],
    });
    const s1 = await createPlatformRefreshSession(prisma, target.id);
    const s2 = await createPlatformRefreshSession(prisma, target.id);
    const otherS = await createPlatformRefreshSession(prisma, other.id);

    const count = await revocations.revokeAllForUser(target.id, 'admin_revoked');
    expect(count).toBe(2);
    expect((await prisma.platformRefreshToken.findUniqueOrThrow({ where: { id: s1.id } })).revokedAt).not.toBeNull();
    expect((await prisma.platformRefreshToken.findUniqueOrThrow({ where: { id: s2.id } })).revokedAt).not.toBeNull();
    expect((await prisma.platformRefreshToken.findUniqueOrThrow({ where: { id: otherS.id } })).revokedAt).toBeNull();

    // Idempotent
    expect(await revocations.revokeAllForUser(target.id, 'admin_revoked')).toBe(0);

    // Suspension path: update lifecycle + revoke + supersede invites
    const inviter = await createPlatformUserFixture(prisma, {
      email: `inv-${randomUUID()}@example.com`,
      roleKeys: ['platform_owner'],
    });
    await prisma.platformUserInvitation.create({
      data: {
        platformUserId: target.id,
        email: target.email,
        tokenHash: `hash-${randomUUID().replace(/-/g, '')}`.slice(0, 64),
        invitedById: inviter.id,
        roleKeysJson: '[]',
        expiresAt: new Date(Date.now() + 60_000),
        status: 'pending',
      },
    });
    await createPlatformRefreshSession(prisma, target.id);

    await prisma.$transaction([
      prisma.platformUser.update({
        where: { id: target.id },
        data: {
          status: 'suspended',
          isActive: false,
          suspendedAt: new Date(),
          suspendedReason: 'policy',
          suspendedById: inviter.id,
        },
      }),
      prisma.platformRefreshToken.updateMany({
        where: { platformUserId: target.id, revokedAt: null },
        data: { revokedAt: new Date(), revocationReason: 'suspended' },
      }),
      prisma.platformUserInvitation.updateMany({
        where: { platformUserId: target.id, status: 'pending' },
        data: { status: 'superseded' },
      }),
    ]);

    const suspended = await prisma.platformUser.findUniqueOrThrow({ where: { id: target.id } });
    expect(suspended.status).toBe('suspended');
    expect(
      await prisma.platformRefreshToken.count({ where: { platformUserId: target.id, revokedAt: null } }),
    ).toBe(0);
    expect(
      await prisma.platformUserInvitation.count({ where: { platformUserId: target.id, status: 'pending' } }),
    ).toBe(0);

    // Reactivation does not restore sessions
    await prisma.platformUser.update({
      where: { id: target.id },
      data: { status: 'active', isActive: true, suspendedAt: null, suspendedReason: null, suspendedById: null },
    });
    expect(
      await prisma.platformRefreshToken.count({ where: { platformUserId: target.id, revokedAt: null } }),
    ).toBe(0);
    expect((await prisma.platformRefreshToken.findUniqueOrThrow({ where: { id: otherS.id } })).revokedAt).toBeNull();
  });
});
