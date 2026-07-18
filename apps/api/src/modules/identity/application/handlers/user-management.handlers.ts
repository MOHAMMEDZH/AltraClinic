import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { USER_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { UserRepository } from '../../domain/user.repository.interface';
import { EmploymentStatus, UserRole } from '../../domain/user.entity';
import { toUserDetailDto, toUserSummaryDto } from '../mappers/user.mapper';
import { IDENTITY_AUDIT_LOG, IdentityAuditLog } from '../ports/identity-audit-log.port';
import { IdentityFieldPolicyService } from '../services/identity-field-policy.service';
import { IdentityNotificationService } from '../services/identity-notification.service';
@Injectable()
export class GetUserManagementOverviewHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly repo: UserRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute() {
    const tenant = await this.tenantContext.resolve();
    return this.repo.getOverviewStats(tenant.tenantId);
  }
}

@Injectable()
export class ListUsersHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly repo: UserRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(query: {
    search?: string;
    role?: string;
    branchId?: string;
    departmentId?: string;
    regionId?: string;
    employmentStatus?: EmploymentStatus;
    status?: 'active' | 'inactive' | 'locked' | 'all';
    page?: number;
    limit?: number;
    cursor?: string;
  }) {
    const tenant = await this.tenantContext.resolve();
    const result = await this.repo.list({
      tenantId: tenant.tenantId,
      search: query.search,
      role: query.role as never,
      branchId: query.branchId,
      departmentId: query.departmentId,
      regionId: query.regionId,
      employmentStatus: query.employmentStatus,
      status: query.status ?? 'all',
      page: query.page,
      limit: query.limit,
      cursor: query.cursor,
    });

    return {
      items: result.items.map(toUserSummaryDto),
      total: result.total,
      page: result.page,
      limit: result.limit,
      nextCursor: result.nextCursor ?? null,
    };
  }
}

@Injectable()
export class UpdateUserHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly repo: UserRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(IDENTITY_AUDIT_LOG) private readonly audit: IdentityAuditLog,
    private readonly prisma: PrismaService,
    private readonly fieldPolicy: IdentityFieldPolicyService,
    private readonly notifications: IdentityNotificationService,
  ) {}

  async execute(userId: string, input: UpdateUserInput, actorId: string, actorRoles: string[] = []) {
    const tenant = await this.tenantContext.resolve();
    const user = await this.repo.findById(userId, tenant.tenantId);
    if (!user) return null;

    const canManage = actorRoles.includes('owner') || actorRoles.includes('super_admin') || actorRoles.includes('general_manager');
    const filtered = this.fieldPolicy.filterUpdateInput(actorRoles as UserRole[], input as Record<string, unknown>, canManage) as UpdateUserInput;

    const updated = user.updateProfile({
      firstName: filtered.firstName,
      lastName: filtered.lastName,
      firstNameAr: filtered.firstNameAr,
      lastNameAr: filtered.lastNameAr,
      phone: filtered.phone,
      branchId: filtered.branchId,
      roles: filtered.roles,
      jobTitle: filtered.jobTitle,
      departmentId: filtered.departmentId,
      managerId: filtered.managerId,
      startDate: filtered.startDate ? new Date(filtered.startDate) : filtered.startDate === null ? null : undefined,
      employmentStatus: filtered.employmentStatus,
      timezone: filtered.timezone,
      languages: filtered.languages,
      avatarUrl: filtered.avatarUrl,
      notes: filtered.notes,
      emergencyContactName: filtered.emergencyContactName,
      emergencyContactPhone: filtered.emergencyContactPhone,
    });

    await this.repo.save(updated, actorId);

    if (filtered.branchAccessMode) {
      const mode = filtered.branchAccessMode.toUpperCase() as 'SINGLE' | 'MULTI' | 'GLOBAL';
      await this.prisma.user.update({ where: { id: userId }, data: { branchAccessMode: mode } });
    }

    if (filtered.branchIds) {
      await this.prisma.$transaction(async (tx) => {
        await tx.userBranchAccess.deleteMany({ where: { userId, tenantId: tenant.tenantId } });
        if (filtered.branchIds!.length > 0) {
          await tx.userBranchAccess.createMany({
            data: filtered.branchIds!.map((branchId) => ({ tenantId: tenant.tenantId, userId, branchId })),
            skipDuplicates: true,
          });
        }
      });
    }

    const branchRows = await this.prisma.userBranchAccess.findMany({
      where: { userId, tenantId: tenant.tenantId },
      select: { branchId: true },
    });

    await this.audit.record({
      tenantId: tenant.tenantId,
      branchId: updated.branchId,
      action: 'identity.user.updated',
      resourceId: userId,
      actorId,
      actorRoles,
      locale: tenant.locale ?? null,
      changes: {
        roles: filtered.roles ? { from: user.roles, to: updated.roles } : undefined,
        branchId: filtered.branchId !== undefined ? { from: user.branchId, to: updated.branchId } : undefined,
      },
    });

    if (filtered.roles && JSON.stringify(filtered.roles) !== JSON.stringify(user.roles)) {
      await this.notifications.rolesChanged(userId, tenant.branchId ?? null);
    }

    return toUserDetailDto(updated, branchRows.map((b) => b.branchId));
  }
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  firstNameAr?: string | null;
  lastNameAr?: string | null;
  phone?: string | null;
  branchId?: string | null;
  branchIds?: string[];
  roles?: import('../../domain/user.entity').UserRole[];
  jobTitle?: string | null;
  departmentId?: string | null;
  managerId?: string | null;
  startDate?: string | null;
  employmentStatus?: EmploymentStatus;
  timezone?: string | null;
  languages?: string[];
  avatarUrl?: string | null;
  notes?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  branchAccessMode?: 'single' | 'multi' | 'global';
}

@Injectable()
export class DeactivateUserHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly repo: UserRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(IDENTITY_AUDIT_LOG) private readonly audit: IdentityAuditLog,
  ) {}

  async execute(userId: string, actorId = 'system', actorRoles: string[] = []) {
    const tenant = await this.tenantContext.resolve();
    const user = await this.repo.findById(userId, tenant.tenantId);
    if (!user) return null;
    const updated = user.deactivate();
    await this.repo.save(updated);
    await this.audit.record({
      tenantId: tenant.tenantId,
      branchId: user.branchId,
      action: 'identity.user.deactivated',
      resourceId: userId,
      actorId,
      actorRoles,
      locale: tenant.locale ?? null,
    });
    return toUserSummaryDto(updated);
  }
}

@Injectable()
export class ReactivateUserHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly repo: UserRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(userId: string) {
    const tenant = await this.tenantContext.resolve();
    const user = await this.repo.findById(userId, tenant.tenantId);
    if (!user) return null;
    const updated = user.activate();
    await this.repo.save(updated);
    return toUserSummaryDto(updated);
  }
}

@Injectable()
export class UnlockUserHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly repo: UserRepository,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(userId: string) {
    const tenant = await this.tenantContext.resolve();
    const user = await this.repo.findById(userId, tenant.tenantId);
    if (!user) return null;
    const updated = user.unlock();
    await this.repo.save(updated);
    return toUserSummaryDto(updated);
  }
}
