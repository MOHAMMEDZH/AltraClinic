import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EmploymentStatus as PrismaEmploymentStatus } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { USER_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { UserRepository } from '../../domain/user.repository.interface';
import { EmploymentStatus, User } from '../../domain/user.entity';
import { IDENTITY_AUDIT_LOG, IdentityAuditLog } from '../ports/identity-audit-log.port';
import { IdentityNotificationService } from '../services/identity-notification.service';
import { toUserDetailDto } from '../mappers/user.mapper';
import { DeactivateUserHandler, ReactivateUserHandler, UpdateUserHandler } from './user-management.handlers';

const PRISMA_EMPLOYMENT: Record<EmploymentStatus, PrismaEmploymentStatus> = {
  active: PrismaEmploymentStatus.ACTIVE,
  suspended: PrismaEmploymentStatus.SUSPENDED,
  on_leave: PrismaEmploymentStatus.ON_LEAVE,
  archived: PrismaEmploymentStatus.ARCHIVED,
  terminated: PrismaEmploymentStatus.TERMINATED,
};

const DOMAIN_EMPLOYMENT: Record<PrismaEmploymentStatus, EmploymentStatus> = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  ON_LEAVE: 'on_leave',
  ARCHIVED: 'archived',
  TERMINATED: 'terminated',
};

export function parseLanguages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

@Injectable()
export class SuspendUserHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly repo: UserRepository,
    @Inject(IDENTITY_AUDIT_LOG) private readonly audit: IdentityAuditLog,
    private readonly tenantContext: TenantContextService,
    private readonly prisma: PrismaService,
    private readonly notifications: IdentityNotificationService,
  ) {}

  async execute(userId: string, actorId: string, actorRoles: string[]) {
    const tenant = await this.tenantContext.resolve();
    const user = await this.repo.findById(userId, tenant.tenantId);
    if (!user) return null;
    const updated = user.suspend();
    await this.repo.save(updated);
    await this.prisma.user.update({
      where: { id: userId },
      data: { employmentStatus: PRISMA_EMPLOYMENT.suspended, suspendedAt: updated.suspendedAt },
    });
    await this.audit.record({
      tenantId: tenant.tenantId,
      branchId: tenant.branchId ?? null,
      action: 'identity.user.suspended',
      resourceId: userId,
      actorId,
      actorRoles,
      locale: tenant.locale ?? null,
    });
    await this.notifications.userSuspended(userId, tenant.branchId ?? null);
    return toUserDetailDto(updated, []);
  }
}

@Injectable()
export class ArchiveUserHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly repo: UserRepository,
    @Inject(IDENTITY_AUDIT_LOG) private readonly audit: IdentityAuditLog,
    private readonly tenantContext: TenantContextService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(userId: string, actorId: string, actorRoles: string[]) {
    const tenant = await this.tenantContext.resolve();
    const user = await this.repo.findById(userId, tenant.tenantId);
    if (!user) return null;
    const updated = user.archive();
    await this.repo.save(updated);
    await this.prisma.user.update({
      where: { id: userId },
      data: { employmentStatus: PRISMA_EMPLOYMENT.archived, archivedAt: updated.archivedAt },
    });
    await this.audit.record({
      tenantId: tenant.tenantId,
      branchId: tenant.branchId ?? null,
      action: 'identity.user.archived',
      resourceId: userId,
      actorId,
      actorRoles,
      locale: tenant.locale ?? null,
    });
    return toUserDetailDto(updated, []);
  }
}

@Injectable()
export class RestoreUserHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly repo: UserRepository,
    @Inject(IDENTITY_AUDIT_LOG) private readonly audit: IdentityAuditLog,
    private readonly tenantContext: TenantContextService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(userId: string, actorId: string, actorRoles: string[]) {
    const tenant = await this.tenantContext.resolve();
    const user = await this.repo.findById(userId, tenant.tenantId);
    if (!user) return null;
    const updated = user.restoreAccount();
    await this.repo.save(updated);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        employmentStatus: PRISMA_EMPLOYMENT.active,
        suspendedAt: null,
        archivedAt: null,
        isActive: true,
      },
    });
    await this.audit.record({
      tenantId: tenant.tenantId,
      branchId: tenant.branchId ?? null,
      action: 'identity.user.restored',
      resourceId: userId,
      actorId,
      actorRoles,
      locale: tenant.locale ?? null,
    });
    return toUserDetailDto(updated, []);
  }
}

