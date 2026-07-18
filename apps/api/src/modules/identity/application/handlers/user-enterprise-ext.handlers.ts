import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../../../../infrastructure/prisma.service';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { USER_REPOSITORY } from '../../../../infrastructure/provider.tokens';
import { UserRepository } from '../../domain/user.repository.interface';
import { User } from '../../domain/user.entity';
import { IDENTITY_AUDIT_LOG, IdentityAuditLog } from '../ports/identity-audit-log.port';
import { toUserDetailDto } from '../mappers/user.mapper';
import {
  DeactivateUserHandler,
  ReactivateUserHandler,
  UpdateUserHandler,
} from './user-management.handlers';
import {
  ArchiveUserHandler,
  RestoreUserHandler,
  SuspendUserHandler,
  SyncUserBranchAccessHandler,
} from './user-enterprise.handlers';
import { InviteStaffUserHandler } from './user-security.handlers';
import { SubscriptionEnforcementService } from '../../../subscription/application/services/subscription-enforcement.service';
import { NotificationIntentProducerService } from '../../../notifications/delivery/notification-intent-producer.service';

@Injectable()
export class LockUserHandler {
  constructor(
    @Inject(USER_REPOSITORY) private readonly repo: UserRepository,
    @Inject(IDENTITY_AUDIT_LOG) private readonly audit: IdentityAuditLog,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(userId: string, actorId: string, actorRoles: string[], reason?: string) {
    const tenant = await this.tenantContext.resolve();
    const user = await this.repo.findById(userId, tenant.tenantId);
    if (!user) return null;
    const lockedUntil = new Date('2099-12-31T23:59:59.000Z');
    const updated = user.adminLock(lockedUntil);
    await this.repo.save(updated);
    await this.audit.record({
      tenantId: tenant.tenantId,
      branchId: tenant.branchId ?? null,
      action: 'identity.user.locked',
      resourceId: userId,
      actorId,
      actorRoles,
      locale: tenant.locale ?? null,
      reason: reason ?? null,
    });
    return toUserDetailDto(updated, []);
  }
}

@Injectable()
export class GetPermissionOverviewHandler {
  async execute() {
    const matrixPath = join(process.cwd(), 'config', 'permission-matrix.json');
    const matrix = JSON.parse(readFileSync(matrixPath, 'utf8')) as {
      resources: Array<{ id: string; permissions?: Record<string, string[]> }>;
    };
    const resources = matrix.resources.map((r) => ({
      id: r.id,
      actions: Object.keys(r.permissions ?? {}),
      roleCount: Object.values(r.permissions ?? {}).reduce((max, roles) => Math.max(max, roles?.length ?? 0), 0),
    }));
    return {
      resourceCount: resources.length,
      resources: resources.slice(0, 12),
      actionTypes: ['view', 'create', 'update', 'delete', 'approve', 'export', 'manage'],
    };
  }
}

@Injectable()
export class UpdateCustomRoleHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(IDENTITY_AUDIT_LOG) private readonly audit: IdentityAuditLog,
  ) {}

  async execute(
    roleId: string,
    input: { name?: string; description?: string; permissions?: Record<string, string[]>; actorId: string; actorRoles: string[] },
  ) {
    const tenant = await this.tenantContext.resolve();
    const existing = await this.prisma.customRole.findFirst({ where: { id: roleId, tenantId: tenant.tenantId } });
    if (!existing) throw new NotFoundException('Role not found');
    const row = await this.prisma.customRole.update({
      where: { id: roleId },
      data: {
        name: input.name?.trim() ?? existing.name,
        description: input.description?.trim() ?? existing.description,
        permissions: (input.permissions ?? existing.permissions) as Prisma.InputJsonValue,
      },
    });
    await this.audit.record({
      tenantId: tenant.tenantId,
      branchId: tenant.branchId ?? null,
      action: 'identity.role.updated',
      resourceId: roleId,
      actorId: input.actorId,
      actorRoles: input.actorRoles,
      locale: tenant.locale ?? null,
    });
    return { id: row.id, name: row.name, description: row.description, permissions: row.permissions };
  }
}

