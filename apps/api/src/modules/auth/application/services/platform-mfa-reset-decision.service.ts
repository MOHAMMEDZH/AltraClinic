import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { PlatformSodService } from '../../platform-rbac/platform-sod.service';

/**
 * Atomic administrator-assisted MFA reset approval/rejection.
 * Terminal status transition uses a conditional update so concurrent decisions
 * produce exactly one winner; MFA/session mutations run in the same transaction.
 */
@Injectable()
export class PlatformMfaResetDecisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sod: PlatformSodService,
  ) {}

  async approve(requestId: string, approverId: string, decisionReason?: string) {
    return this.prisma.$transaction(
      async (tx) => {
      await tx.$executeRaw`SELECT id FROM platform_mfa_reset_requests WHERE id = ${requestId}::uuid FOR UPDATE`;
      const req = await tx.platformMfaResetRequest.findUnique({ where: { id: requestId } });
      if (!req || req.status !== 'pending' || req.expiresAt <= new Date()) {
        throw new ForbiddenException('Reset request unavailable.');
      }
      this.sod.assertMfaResetApprover(req.requesterId, approverId, req.targetUserId);

      const decided = await tx.platformMfaResetRequest.updateMany({
        where: { id: requestId, status: 'pending' },
        data: {
          status: 'approved',
          approverId,
          decisionReason: decisionReason ?? null,
          decidedAt: new Date(),
          completedAt: new Date(),
        },
      });
      if (decided.count !== 1) {
        throw new ForbiddenException('Reset request unavailable.');
      }

      await tx.platformUser.update({
        where: { id: req.targetUserId },
        data: {
          mfaEnabled: false,
          mfaSecretEncrypted: null,
          mfaKeyVersion: null,
          mfaPendingSecretEncrypted: null,
          mfaPendingExpiresAt: null,
          mfaConfirmedAt: null,
          lastTotpStep: null,
        },
      });
      await tx.platformMfaRecoveryCode.deleteMany({ where: { platformUserId: req.targetUserId } });
      await tx.platformRefreshToken.updateMany({
        where: { platformUserId: req.targetUserId, revokedAt: null },
        data: { revokedAt: new Date(), revocationReason: 'mfa_reset' },
      });

      return tx.platformMfaResetRequest.findUniqueOrThrow({ where: { id: requestId } });
      },
      { timeout: 30_000 },
    );
  }

  async reject(requestId: string, approverId: string, decisionReason?: string) {
    return this.prisma.$transaction(
      async (tx) => {
      await tx.$executeRaw`SELECT id FROM platform_mfa_reset_requests WHERE id = ${requestId}::uuid FOR UPDATE`;
      const req = await tx.platformMfaResetRequest.findUnique({ where: { id: requestId } });
      if (!req || req.status !== 'pending') {
        throw new ForbiddenException('Reset request unavailable.');
      }
      this.sod.assertMfaResetApprover(req.requesterId, approverId, req.targetUserId);

      const decided = await tx.platformMfaResetRequest.updateMany({
        where: { id: requestId, status: 'pending' },
        data: {
          status: 'rejected',
          approverId,
          decisionReason: decisionReason ?? null,
          decidedAt: new Date(),
        },
      });
      if (decided.count !== 1) {
        throw new ForbiddenException('Reset request unavailable.');
      }
      return tx.platformMfaResetRequest.findUniqueOrThrow({ where: { id: requestId } });
      },
      { timeout: 30_000 },
    );
  }

  /**
   * Test/harness helper: run approval steps with an injectable failure point.
   * Production approve() does not expose this — tests call the internal path via this method only under NODE_ENV=test.
   */
  async approveWithFailureInjection(
    requestId: string,
    approverId: string,
    failAfter: 'secret_cleared' | 'recovery_cleared' | 'none' = 'none',
  ) {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Failure injection is test-only.');
    }
    return this.prisma.$transaction(
      async (tx) => {
      await tx.$executeRaw`SELECT id FROM platform_mfa_reset_requests WHERE id = ${requestId}::uuid FOR UPDATE`;
      const req = await tx.platformMfaResetRequest.findUnique({ where: { id: requestId } });
      if (!req || req.status !== 'pending' || req.expiresAt <= new Date()) {
        throw new ForbiddenException('Reset request unavailable.');
      }
      this.sod.assertMfaResetApprover(req.requesterId, approverId, req.targetUserId);

      const decided = await tx.platformMfaResetRequest.updateMany({
        where: { id: requestId, status: 'pending' },
        data: {
          status: 'approved',
          approverId,
          decidedAt: new Date(),
          completedAt: new Date(),
        },
      });
      if (decided.count !== 1) throw new ForbiddenException('Reset request unavailable.');

      await tx.platformUser.update({
        where: { id: req.targetUserId },
        data: {
          mfaEnabled: false,
          mfaSecretEncrypted: null,
          mfaKeyVersion: null,
          mfaPendingSecretEncrypted: null,
          mfaPendingExpiresAt: null,
          mfaConfirmedAt: null,
          lastTotpStep: null,
        },
      });
      if (failAfter === 'secret_cleared') {
        throw new Error('Injected MFA reset failure after secret clear.');
      }

      await tx.platformMfaRecoveryCode.deleteMany({ where: { platformUserId: req.targetUserId } });
      if (failAfter === 'recovery_cleared') {
        throw new Error('Injected MFA reset failure after recovery clear.');
      }

      await tx.platformRefreshToken.updateMany({
        where: { platformUserId: req.targetUserId, revokedAt: null },
        data: { revokedAt: new Date(), revocationReason: 'mfa_reset' },
      });

      return tx.platformMfaResetRequest.findUniqueOrThrow({ where: { id: requestId } });
      },
      { timeout: 30_000 },
    );
  }
}
