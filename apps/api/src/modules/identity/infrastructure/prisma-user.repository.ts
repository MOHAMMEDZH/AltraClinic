import { Injectable } from '@nestjs/common';
import { EmploymentStatus as PrismaEmploymentStatus, Prisma, UserRole as PrismaUserRole } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { EmploymentStatus, User, UserRole } from '../domain/user.entity';
import {
  UserListQuery,
  UserListResult,
  UserOverviewStats,
  UserRepository,
} from '../domain/user.repository.interface';

const PRISMA_TO_DOMAIN: Record<PrismaUserRole, UserRole> = {
  SUPER_ADMIN: 'super_admin',
  OWNER: 'owner',
  GENERAL_MANAGER: 'general_manager',
  BRANCH_MANAGER: 'branch_manager',
  DOCTOR: 'doctor',
  DENTIST: 'dentist',
  SPECIALIST: 'specialist',
  NURSE: 'nurse',
  ASSISTANT: 'assistant',
  RECEPTIONIST: 'receptionist',
  ACCOUNTANT: 'accountant',
  INVENTORY_MANAGER: 'inventory_manager',
  LAB_TECHNICIAN: 'lab_technician',
  RADIOLOGIST: 'radiologist',
  CASHIER: 'cashier',
  HR: 'hr',
  MARKETING: 'marketing',
  PATIENT: 'patient',
};

const DOMAIN_TO_PRISMA: Record<UserRole, PrismaUserRole> = {
  super_admin: PrismaUserRole.SUPER_ADMIN,
  owner: PrismaUserRole.OWNER,
  general_manager: PrismaUserRole.GENERAL_MANAGER,
  branch_manager: PrismaUserRole.BRANCH_MANAGER,
  doctor: PrismaUserRole.DOCTOR,
  dentist: PrismaUserRole.DENTIST,
  specialist: PrismaUserRole.SPECIALIST,
  nurse: PrismaUserRole.NURSE,
  assistant: PrismaUserRole.ASSISTANT,
  receptionist: PrismaUserRole.RECEPTIONIST,
  accountant: PrismaUserRole.ACCOUNTANT,
  inventory_manager: PrismaUserRole.INVENTORY_MANAGER,
  lab_technician: PrismaUserRole.LAB_TECHNICIAN,
  radiologist: PrismaUserRole.RADIOLOGIST,
  cashier: PrismaUserRole.CASHIER,
  hr: PrismaUserRole.HR,
  marketing: PrismaUserRole.MARKETING,
  patient: PrismaUserRole.PATIENT,
};

const DOMAIN_EMPLOYMENT: Record<PrismaEmploymentStatus, EmploymentStatus> = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  ON_LEAVE: 'on_leave',
  ARCHIVED: 'archived',
  TERMINATED: 'terminated',
};

const PRISMA_EMPLOYMENT: Record<EmploymentStatus, PrismaEmploymentStatus> = {
  active: PrismaEmploymentStatus.ACTIVE,
  suspended: PrismaEmploymentStatus.SUSPENDED,
  on_leave: PrismaEmploymentStatus.ON_LEAVE,
  archived: PrismaEmploymentStatus.ARCHIVED,
  terminated: PrismaEmploymentStatus.TERMINATED,
};

function parseLanguages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