@Injectable()
export class DuplicateCustomRoleHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(IDENTITY_AUDIT_LOG) private readonly audit: IdentityAuditLog,
  ) {}

  async execute(roleId: string, actorId: string, actorRoles: string[]) {
    const tenant = await this.tenantContext.resolve();
    const source = await this.prisma.customRole.findFirst({ where: { id: roleId, tenantId: tenant.tenantId } });
    if (!source) throw new NotFoundException('Role not found');
    const name = `${source.name} (copy)`;
    const row = await this.prisma.customRole.create({
      data: {
        tenantId: tenant.tenantId,
        name,
        description: source.description,
        permissions: source.permissions as object,
      },
    });
    await this.audit.record({
      tenantId: tenant.tenantId,
      branchId: tenant.branchId ?? null,
      action: 'identity.role.duplicated',
      resourceId: row.id,
      actorId,
      actorRoles,
      locale: tenant.locale ?? null,
      details: { sourceId: roleId },
    });
    return { id: row.id, name: row.name, description: row.description, permissions: row.permissions };
  }
}

@Injectable()
export class ArchiveCustomRoleHandler {
  constructor(private readonly prisma: PrismaService, private readonly tenantContext: TenantContextService) {}

  async execute(roleId: string) {
    const tenant = await this.tenantContext.resolve();
    const row = await this.prisma.customRole.updateMany({
      where: { id: roleId, tenantId: tenant.tenantId },
      data: { isArchived: true },
    });
    if (!row.count) throw new NotFoundException('Role not found');
    return { archived: true };
  }
}

@Injectable()
export class DeleteCustomRoleHandler {
  constructor(private readonly prisma: PrismaService, private readonly tenantContext: TenantContextService) {}

  async execute(roleId: string) {
    const tenant = await this.tenantContext.resolve();
    await this.prisma.userCustomRole.deleteMany({ where: { customRoleId: roleId, tenantId: tenant.tenantId } });
    const row = await this.prisma.customRole.deleteMany({ where: { id: roleId, tenantId: tenant.tenantId } });
    if (!row.count) throw new NotFoundException('Role not found');
    return { deleted: true };
  }
}

@Injectable()
export class AssignUserCustomRolesHandler {
  constructor(private readonly prisma: PrismaService, private readonly tenantContext: TenantContextService) {}

  async execute(userId: string, customRoleIds: string[]) {
    const tenant = await this.tenantContext.resolve();
    await this.prisma.$transaction(async (tx) => {
      await tx.userCustomRole.deleteMany({ where: { userId, tenantId: tenant.tenantId } });
      if (customRoleIds.length) {
        await tx.userCustomRole.createMany({
          data: customRoleIds.map((customRoleId) => ({ tenantId: tenant.tenantId, userId, customRoleId })),
          skipDuplicates: true,
        });
      }
    });
    return customRoleIds;
  }
}

@Injectable()
export class ListUserSavedFiltersHandler {
  constructor(private readonly prisma: PrismaService, private readonly tenantContext: TenantContextService) {}

  async execute(userId: string) {
    const tenant = await this.tenantContext.resolve();
    const rows = await this.prisma.userSavedFilter.findMany({
      where: { tenantId: tenant.tenantId, userId },
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => ({ id: r.id, name: r.name, filters: r.filters, createdAt: r.createdAt.toISOString() }));
  }
}

@Injectable()
export class SaveUserFilterHandler {
  constructor(private readonly prisma: PrismaService, private readonly tenantContext: TenantContextService) {}

  async execute(userId: string, input: { name: string; filters: Record<string, unknown> }) {
    const tenant = await this.tenantContext.resolve();
    const existing = await this.prisma.userSavedFilter.findFirst({
      where: { tenantId: tenant.tenantId, userId, name: input.name.trim() },
    });
    if (existing) {
      const row = await this.prisma.userSavedFilter.update({
        where: { id: existing.id },
        data: { filters: input.filters as Prisma.InputJsonValue },
      });
      return { id: row.id, name: row.name, filters: row.filters };
    }
    const row = await this.prisma.userSavedFilter.create({
      data: {
        tenantId: tenant.tenantId,
        userId,
        name: input.name.trim(),
        filters: input.filters as Prisma.InputJsonValue,
      },
    });
    return { id: row.id, name: row.name, filters: row.filters };
  }
}

@Injectable()
export class DeleteUserSavedFilterHandler {
  constructor(private readonly prisma: PrismaService, private readonly tenantContext: TenantContextService) {}

  async execute(userId: string, filterId: string) {
    const tenant = await this.tenantContext.resolve();
    await this.prisma.userSavedFilter.deleteMany({ where: { id: filterId, tenantId: tenant.tenantId, userId } });
    return { deleted: true };
  }
}

@Injectable()
export class GetStaffWeeklyScheduleHandler {
  constructor(private readonly prisma: PrismaService, private readonly tenantContext: TenantContextService) {}