@Injectable()
export class ExportUsersHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly repo: UserRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(query: { search?: string; status?: string; role?: string; branchId?: string }) {
    const tenant = await this.tenantContext.resolve();
    const result = await this.repo.list({
      tenantId: tenant.tenantId,
      search: query.search,
      status: (query.status as 'active' | 'inactive' | 'locked' | 'all') ?? 'all',
      role: query.role as User['roles'][number] | undefined,
      branchId: query.branchId,
      page: 1,
      limit: 10_000,
    });
    return result.items.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      roles: u.roles.join(';'),
      status: u.isLocked() ? 'locked' : u.isActive ? 'active' : 'inactive',
      employmentStatus: u.employmentStatus,
      branchId: u.branchId ?? '',
      departmentId: u.departmentId ?? '',
      jobTitle: u.jobTitle ?? '',
      phone: u.phone ?? '',
      mfaEnabled: u.mfaEnabled,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? '',
    }));
  }
}

@Injectable()
export class ListDepartmentsHandler {
  constructor(private readonly prisma: PrismaService, private readonly tenantContext: TenantContextService) {}

  async execute() {
    const tenant = await this.tenantContext.resolve();
    const rows = await this.prisma.department.findMany({
      where: { tenantId: tenant.tenantId, isActive: true },
      orderBy: { name: 'asc' },
    });
    return rows.map((d) => ({
      id: d.id,
      name: d.name,
      nameAr: d.nameAr,
      branchId: d.branchId,
    }));
  }
}

@Injectable()
export class CreateDepartmentHandler {
  constructor(private readonly prisma: PrismaService, private readonly tenantContext: TenantContextService) {}

  async execute(input: { name: string; nameAr?: string; branchId?: string | null }) {
    const tenant = await this.tenantContext.resolve();
    const existing = await this.prisma.department.findFirst({
      where: { tenantId: tenant.tenantId, name: input.name.trim() },
    });
    if (existing) throw new ConflictException('Department already exists');
    const row = await this.prisma.department.create({
      data: {
        tenantId: tenant.tenantId,
        name: input.name.trim(),
        nameAr: input.nameAr?.trim() || null,
        branchId: input.branchId ?? null,
      },
    });
    return { id: row.id, name: row.name, nameAr: row.nameAr, branchId: row.branchId };
  }
}

@Injectable()
export class ListCustomRolesHandler {
  constructor(private readonly prisma: PrismaService, private readonly tenantContext: TenantContextService) {}

  async execute() {
    const tenant = await this.tenantContext.resolve();
    const rows = await this.prisma.customRole.findMany({
      where: { tenantId: tenant.tenantId, isArchived: false },
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      permissions: r.permissions,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}

@Injectable()
export class CreateCustomRoleHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(IDENTITY_AUDIT_LOG) private readonly audit: IdentityAuditLog,
  ) {}

  async execute(input: {
    name: string;
    description?: string;
    permissions: Record<string, string[]>;
    actorId: string;
    actorRoles: string[];
  }) {
    const tenant = await this.tenantContext.resolve();
    const row = await this.prisma.customRole.create({
      data: {
        tenantId: tenant.tenantId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        permissions: input.permissions,
      },
    });
    await this.audit.record({
      tenantId: tenant.tenantId,
      branchId: tenant.branchId ?? null,
      action: 'identity.role.created',
      resourceId: row.id,
      actorId: input.actorId,
      actorRoles: input.actorRoles,
      locale: tenant.locale ?? null,
      details: { name: row.name },
    });
    return { id: row.id, name: row.name, description: row.description, permissions: row.permissions };
  }
}

@Injectable()
export class GetUserTrustedDevicesHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(userId: string) {
    const tenant = await this.tenantContext.resolve();
    const user = await this.userRepo.findById(userId, tenant.tenantId);
    if (!user) return null;
    const devices = await this.prisma.trustedDevice.findMany({
      where: { userId, tenantId: tenant.tenantId },
      orderBy: { lastUsedAt: 'desc' },
      take: 50,
    });
    return devices.map((d) => ({
      id: d.id,
      deviceName: d.deviceName,
      lastUsedAt: d.lastUsedAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
    }));
  }
}

