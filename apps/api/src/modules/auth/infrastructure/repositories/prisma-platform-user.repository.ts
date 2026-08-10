import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { PlatformUser } from '../../domain/entities/platform-user.entity';
import { PlatformUserRepository } from '../../domain/repositories/platform-user.repository.interface';

type PlatformUserRow = {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string | null;
  isActive: boolean;
  status: string;
  suspendedAt: Date | null;
  suspendedReason: string | null;
  suspendedById: string | null;
  authzRevision: number;
  lockedUntil: Date | null;
  failedLoginCount: number;
  passwordChangedAt: Date;
  lastLoginAt: Date | null;
  lastLoginIp: string | null;
  createdAt: Date;
  updatedAt: Date;
  mfaEnabled: boolean;
  mfaSecretEncrypted: string | null;
  mfaKeyVersion: string | null;
  mfaPendingSecretEncrypted: string | null;
  mfaPendingExpiresAt: Date | null;
  mfaConfirmedAt: Date | null;
  lastTotpStep: string | null;
  failedMfaCount: number;
};

@Injectable()
export class PrismaPlatformUserRepository implements PlatformUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<PlatformUser | null> {
    const row = await this.prisma.platformUser.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    return row ? this.map(row) : null;
  }

  async findById(id: string): Promise<PlatformUser | null> {
    const row = await this.prisma.platformUser.findUnique({ where: { id } });
    return row ? this.map(row) : null;
  }

  async save(user: PlatformUser): Promise<void> {
    await this.prisma.platformUser.create({
      data: {
        id: user.id,
        email: user.email,
        passwordHash: user.passwordHash,
        displayName: user.displayName,
        isActive: user.isActive,
        status: user.status,
        suspendedAt: user.suspendedAt,
        suspendedReason: user.suspendedReason,
        suspendedById: user.suspendedById,
        authzRevision: user.authzRevision,
        lockedUntil: user.lockedUntil,
        failedLoginCount: user.failedLoginCount,
        passwordChangedAt: user.passwordChangedAt,
        lastLoginAt: user.lastLoginAt,
        lastLoginIp: user.lastLoginIp,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        mfaEnabled: user.mfaEnabled,
        mfaSecretEncrypted: user.mfaSecretEncrypted,
        mfaKeyVersion: user.mfaKeyVersion,
        mfaPendingSecretEncrypted: user.mfaPendingSecretEncrypted,
        mfaPendingExpiresAt: user.mfaPendingExpiresAt,
        mfaConfirmedAt: user.mfaConfirmedAt,
        lastTotpStep: user.lastTotpStep,
        failedMfaCount: user.failedMfaCount,
      },
    });
  }

  async updateLoginState(user: PlatformUser): Promise<void> {
    await this.prisma.platformUser.update({
      where: { id: user.id },
      data: {
        failedLoginCount: user.failedLoginCount,
        lockedUntil: user.lockedUntil,
        lastLoginAt: user.lastLoginAt,
        lastLoginIp: user.lastLoginIp,
        isActive: user.isActive,
        status: user.status,
        updatedAt: new Date(),
      },
    });
  }

  async list(input: {
    page: number; pageSize: number; search?: string; status?: string; roleKey?: string;
  }): Promise<{ items: PlatformUser[]; total: number }> {
    const where = {
      ...(input.status ? { status: input.status } : {}),
      ...(input.search ? { OR: [
        { email: { contains: input.search, mode: 'insensitive' as const } },
        { displayName: { contains: input.search, mode: 'insensitive' as const } },
      ] } : {}),
      ...(input.roleKey ? { roleAssignments: { some: { roleKey: input.roleKey, revokedAt: null } } } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.platformUser.findMany({ where, skip: (input.page - 1) * input.pageSize, take: input.pageSize, orderBy: { createdAt: 'desc' } }),
      this.prisma.platformUser.count({ where }),
    ]);
    return { items: rows.map((row) => this.map(row)), total };
  }

  async updateLifecycle(id: string, data: {
    status: string; isActive?: boolean; suspendedAt?: Date | null;
    suspendedReason?: string | null; suspendedById?: string | null;
  }): Promise<void> {
    await this.prisma.platformUser.update({ where: { id }, data: { ...data, updatedAt: new Date() } });
  }

  async updateAuthzRevision(id: string): Promise<number> {
    const row = await this.prisma.platformUser.update({
      where: { id }, data: { authzRevision: { increment: 1 } }, select: { authzRevision: true },
    });
    return row.authzRevision;
  }

  async countByRoleKey(roleKey: string, active = true): Promise<number> {
    return this.prisma.platformUser.count({ where: {
      ...(active ? { isActive: true, status: 'active' } : {}),
      roleAssignments: { some: { roleKey, revokedAt: null } },
    } });
  }

  async countActiveUsers(): Promise<number> {
    return this.prisma.platformUser.count({ where: { isActive: true, status: 'active' } });
  }

  async updateMfaState(user: PlatformUser): Promise<void> {
    await this.prisma.platformUser.update({
      where: { id: user.id },
      data: {
        mfaEnabled: user.mfaEnabled,
        mfaSecretEncrypted: user.mfaSecretEncrypted,
        mfaKeyVersion: user.mfaKeyVersion,
        mfaPendingSecretEncrypted: user.mfaPendingSecretEncrypted,
        mfaPendingExpiresAt: user.mfaPendingExpiresAt,
        mfaConfirmedAt: user.mfaConfirmedAt,
        lastTotpStep: user.lastTotpStep,
        failedMfaCount: user.failedMfaCount,
        updatedAt: new Date(),
      },
    });
  }

  private map(row: PlatformUserRow): PlatformUser {
    return PlatformUser.restore(row);
  }
}