  async execute(userId: string) {
    const tenant = await this.tenantContext.resolve();
    const rows = await this.prisma.staffWeeklySchedule.findMany({
      where: { tenantId: tenant.tenantId, userId },
      orderBy: { dayOfWeek: 'asc' },
    });
    return rows.map((r) => ({
      dayOfWeek: r.dayOfWeek,
      startHour: r.startHour,
      startMin: r.startMin,
      endHour: r.endHour,
      endMin: r.endMin,
      isOff: r.isOff,
    }));
  }
}

@Injectable()
export class UpdateStaffWeeklyScheduleHandler {
  constructor(private readonly prisma: PrismaService, private readonly tenantContext: TenantContextService) {}

  async execute(userId: string, days: Array<{ dayOfWeek: number; startHour: number; startMin: number; endHour: number; endMin: number; isOff: boolean }>) {
    const tenant = await this.tenantContext.resolve();
    await this.prisma.$transaction(async (tx) => {
      await tx.staffWeeklySchedule.deleteMany({ where: { userId, tenantId: tenant.tenantId } });
      if (days.length) {
        await tx.staffWeeklySchedule.createMany({
          data: days.map((d) => ({ tenantId: tenant.tenantId, userId, ...d })),
        });
      }
    });
    return days;
  }
}

@Injectable()
export class ExportUsersExcelHandler {
  constructor(private readonly tenantContext: TenantContextService, private readonly prisma: PrismaService) {}

  async execute(query: { search?: string; status?: string }) {
    const tenant = await this.tenantContext.resolve();
    const where: Record<string, unknown> = { tenantId: tenant.tenantId, deletedAt: null };
    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
      ];
    }
    const rows = await this.prisma.user.findMany({
      where,
      include: { roles: { select: { role: true } } },
      take: 10_000,
      orderBy: [{ lastName: 'asc' }],
    });
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Users');
    sheet.addRow(['Name', 'Email', 'Roles', 'Status', 'Phone', 'Last Login']);
    for (const u of rows) {
      sheet.addRow([
        `${u.firstName} ${u.lastName}`,
        u.email,
        u.roles.map((r) => r.role).join(';'),
        u.isActive ? 'active' : 'inactive',
        u.phone ?? '',
        u.lastLoginAt?.toISOString() ?? '',
      ]);
    }
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}

@Injectable()
export class ExportUsersPdfHandler {
  constructor(private readonly prisma: PrismaService, private readonly tenantContext: TenantContextService) {}

  async execute() {
    const tenant = await this.tenantContext.resolve();
    const rows = await this.prisma.user.findMany({
      where: { tenantId: tenant.tenantId, deletedAt: null },
      take: 200,
      orderBy: [{ lastName: 'asc' }],
      select: { firstName: true, lastName: true, email: true, isActive: true },
    });
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    let y = 800;
    page.drawText('User Directory Export', { x: 50, y, size: 16, font });
    y -= 30;
    for (const u of rows) {
      if (y < 50) break;
      page.drawText(`${u.firstName} ${u.lastName} — ${u.email} (${u.isActive ? 'active' : 'inactive'})`, {
        x: 50,
        y,
        size: 10,
        font,
      });
      y -= 14;
    }
    return Buffer.from(await pdf.save());
  }
}