type UserRow = {
  id: string;
  tenantId: string;
  branchId: string | null;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  firstNameAr: string | null;
  lastNameAr: string | null;
  phone: string | null;
  jobTitle: string | null;
  departmentId: string | null;
  managerId: string | null;
  startDate: Date | null;
  employmentStatus: PrismaEmploymentStatus;
  timezone: string | null;
  languages: unknown;
  avatarUrl: string | null;
  notes: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  suspendedAt: Date | null;
  archivedAt: Date | null;
  isActive: boolean;
  emailVerified: boolean;
  emailVerifiedAt: Date | null;
  mfaEnabled: boolean;
  mfaSecret: string | null;
  lockedUntil: Date | null;
  failedLoginCount: number;
  passwordChangedAt: Date;
  lastLoginAt: Date | null;
  lastLoginIp: string | null;
  createdAt: Date;
  updatedAt: Date;
  roles: Array<{ role: PrismaUserRole }>;
};

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, tenantId: string): Promise<User | null> {
    const row = await this.prisma.user.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { roles: { select: { role: true } } },
    });
    return row ? this.toDomain(row as UserRow) : null;
  }

  async findByEmail(email: string, tenantId: string): Promise<User | null> {
    const row = await this.prisma.user.findFirst({
      where: { email: email.trim().toLowerCase(), tenantId, deletedAt: null },
      include: { roles: { select: { role: true } } },
    });
    return row ? this.toDomain(row as UserRow) : null;
  }

  async save(user: User, grantedBy?: string | null): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.user.upsert({
        where: { id: user.id },
        create: {
          id: user.id,
          tenantId: user.tenantId,
          branchId: user.branchId,
          email: user.email,
          passwordHash: user.passwordHash,
          firstName: user.firstName,
          lastName: user.lastName,
          firstNameAr: user.firstNameAr,
          lastNameAr: user.lastNameAr,
          phone: user.phone,
          jobTitle: user.jobTitle,
          departmentId: user.departmentId,
          managerId: user.managerId,
          startDate: user.startDate,
          employmentStatus: PRISMA_EMPLOYMENT[user.employmentStatus],
          timezone: user.timezone,
          languages: user.languages,
          avatarUrl: user.avatarUrl,
          notes: user.notes,
          emergencyContactName: user.emergencyContactName,
          emergencyContactPhone: user.emergencyContactPhone,
          suspendedAt: user.suspendedAt,
          archivedAt: user.archivedAt,
          isActive: user.isActive,
          emailVerified: user.emailVerified,
          emailVerifiedAt: user.emailVerifiedAt,
          mfaEnabled: user.mfaEnabled,
          mfaSecret: user.mfaSecret,
          lockedUntil: user.lockedUntil,
          failedLoginCount: user.failedLoginCount,
          passwordChangedAt: user.passwordChangedAt,
          lastLoginAt: user.lastLoginAt,
          lastLoginIp: user.lastLoginIp,
          createdAt: user.createdAt,
        },
        update: {
          email: user.email,
          passwordHash: user.passwordHash,
          firstName: user.firstName,
          lastName: user.lastName,
          firstNameAr: user.firstNameAr,
          lastNameAr: user.lastNameAr,
          phone: user.phone,
          branchId: user.branchId,
          jobTitle: user.jobTitle,
          departmentId: user.departmentId,
          managerId: user.managerId,
          startDate: user.startDate,
          employmentStatus: PRISMA_EMPLOYMENT[user.employmentStatus],
          timezone: user.timezone,
          languages: user.languages,
          avatarUrl: user.avatarUrl,
          notes: user.notes,
          emergencyContactName: user.emergencyContactName,
          emergencyContactPhone: user.emergencyContactPhone,
          suspendedAt: user.suspendedAt,
          archivedAt: user.archivedAt,
          isActive: user.isActive,
          emailVerified: user.emailVerified,
          emailVerifiedAt: user.emailVerifiedAt,
          mfaEnabled: user.mfaEnabled,
          mfaSecret: user.mfaSecret,
          lockedUntil: user.lockedUntil,
          failedLoginCount: user.failedLoginCount,
          passwordChangedAt: user.passwordChangedAt,
          lastLoginAt: user.lastLoginAt,
          lastLoginIp: user.lastLoginIp,
          updatedAt: user.updatedAt,
        },
      });

      await tx.userRoleAssignment.deleteMany({ where: { userId: user.id } });
      if (user.roles.length > 0) {
        await tx.userRoleAssignment.createMany({
          data: user.roles.map((r) => ({
            userId: user.id,
            role: DOMAIN_TO_PRISMA[r],
            grantedBy: grantedBy ?? null,
          })),
          skipDuplicates: true,
        });
      }
    });
  }

  async updateLoginState(user: User): Promise<void> {
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: user.failedLoginCount,
        lockedUntil: user.lockedUntil,
        lastLoginAt: user.lastLoginAt,
        lastLoginIp: user.lastLoginIp,
        updatedAt: new Date(),
      },
    });
  }

  async list(query: UserListQuery): Promise<UserListResult> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));
    const skip = (page - 1) * limit;
    const now = new Date();

    const where: Prisma.UserWhereInput = {
      tenantId: query.tenantId,
      deletedAt: null,
    };

    if (query.branchId) {
      where.branchId = query.branchId;
    }

    if (query.departmentId) {
      where.departmentId = query.departmentId;
    }

    if (query.regionId) {
      const regionalBranches = await this.prisma.branch.findMany({
        where: { tenantId: query.tenantId, regionId: query.regionId },
        select: { id: true },
      });
      const branchIdsInRegion = regionalBranches.map((b) => b.id);
      const regionClause: Prisma.UserWhereInput = {
        OR: [
          ...(branchIdsInRegion.length > 0 ? [{ branchId: { in: branchIdsInRegion } }] : []),
          { regionAccess: { some: { regionId: query.regionId, tenantId: query.tenantId } } },
        ],
      };
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        regionClause,
      ];
    }

    if (query.employmentStatus) {
      where.employmentStatus = PRISMA_EMPLOYMENT[query.employmentStatus];
    }

    if (query.status === 'active') {
      where.isActive = true;
      where.OR = [{ lockedUntil: null }, { lockedUntil: { lte: now } }];
    } else if (query.status === 'inactive') {
      where.isActive = false;
    } else if (query.status === 'locked') {
      where.lockedUntil = { gt: now };
    }

    if (query.role) {
      where.roles = { some: { role: DOMAIN_TO_PRISMA[query.role] } };
    }

    if (query.search?.trim()) {
      const q = query.search.trim();
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { email: { contains: q, mode: 'insensitive' } },
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { firstNameAr: { contains: q, mode: 'insensitive' } },
            { lastNameAr: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { roles: { select: { role: true } } },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
        skip: query.cursor ? 1 : skip,
        cursor: query.cursor ? { id: query.cursor } : undefined,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    const nextCursor = rows.length === limit ? rows[rows.length - 1]?.id ?? null : null;

    return {
      items: rows.map((row) => this.toDomain(row as UserRow)),
      total,
      page,
      limit,
      nextCursor,
    };
  }

  async getOverviewStats(tenantId: string): Promise<UserOverviewStats> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

    const baseWhere = { tenantId, deletedAt: null };

    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      lockedUsers,
      mfaEnabledUsers,
      emailUnverifiedUsers,
      newUsers30d,
      recentlyActive7d,
      onlineSessions,
      roleRows,
      branchRows,
    ] = await Promise.all([
      this.prisma.user.count({ where: baseWhere }),
      this.prisma.user.count({
        where: {
          ...baseWhere,
          isActive: true,
          OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }],
        },
      }),
      this.prisma.user.count({ where: { ...baseWhere, isActive: false } }),
      this.prisma.user.count({ where: { ...baseWhere, lockedUntil: { gt: now } } }),
      this.prisma.user.count({ where: { ...baseWhere, mfaEnabled: true } }),
      this.prisma.user.count({ where: { ...baseWhere, emailVerified: false } }),
      this.prisma.user.count({ where: { ...baseWhere, createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.user.count({ where: { ...baseWhere, lastLoginAt: { gte: sevenDaysAgo } } }),
      this.prisma.refreshToken.count({
        where: { tenantId, revokedAt: null, expiresAt: { gt: now } },
      }),
      this.prisma.userRoleAssignment.groupBy({
        by: ['role'],
        where: { user: baseWhere },
        _count: { role: true },
      }),
      this.prisma.user.groupBy({
        by: ['branchId'],
        where: baseWhere,
        _count: { branchId: true },
      }),
    ]);

    const roleDistribution: Record<string, number> = {};
    for (const row of roleRows) {
      roleDistribution[PRISMA_TO_DOMAIN[row.role]] = row._count.role;
    }

    const branchDistribution: Record<string, number> = {};
    for (const row of branchRows) {
      const key = row.branchId ?? 'unassigned';
      branchDistribution[key] = row._count.branchId;
    }

    const pendingInvitations = await this.countPendingInvitations(tenantId);

    return {
      totalUsers,
      activeUsers,
      inactiveUsers,
      lockedUsers,
      mfaEnabledUsers,
      emailUnverifiedUsers,
      newUsers30d,
      recentlyActive7d,
      onlineSessions,
      pendingInvitations,
      roleDistribution,
      branchDistribution,
    };
  }

  async softDelete(userId: string, tenantId: string): Promise<void> {
    await this.prisma.user.updateMany({
      where: { id: userId, tenantId, deletedAt: null },
      data: { deletedAt: new Date(), isActive: false, updatedAt: new Date() },
    });
  }

  async countPendingInvitations(tenantId: string): Promise<number> {
    return this.prisma.staffInvitation.count({
      where: { tenantId, status: 'PENDING', expiresAt: { gt: new Date() } },
    });
  }

  private toDomain(row: UserRow): User {
    const roles: UserRole[] = row.roles.map((ra) => PRISMA_TO_DOMAIN[ra.role]);

    return User.restore({
      id: row.id,
      email: row.email,
      passwordHash: row.passwordHash,
      roles: roles.length > 0 ? roles : ['patient'],
      tenantId: row.tenantId,
      branchId: row.branchId,
      firstName: row.firstName,
      lastName: row.lastName,
      firstNameAr: row.firstNameAr,
      lastNameAr: row.lastNameAr,
      phone: row.phone,
      jobTitle: row.jobTitle,
      departmentId: row.departmentId,
      managerId: row.managerId,
      startDate: row.startDate,
      employmentStatus: DOMAIN_EMPLOYMENT[row.employmentStatus],
      timezone: row.timezone,
      languages: parseLanguages(row.languages),
      avatarUrl: row.avatarUrl,
      notes: row.notes,
      emergencyContactName: row.emergencyContactName,
      emergencyContactPhone: row.emergencyContactPhone,
      suspendedAt: row.suspendedAt,
      archivedAt: row.archivedAt,
      isActive: row.isActive,
      emailVerified: row.emailVerified,
      emailVerifiedAt: row.emailVerifiedAt,
      mfaEnabled: row.mfaEnabled,
      mfaSecret: row.mfaSecret,
      lockedUntil: row.lockedUntil,
      failedLoginCount: row.failedLoginCount,
      passwordChangedAt: row.passwordChangedAt,
      lastLoginAt: row.lastLoginAt,
      lastLoginIp: row.lastLoginIp,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
