import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';

@Injectable()
export class PlatformUserRoleRepository {
  constructor(private readonly prisma: PrismaService) {}
  listActive(platformUserId: string) {
    return this.prisma.platformUserRole.findMany({ where: { platformUserId, revokedAt: null }, orderBy: { roleKey: 'asc' } });
  }
  listByUser(platformUserId: string) { return this.prisma.platformUserRole.findMany({ where: { platformUserId } }); }
  async assign(input: { platformUserId: string; roleKey: string; assignedById?: string; reason?: string }) {
    return this.prisma.platformUserRole.upsert({
      where: { platformUserId_roleKey: { platformUserId: input.platformUserId, roleKey: input.roleKey } },
      create: input,
      update: { revokedAt: null, revokedById: null, revokeReason: null, assignedById: input.assignedById, reason: input.reason, assignedAt: new Date() },
    });
  }
  revoke(platformUserId: string, roleKey: string, revokedById: string, revokeReason?: string) {
    return this.prisma.platformUserRole.update({ where: { platformUserId_roleKey: { platformUserId, roleKey } }, data: { revokedAt: new Date(), revokedById, revokeReason } });
  }
}

@Injectable()
export class PlatformInvitationRepository {
  constructor(private readonly prisma: PrismaService) {}
  create(data: { platformUserId: string; email: string; tokenHash: string; expiresAt: Date; invitedById: string; roleKeysJson: string }) {
    return this.prisma.platformUserInvitation.create({ data });
  }
  findByTokenHash(tokenHash: string) { return this.prisma.platformUserInvitation.findUnique({ where: { tokenHash } }); }
  supersedePending(platformUserId: string) {
    return this.prisma.platformUserInvitation.updateMany({ where: { platformUserId, status: 'pending' }, data: { status: 'superseded' } });
  }
  /** Atomically supersede pending invitations then create the replacement (partial unique index safe). */
  async supersedeAndCreate(data: {
    platformUserId: string; email: string; tokenHash: string; expiresAt: Date; invitedById: string; roleKeysJson: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.platformUserInvitation.updateMany({
        where: { platformUserId: data.platformUserId, status: 'pending' },
        data: { status: 'superseded' },
      });
      return tx.platformUserInvitation.create({ data });
    });
  }
  markAccepted(id: string) { return this.prisma.platformUserInvitation.update({ where: { id }, data: { status: 'accepted', acceptedAt: new Date() } }); }
}

@Injectable()
export class PlatformMfaResetRepository {
  constructor(private readonly prisma: PrismaService) {}
  create(data: { targetUserId: string; requesterId: string; reason: string; externalRef?: string; expiresAt: Date }) {
    return this.prisma.platformMfaResetRequest.create({ data });
  }
  findById(id: string) { return this.prisma.platformMfaResetRequest.findUnique({ where: { id } }); }
  listPending(targetUserId?: string) {
    return this.prisma.platformMfaResetRequest.findMany({ where: { status: 'pending', ...(targetUserId ? { targetUserId } : {}) } });
  }
  decide(id: string, approverId: string, approved: boolean, decisionReason?: string) {
    return this.prisma.platformMfaResetRequest.updateMany({
      where: { id, status: 'pending' },
      data: {
        status: approved ? 'approved' : 'rejected',
        approverId,
        decisionReason,
        decidedAt: new Date(),
        ...(approved ? { completedAt: new Date() } : {}),
      },
    });
  }
}
