import { EmploymentStatus, User } from '../../domain/user.entity';

export interface UserSummaryDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  firstNameAr: string | null;
  lastNameAr: string | null;
  fullName: string;
  phone: string | null;
  jobTitle: string | null;
  departmentId: string | null;
  employmentStatus: EmploymentStatus;
  roles: string[];
  tenantId: string;
  branchId: string | null;
  isActive: boolean;
  emailVerified: boolean;
  mfaEnabled: boolean;
  isLocked: boolean;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserDetailDto extends UserSummaryDto {
  managerId: string | null;
  startDate: string | null;
  timezone: string | null;
  languages: string[];
  notes: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  suspendedAt: string | null;
  archivedAt: string | null;
  branchIds: string[];
  customRoleIds: string[];
  regionIds: string[];
  branchAccessMode: 'single' | 'multi' | 'global';
}

export function toUserSummaryDto(user: User): UserSummaryDto {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    firstNameAr: user.firstNameAr,
    lastNameAr: user.lastNameAr,
    fullName: user.fullName,
    phone: user.phone,
    jobTitle: user.jobTitle,
    departmentId: user.departmentId,
    employmentStatus: user.employmentStatus,
    roles: user.roles,
    tenantId: user.tenantId,
    branchId: user.branchId,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    mfaEnabled: user.mfaEnabled,
    isLocked: user.isLocked(),
    lockedUntil: user.lockedUntil?.toISOString() ?? null,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    lastLoginIp: user.lastLoginIp,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function toUserDetailDto(
  user: User,
  branchIds: string[] = [],
  extras: {
    customRoleIds?: string[];
    branchAccessMode?: 'single' | 'multi' | 'global';
    regionIds?: string[];
  } = {},
): UserDetailDto {
  return {
    ...toUserSummaryDto(user),
    managerId: user.managerId,
    startDate: user.startDate?.toISOString().slice(0, 10) ?? null,
    timezone: user.timezone,
    languages: user.languages,
    notes: user.notes,
    emergencyContactName: user.emergencyContactName,
    emergencyContactPhone: user.emergencyContactPhone,
    suspendedAt: user.suspendedAt?.toISOString() ?? null,
    archivedAt: user.archivedAt?.toISOString() ?? null,
    branchIds,
    customRoleIds: extras.customRoleIds ?? [],
    regionIds: extras.regionIds ?? [],
    branchAccessMode: extras.branchAccessMode ?? 'single',
  };
}