@Injectable()
export class SyncUserBranchAccessHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(userId: string, branchIds: string[]) {
    const tenant = await this.tenantContext.resolve();
    const user = await this.userRepo.findById(userId, tenant.tenantId);
    if (!user) return null;
    await this.prisma.$transaction(async (tx) => {
      await tx.userBranchAccess.deleteMany({ where: { userId, tenantId: tenant.tenantId } });
      if (branchIds.length > 0) {
        await tx.userBranchAccess.createMany({
          data: branchIds.map((branchId) => ({ tenantId: tenant.tenantId, userId, branchId })),
          skipDuplicates: true,
        });
      }
    });
    return branchIds;
  }
}

@Injectable()
export class ExtendedBulkUserActionHandler {
  constructor(
    @Inject(IDENTITY_AUDIT_LOG) private readonly audit: IdentityAuditLog,
    private readonly tenantContext: TenantContextService,
    private readonly deactivateHandler: DeactivateUserHandler,
    private readonly reactivateHandler: ReactivateUserHandler,
    private readonly suspendHandler: SuspendUserHandler,
    private readonly updateHandler: UpdateUserHandler,
    private readonly branchSyncHandler: SyncUserBranchAccessHandler,
  ) {}

  async execute(input: {
    userIds: string[];
    action: 'deactivate' | 'reactivate' | 'suspend' | 'assign_roles' | 'assign_branches';
    roles?: string[];
    branchIds?: string[];
    actorId: string;
    actorRoles: string[];
  }) {
    const tenant = await this.tenantContext.resolve();
    const results: string[] = [];

    for (const userId of input.userIds) {
      let ok = false;
      if (input.action === 'deactivate') {
        ok = Boolean(await this.deactivateHandler.execute(userId, input.actorId, input.actorRoles));
      } else if (input.action === 'reactivate') {
        ok = Boolean(await this.reactivateHandler.execute(userId));
      } else if (input.action === 'suspend') {
        ok = Boolean(await this.suspendHandler.execute(userId, input.actorId, input.actorRoles));
      } else if (input.action === 'assign_roles' && input.roles?.length) {
        ok = Boolean(
          await this.updateHandler.execute(
            userId,
            { roles: input.roles as User['roles'] },
            input.actorId,
            input.actorRoles,
          ),
        );
      } else if (input.action === 'assign_branches' && input.branchIds) {
        ok = Boolean(await this.branchSyncHandler.execute(userId, input.branchIds));
      }
      if (ok) results.push(userId);
    }

    await this.audit.record({
      tenantId: tenant.tenantId,
      branchId: tenant.branchId ?? null,
      action: `identity.user.bulk_${input.action}`,
      resourceId: tenant.tenantId,
      actorId: input.actorId,
      actorRoles: input.actorRoles,
      locale: tenant.locale ?? null,
      details: { userIds: results, count: results.length },
    });

    return { processed: results.length, userIds: results };
  }
}

@Injectable()
export class GetRecentUserActivityHandler {
  constructor(private readonly prisma: PrismaService, private readonly tenantContext: TenantContextService) {}

  async execute(limit = 15) {
    const tenant = await this.tenantContext.resolve();
    const rows = await this.prisma.auditEntry.findMany({
      where: { tenantId: tenant.tenantId, resourceType: 'identity.user' },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      resourceId: r.resourceId,
      actorId: r.actorId,
      description: r.descriptionEn ?? r.action,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}

export { DOMAIN_EMPLOYMENT, PRISMA_EMPLOYMENT };
