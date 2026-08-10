import { createHash, randomBytes, randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { PasswordHasher } from '../../identity/infrastructure/password-hasher';
import { PasswordResetToken } from '../../auth/domain/entities/password-reset-token.entity';
import { EmailSenderPort, EMAIL_SENDER } from '../../auth/infrastructure/services/email-sender.port';
import { Inject } from '@nestjs/common';
import {
  PASSWORD_RESET_TOKEN_REPOSITORY,
} from '../../../infrastructure/provider.tokens';
import { PasswordResetTokenRepository } from '../../auth/domain/repositories/password-reset-token.repository.interface';

export type PreparedInvitation = {
  invitationId: string;
  userId: string;
  /** Raw token held only in-memory until dispatch; never persisted by Step 17. */
  rawResetToken: string;
  email: string;
};

/**
 * Platform onboarding invitation adapter over identity SoR.
 * Prepare creates user + PENDING invitation + hashed reset token without email.
 * Dispatch sends email once; compensation cancels PENDING undispatched invites.
 */
@Injectable()
export class TenantAdminInvitationAdapter {
  /** In-process hold for prepared tokens keyed by invitationId (lost on restart → regenerate on dispatch). */
  private readonly pendingRawTokens = new Map<string, string>();
  /** In-process duplicate-dispatch guard (durable guard uses invitationDispatchedAt). */
  private readonly dispatchedInvitationIds = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PASSWORD_RESET_TOKEN_REPOSITORY)
    private readonly tokenRepo: PasswordResetTokenRepository,
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSenderPort,
  ) {}

  async prepare(input: {
    tenantId: string;
    email: string;
    displayName?: string;
    invitedBy: string;
  }): Promise<PreparedInvitation> {
    const email = input.email.toLowerCase().trim();
    const existingUser = await this.prisma.withPlatformBypass((c) =>
      c.user.findFirst({ where: { tenantId: input.tenantId, email, deletedAt: null } }),
    );
    if (existingUser) {
      const existingInvite = await this.prisma.withPlatformBypass((c) =>
        c.staffInvitation.findFirst({
          where: {
            tenantId: input.tenantId,
            email,
            status: 'PENDING',
            expiresAt: { gt: new Date() },
          },
        }),
      );
      if (existingInvite) {
        return {
          invitationId: existingInvite.id,
          userId: existingUser.id,
          rawResetToken: this.pendingRawTokens.get(existingInvite.id) ?? '',
          email,
        };
      }
      throw new Error('admin_identity_conflict');
    }
    const pendingInvite = await this.prisma.withPlatformBypass((c) =>
      c.staffInvitation.findFirst({
        where: { tenantId: input.tenantId, email, status: 'PENDING', expiresAt: { gt: new Date() } },
      }),
    );
    if (pendingInvite) {
      return {
        invitationId: pendingInvite.id,
        userId: pendingInvite.userId ?? '',
        rawResetToken: this.pendingRawTokens.get(pendingInvite.id) ?? '',
        email,
      };
    }

    const userId = randomUUID();
    const tempPassword = randomBytes(24).toString('base64url');
    const passwordHash = await PasswordHasher.hash(tempPassword);
    const [firstName, ...rest] = (input.displayName ?? '').trim().split(/\s+/);
    const lastName = rest.join(' ') || '';

    await this.prisma.withPlatformBypass(async (c) => {
      await c.user.create({
        data: {
          id: userId,
          tenantId: input.tenantId,
          email,
          passwordHash,
          firstName: firstName || 'Admin',
          lastName,
          isActive: false,
          emailVerified: false,
          roles: {
            create: [{ role: 'OWNER', grantedBy: input.invitedBy }],
          },
        },
      });
    });

    const expiresAt = new Date(Date.now() + 7 * 86_400_000);
    const invitation = await this.prisma.withPlatformBypass((c) =>
      c.staffInvitation.create({
        data: {
          tenantId: input.tenantId,
          email,
          roles: ['owner'],
          firstName: firstName || 'Admin',
          lastName: lastName || null,
          invitedBy: input.invitedBy,
          status: 'PENDING',
          expiresAt,
          userId,
        },
      }),
    );

    const [token, rawToken] = PasswordResetToken.generate({
      userId,
      tenantId: input.tenantId,
      ipAddress: '0.0.0.0',
      ttlMinutes: 60 * 24,
    });
    await this.tokenRepo.save(token);
    this.pendingRawTokens.set(invitation.id, rawToken);

    return {
      invitationId: invitation.id,
      userId,
      rawResetToken: rawToken,
      email,
    };
  }

  async dispatch(invitationId: string): Promise<{ dispatched: boolean }> {
    if (this.dispatchedInvitationIds.has(invitationId)) {
      return { dispatched: false };
    }
    const invite = await this.prisma.withPlatformBypass((c) =>
      c.staffInvitation.findUnique({ where: { id: invitationId } }),
    );
    if (!invite || invite.status !== 'PENDING') {
      return { dispatched: false };
    }

    // Durable duplicate-dispatch guard: provisioning request already marked dispatched.
    const already = await this.prisma.withPlatformBypass((c) =>
      c.platformTenantProvisioningRequest.findFirst({
        where: { invitationId, invitationDispatchedAt: { not: null } },
        select: { id: true },
      }),
    );
    if (already) {
      this.dispatchedInvitationIds.add(invitationId);
      return { dispatched: false };
    }

    let raw = this.pendingRawTokens.get(invitationId);
    if (!raw && invite.userId) {
      await this.tokenRepo.invalidateAllForUser(invite.userId);
      const [token, rawToken] = PasswordResetToken.generate({
        userId: invite.userId,
        tenantId: invite.tenantId,
        ipAddress: '0.0.0.0',
        ttlMinutes: 60 * 24,
      });
      await this.tokenRepo.save(token);
      raw = rawToken;
      this.pendingRawTokens.set(invitationId, raw);
    }
    if (!raw) return { dispatched: false };

    await this.emailSender.sendPasswordReset(invite.email, raw);
    this.pendingRawTokens.delete(invitationId);
    this.dispatchedInvitationIds.add(invitationId);
    return { dispatched: true };
  }

  async compensate(invitationId: string): Promise<void> {
    this.pendingRawTokens.delete(invitationId);
    await this.prisma.withPlatformBypass((c) =>
      c.staffInvitation.updateMany({
        where: { id: invitationId, status: 'PENDING' },
        data: { status: 'CANCELLED', updatedAt: new Date() },
      }),
    );
  }

  /** Deterministic digest for audit (never the raw token). */
  static tokenPresenceDigest(hasToken: boolean): string {
    return createHash('sha256').update(hasToken ? 'present' : 'absent').digest('hex').slice(0, 16);
  }
}
