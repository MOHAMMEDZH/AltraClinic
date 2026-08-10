/**
 * Phase 47 Step 08 — database-backed invitation concurrency and resend supersession.
 * Run: see docs/SUPER_ADMIN_RBAC_AND_PLATFORM_USERS.md (DB security gate).
 */
import { PrismaClient } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';
import { PlatformInvitationAcceptanceService } from '../application/services/platform-invitation-acceptance.service';
import {
  cleanupPlatformSecurityTables,
  createPlatformDbSecurityClient,
  createPlatformUserFixture,
  platformDbSecurityEnabled,
  sha256,
} from './platform-db-security.harness';

const run = platformDbSecurityEnabled();

describe('platform invitation DB concurrency (postgres)', () => {
  let prisma: PrismaClient;
  let acceptance: PlatformInvitationAcceptanceService;

  beforeAll(async () => {
    if (!run) return;
    process.env.ALLOW_TEST_DATABASE_RESET = 'true';
    process.env.RUN_PLATFORM_DB_SECURITY = 'true';
    prisma = createPlatformDbSecurityClient();
    await prisma.$connect();
    acceptance = new PlatformInvitationAcceptanceService(prisma as any, {
      issuePlatformPreauthToken: () => ({ token: 'preauth.test', expiresIn: 900 }),
    } as any);
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

  (run ? it : it.skip)('concurrent acceptance yields exactly one success', async () => {
    const inviter = await createPlatformUserFixture(prisma, {
      email: `inviter-${randomUUID()}@example.com`,
      roleKeys: ['platform_owner'],
    });
    const invitee = await createPlatformUserFixture(prisma, {
      email: `invitee-${randomUUID()}@example.com`,
      status: 'pending_activation',
      roleKeys: ['auditor'],
    });
    const raw = randomBytes(32).toString('base64url');
    await prisma.platformUserInvitation.create({
      data: {
        platformUserId: invitee.id,
        email: invitee.email,
        tokenHash: sha256(raw),
        invitedById: inviter.id,
        roleKeysJson: JSON.stringify(['auditor']),
        expiresAt: new Date(Date.now() + 3600_000),
        status: 'pending',
      },
    });

    const password = 'AcceptPass12!!';
    const attempts = await Promise.allSettled([
      acceptance.accept(raw, password),
      acceptance.accept(raw, password),
      acceptance.accept(raw, password),
    ]);

    const successes = attempts.filter((r) => r.status === 'fulfilled');
    const failures = attempts.filter((r) => r.status === 'rejected');
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(2);
    for (const f of failures) {
      expect((f as PromiseRejectedResult).reason).toBeInstanceOf(ForbiddenException);
    }

    const invitations = await prisma.platformUserInvitation.findMany({ where: { platformUserId: invitee.id } });
    expect(invitations).toHaveLength(1);
    expect(invitations[0].status).toBe('accepted');

    const user = await prisma.platformUser.findUniqueOrThrow({ where: { id: invitee.id } });
    expect(user.status).toBe('active');
    expect(user.mfaEnabled).toBe(false);
    expect(user.passwordHash).not.toBe(password);
    expect(user.passwordHash.startsWith('$2')).toBe(true);

    const sessions = await prisma.platformRefreshToken.count({ where: { platformUserId: invitee.id } });
    expect(sessions).toBe(0);

    await expect(acceptance.accept(raw, password)).rejects.toBeInstanceOf(ForbiddenException);
  });

  (run ? it : it.skip)('resend supersedes previous token in persistent storage', async () => {
    const inviter = await createPlatformUserFixture(prisma, {
      email: `inviter2-${randomUUID()}@example.com`,
      roleKeys: ['platform_owner'],
    });
    const invitee = await createPlatformUserFixture(prisma, {
      email: `invitee2-${randomUUID()}@example.com`,
      status: 'pending_activation',
    });
    const rawOld = randomBytes(32).toString('base64url');
    const rawNew = randomBytes(32).toString('base64url');
    await prisma.platformUserInvitation.create({
      data: {
        platformUserId: invitee.id,
        email: invitee.email,
        tokenHash: sha256(rawOld),
        invitedById: inviter.id,
        roleKeysJson: '[]',
        expiresAt: new Date(Date.now() + 3600_000),
        status: 'pending',
      },
    });

    await prisma.$transaction(async (tx) => {
      await tx.platformUserInvitation.updateMany({
        where: { platformUserId: invitee.id, status: 'pending' },
        data: { status: 'superseded' },
      });
      await tx.platformUserInvitation.create({
        data: {
          platformUserId: invitee.id,
          email: invitee.email,
          tokenHash: sha256(rawNew),
          invitedById: inviter.id,
          roleKeysJson: '[]',
          expiresAt: new Date(Date.now() + 3600_000),
          status: 'pending',
        },
      });
    });

    const pending = await prisma.platformUserInvitation.findMany({
      where: { platformUserId: invitee.id, status: 'pending' },
    });
    expect(pending).toHaveLength(1);
    expect(pending[0].tokenHash).toBe(sha256(rawNew));

    await expect(acceptance.accept(rawOld, 'AcceptPass12!!')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(acceptance.accept(rawNew, 'AcceptPass12!!')).resolves.toMatchObject({
      kind: 'mfa_enrollment_required',
    });
  });
});