@Injectable()
export class FullBulkUserActionHandler {
  constructor(
    @Inject(IDENTITY_AUDIT_LOG) private readonly audit: IdentityAuditLog,
    private readonly tenantContext: TenantContextService,
    private readonly deactivateHandler: DeactivateUserHandler,
    private readonly reactivateHandler: ReactivateUserHandler,
    private readonly suspendHandler: SuspendUserHandler,
    private readonly archiveHandler: ArchiveUserHandler,
    private readonly restoreHandler: RestoreUserHandler,
    private readonly updateHandler: UpdateUserHandler,
    private readonly branchSyncHandler: SyncUserBranchAccessHandler,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: {
    userIds: string[];
    action:
      | 'deactivate'
      | 'reactivate'
      | 'suspend'
      | 'archive'
      | 'restore'
      | 'assign_roles'
      | 'assign_branches'
      | 'assign_departments';
    roles?: string[];
    branchIds?: string[];
    departmentId?: string;
    actorId: string;
    actorRoles: string[];
  }) {
    const tenant = await this.tenantContext.resolve();
    const results: string[] = [];
    for (const userId of input.userIds) {
      let ok = false;
      if (input.action === 'deactivate') {
        ok = Boolean(await this.deactivateHandler.execute(userId));
      } else if (input.action === 'reactivate') {
        ok = Boolean(await this.reactivateHandler.execute(userId));
      } else if (input.action === 'suspend') {
        ok = Boolean(await this.suspendHandler.execute(userId, input.actorId, input.actorRoles));
      } else if (input.action === 'archive') {
        ok = Boolean(await this.archiveHandler.execute(userId, input.actorId, input.actorRoles));
      } else if (input.action === 'restore') {
        ok = Boolean(await this.restoreHandler.execute(userId, input.actorId, input.actorRoles));
      } else if (input.action === 'assign_roles' && input.roles?.length) {
        ok = Boolean(
          await this.updateHandler.execute(userId, { roles: input.roles as User['roles'] }, input.actorId, input.actorRoles),
        );
      } else if (input.action === 'assign_branches' && input.branchIds) {
        ok = Boolean(await this.branchSyncHandler.execute(userId, input.branchIds));
      } else if (input.action === 'assign_departments' && input.departmentId) {
        const row = await this.prisma.user.updateMany({
          where: { id: userId, tenantId: tenant.tenantId },
          data: { departmentId: input.departmentId },
        });
        ok = row.count > 0;
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
export class ListRegionsHandler {
  constructor(private readonly prisma: PrismaService, private readonly tenantContext: TenantContextService) {}

  async execute() {
    const tenant = await this.tenantContext.resolve();
    const rows = await this.prisma.region.findMany({
      where: { tenantId: tenant.tenantId, isActive: true },
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => ({ id: r.id, name: r.name, nameAr: r.nameAr }));
  }
}

@Injectable()
export class CreateRegionHandler {
  constructor(private readonly prisma: PrismaService, private readonly tenantContext: TenantContextService) {}

  async execute(input: { name: string; nameAr?: string }) {
    const tenant = await this.tenantContext.resolve();
    const row = await this.prisma.region.create({
      data: { tenantId: tenant.tenantId, name: input.name.trim(), nameAr: input.nameAr?.trim() || null },
    });
    return { id: row.id, name: row.name, nameAr: row.nameAr };
  }
}

@Injectable()
export class SyncUserRegionAccessHandler {
  constructor(private readonly prisma: PrismaService, private readonly tenantContext: TenantContextService) {}

  async execute(userId: string, regionIds: string[]) {
    const tenant = await this.tenantContext.resolve();
    if (regionIds.length) {
      const valid = await this.prisma.region.findMany({
        where: { tenantId: tenant.tenantId, id: { in: regionIds }, isActive: true },
        select: { id: true },
      });
      const validIds = new Set(valid.map((r) => r.id));
      const invalid = regionIds.filter((id) => !validIds.has(id));
      if (invalid.length) {
        throw new ConflictException(`Unknown region(s): ${invalid.join(', ')}`);
      }
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.userRegionAccess.deleteMany({ where: { userId, tenantId: tenant.tenantId } });
      if (regionIds.length) {
        await tx.userRegionAccess.createMany({
          data: regionIds.map((regionId) => ({ tenantId: tenant.tenantId, userId, regionId })),
          skipDuplicates: true,
        });
      }
    });
    return regionIds;
  }
}

@Injectable()
export class SmsInviteStaffHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly inviteHandler: InviteStaffUserHandler,
    private readonly subscriptionEnforcement: SubscriptionEnforcementService,
    private readonly producer: NotificationIntentProducerService,
  ) {}

  async execute(input: Parameters<InviteStaffUserHandler['execute']>[0]) {
    const tenant = await this.tenantContext.resolve();
    const row = await this.prisma.tenant.findUnique({ where: { id: tenant.tenantId }, select: { features: true } });
    const features = row?.features as Record<string, boolean> | null;
    if (!features?.smsInvites) {
      throw new ConflictException('SMS invitations are not enabled for this organization');
    }
    await this.subscriptionEnforcement.enforceFeature(tenant.tenantId, 'smsInvites');
    if (!input.phone?.trim()) {
      throw new ConflictException('Phone number is required for SMS invitation');
    }
    const result = await this.inviteHandler.execute(input);
    const recipientPhone = input.phone.trim();
    const smsBody = `You have been invited to Demo Clinic. Complete setup using the link sent to your email.`;
    await this.producer.produceChannels({
      tenantId: tenant.tenantId,
      branchId: input.branchId ?? tenant.branchId ?? null,
      recipientId: result.user.id,
      title: 'Clinic invitation',
      body: smsBody,
      priority: 'medium',
      channels: ['sms'],
      idempotencyKey: `sms-invite-staff:${result.user.id}`,
      producerModuleId: 'identity.sms-invite-staff',
      metadata: { recipientPhone },
    });
    return result;
  }
}
