/**
 * Phase 47 Step 08 — MFA reset atomicity, concurrency, and rollback against PostgreSQL.
 */
import { PrismaClient } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { PlatformMfaResetDecisionService } from '../application/services/platform-mfa-reset-decision.service';
import { PlatformSodService } from '../platform-rbac/platform-sod.service';
import {
  cleanupPlatformSecurityTables,
  createPlatformDbSecurityClient,
  createPlatformRefreshSession,
  createPlatformUserFixture,
  platformDbSecurityEnabled,
} from './platform-db-security.harness';

const run = platformDbSecurityEnabled();

describe('platform MFA reset DB atomicity (postgres)', () => {
  let prisma: PrismaClient;
  let decisions: PlatformMfaResetDecisionService;

  beforeAll(async () => {
    if (!run) return;
    process.env.ALLOW_TEST_DATABASE_RESET = 'true';
    process.env.RUN_PLATFORM_DB_SECURITY = 'true';
    process.env.NODE_ENV = 'test';
    prisma = createPlatformDbSecurityClient();
    await prisma.$connect();
    decisions = new PlatformMfaResetDecisionService(prisma as any, new PlatformSodService({} as any));
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

  async function seedResetFixture() {
    const requester = await createPlatformUserFixture(prisma, {
      email: `req-${randomUUID()}@example.com`,
      roleKeys: ['security_administrator'],
    });
    const approver = await createPlatformUserFixture(prisma, {
      email: `appr-${randomUUID()}@example.com`,
      roleKeys: ['security_administrator'],
    });
    const target = await createPlatformUserFixture(prisma, {
      email: `tgt-${randomUUID()}@example.com`,
      roleKeys: ['auditor'],
      mfaEnabled: true,
      mfaSecretEncrypted: 'enc-active-secret',
      mfaPendingSecretEncrypted: 'enc-pending-secret',
    });
    await prisma.platformMfaRecoveryCode.createMany({
      data: [
        { platformUserId: target.id, codeHash: createHash('sha256').update('code1').digest('hex') },
        { platformUserId: target.id, codeHash: createHash('sha256').update('code2').digest('hex') },
      ],
    });
    const s1 = await createPlatformRefreshSession(prisma, target.id, { stepUpVerifiedAt: new Date() });
    const s2 = await createPlatformRefreshSession(prisma, target.id, { stepUpVerifiedAt: new Date() });
    const request = await prisma.platformMfaResetRequest.create({
      data: {
        targetUserId: target.id,
        requesterId: requester.id,
        reason: 'lost device',
        expiresAt: new Date(Date.now() + 3600_000),
        status: 'pending',
      },
    });
    return { requester, approver, target, request, s1, s2 };
  }

  (run ? it : it.skip)('approval clears MFA material and sessions atomically', async () => {
    const { approver, target, request, s1, s2 } = await seedResetFixture();
    const updated = await decisions.approve(request.id, approver.id, 'verified');
    expect(updated.status).toBe('approved');
    expect(updated.approverId).toBe(approver.id);

    const user = await prisma.platformUser.findUniqueOrThrow({ where: { id: target.id } });
    expect(user.mfaEnabled).toBe(false);
    expect(user.mfaSecretEncrypted).toBeNull();
    expect(user.mfaPendingSecretEncrypted).toBeNull();
    expect(user.mfaConfirmedAt).toBeNull();
    expect(await prisma.platformMfaRecoveryCode.count({ where: { platformUserId: target.id } })).toBe(0);
    expect((await prisma.platformRefreshToken.findUniqueOrThrow({ where: { id: s1.id } })).revokedAt).not.toBeNull();
    expect((await prisma.platformRefreshToken.findUniqueOrThrow({ where: { id: s2.id } })).revokedAt).not.toBeNull();
  });

  (run ? it : it.skip)('concurrent approve/reject yields one terminal state', async () => {
    const { approver, requester, target, request } = await seedResetFixture();
    const secondApprover = await createPlatformUserFixture(prisma, {
      email: `appr2-${randomUUID()}@example.com`,
      roleKeys: ['security_administrator'],
    });

    const results = await Promise.allSettled([
      decisions.approve(request.id, approver.id),
      decisions.reject(request.id, secondApprover.id),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    // Loser may surface ForbiddenException (lost conditional update) or a closed-transaction
    // error if it blocked on FOR UPDATE until the winner finished and then failed closed.
    const loser = (failed[0] as PromiseRejectedResult).reason;
    expect(loser).toBeTruthy();
    expect(String(loser?.message ?? loser)).not.toMatch(/token=|mfaSecret|recovery/i);

    const final = await prisma.platformMfaResetRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(['approved', 'rejected']).toContain(final.status);

    const user = await prisma.platformUser.findUniqueOrThrow({ where: { id: target.id } });
    if (final.status === 'approved') {
      expect(user.mfaSecretEncrypted).toBeNull();
      expect(await prisma.platformMfaRecoveryCode.count({ where: { platformUserId: target.id } })).toBe(0);
    } else {
      expect(user.mfaSecretEncrypted).toBe('enc-active-secret');
      expect(await prisma.platformMfaRecoveryCode.count({ where: { platformUserId: target.id } })).toBe(2);
    }

    // SoD still enforced on a fresh request
    const req2 = await prisma.platformMfaResetRequest.create({
      data: {
        targetUserId: target.id,
        requesterId: requester.id,
        reason: 'again',
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });
    await expect(decisions.approve(req2.id, requester.id)).rejects.toBeInstanceOf(ForbiddenException);
  });

  (run ? it : it.skip)('injected mid-transaction failure rolls back all MFA changes', async () => {
    const { approver, target, request, s1 } = await seedResetFixture();
    await expect(
      decisions.approveWithFailureInjection(request.id, approver.id, 'secret_cleared'),
    ).rejects.toThrow(/Injected MFA reset failure/);

    const req = await prisma.platformMfaResetRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(req.status).toBe('pending');
    const user = await prisma.platformUser.findUniqueOrThrow({ where: { id: target.id } });
    expect(user.mfaSecretEncrypted).toBe('enc-active-secret');
    expect(user.mfaPendingSecretEncrypted).toBe('enc-pending-secret');
    expect(await prisma.platformMfaRecoveryCode.count({ where: { platformUserId: target.id } })).toBe(2);
    expect((await prisma.platformRefreshToken.findUniqueOrThrow({ where: { id: s1.id } })).revokedAt).toBeNull();

    await expect(decisions.approve(request.id, approver.id)).resolves.toMatchObject({ status: 'approved' });
  });
});
