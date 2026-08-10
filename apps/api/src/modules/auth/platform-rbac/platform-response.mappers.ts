/**
 * Explicit allowlisted Platform API response DTOs and field-by-field mappers.
 * Never spread Prisma records, domain entities, or persistence objects into responses.
 */

import type { PlatformPermissionDefinition, PlatformRoleDefinition } from './platform-rbac.catalog';
import type { PlatformUser } from '../domain/entities/platform-user.entity';
import type { PlatformInvitationDeliveryResult } from '../infrastructure/services/platform-invitation-delivery.port';

export const FORBIDDEN_PLATFORM_RESPONSE_FIELDS = [
  'passwordHash',
  'mfaSecretEncrypted',
  'mfaPendingSecretEncrypted',
  'mfaEncryptionKeyVersion',
  'mfaKeyVersion',
  'recoveryCodeHashes',
  'refreshTokenHash',
  'invitationTokenHash',
  'tokenHash',
  'rawUserAgent',
  'userAgent',
  'rawIp',
  'ipAddress',
  'lastLoginIp',
  'familyId',
  'activationUrl',
  'token',
  'password',
  'otpauthUrl',
  'secret',
] as const;

export interface PlatformPrincipalResponseDto {
  id: string;
  email: string;
  displayName: string | null;
  principalType: 'platform';
  accountStatus: string;
  status: string;
  sessionId: string;
  mfaEnabled: boolean;
  roleKeys: string[];
  permissions: string[];
  authzRevision: number;
}

export interface PlatformUserListItemDto {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
  mfaEnabled: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  roleKeys: string[];
  activeSessionCount: number;
  invitationStatus: string | null;
}

export interface PlatformUserListResponseDto {
  items: PlatformUserListItemDto[];
  page: number;
  pageSize: number;
  total: number;
}

export interface PlatformUserDetailDto {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
  isActive: boolean;
  mfaEnabled: boolean;
  mfaConfirmedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  suspendedAt: Date | null;
  suspendedReason: string | null;
  authzRevision: number;
  roleKeys: string[];
  activeSessionCount: number;
  invitationStatus: string | null;
}

export interface PlatformInvitationAdminDto {
  invitationId: string;
  platformUserId: string;
  status: string;
  expiresAt: Date;
  deliveryChannel: string | null;
  deliveryStatus: string | null;
  createdAt: Date | null;
}

export interface PlatformInvitationValidationDto {
  valid: boolean;
  expired: boolean;
  canActivate: boolean;
  emailHint?: string;
}

export interface PlatformInvitationAcceptDto {
  kind: 'mfa_enrollment_required';
  preauthToken: string;
  expiresIn: number;
}

export interface PlatformAdminSessionDto {
  sessionId: string;
  isCurrent: boolean | null;
  deviceSummary: string;
  deviceCategory: string;
  deviceLabel: string | null;
  createdAt: Date;
  lastInteractiveActivityAt: Date;
  idleExpiresAt: Date | null;
  absoluteExpiresAt: Date | null;
  authMethod: string | null;
  isStepUpFresh: boolean | null;
  revoked: boolean;
}

export interface PlatformMfaResetRequestDto {
  id: string;
  targetUserId: string;
  requesterId: string;
  approverId: string | null;
  status: string;
  reason: string;
  externalRef: string | null;
  createdAt: Date;
  expiresAt: Date;
  decidedAt: Date | null;
  completedAt: Date | null;
  riskClassification: string;
}

export interface PlatformRoleCatalogItemDto {
  key: string;
  displayName: string;
  description: string;
  scope: string;
  highImpact: boolean;
  active: boolean;
  permissionKeys: string[];
}

export interface PlatformPermissionCatalogItemDto {
  key: string;
  displayLabel: string;
  description: string;
  domain: string;
  action: string;
  risk: string;
  stepUpExpected: boolean;
  dualControlExpected: boolean;
  active: boolean;
}

function dateOrNull(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  return value instanceof Date ? value : new Date(value);
}

export function mapPlatformPrincipalResponse(input: {
  id: string;
  email: string;
  displayName: string | null;
  accountStatus: string;
  status: string;
  sessionId: string;
  mfaEnabled: boolean;
  roleKeys: string[];
  permissions: string[];
  authzRevision: number;
}): PlatformPrincipalResponseDto {
  return {
    id: input.id,
    email: input.email,
    displayName: input.displayName,
    principalType: 'platform',
    accountStatus: input.accountStatus,
    status: input.status,
    sessionId: input.sessionId,
    mfaEnabled: input.mfaEnabled,
    roleKeys: [...input.roleKeys],
    permissions: [...input.permissions],
    authzRevision: input.authzRevision,
  };
}

export function mapPlatformUserListItem(
  user: PlatformUser,
  opts: { roleKeys?: string[]; activeSessionCount?: number; invitationStatus?: string | null } = {},
): PlatformUserListItemDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    status: user.status,
    mfaEnabled: user.mfaEnabled,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    roleKeys: [...(opts.roleKeys ?? [])],
    activeSessionCount: opts.activeSessionCount ?? 0,
    invitationStatus: opts.invitationStatus ?? (user.status === 'pending_activation' ? 'pending' : null),
  };
}

export function mapPlatformUserListResponse(input: {
  items: PlatformUserListItemDto[];
  page: number;
  pageSize: number;
  total: number;
}): PlatformUserListResponseDto {
  return {
    items: input.items.map((item) => ({ ...item, roleKeys: [...item.roleKeys] })),
    page: input.page,
    pageSize: input.pageSize,
    total: input.total,
  };
}

export function mapPlatformUserDetail(
  user: PlatformUser,
  opts: { roleKeys: string[]; activeSessionCount: number; invitationStatus?: string | null },
): PlatformUserDetailDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    status: user.status,
    isActive: user.isActive,
    mfaEnabled: user.mfaEnabled,
    mfaConfirmedAt: user.mfaConfirmedAt,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    suspendedAt: user.suspendedAt,
    suspendedReason: user.suspendedReason,
    authzRevision: user.authzRevision,
    roleKeys: [...opts.roleKeys],
    activeSessionCount: opts.activeSessionCount,
    invitationStatus: opts.invitationStatus ?? (user.status === 'pending_activation' ? 'pending' : null),
  };
}

export function mapPlatformInvitationAdmin(input: {
  invitationId: string;
  platformUserId: string;
  status: string;
  expiresAt: Date;
  createdAt?: Date | null;
  delivery?: PlatformInvitationDeliveryResult | null;
}): PlatformInvitationAdminDto {
  return {
    invitationId: input.invitationId,
    platformUserId: input.platformUserId,
    status: input.status,
    expiresAt: input.expiresAt,
    deliveryChannel: input.delivery?.channel ?? null,
    deliveryStatus: input.delivery?.deliveryStatus ?? null,
    createdAt: input.createdAt ?? null,
  };
}

export function mapPlatformInvitationValidation(input: {
  valid: boolean;
  expired: boolean;
  canActivate: boolean;
  emailHint?: string;
}): PlatformInvitationValidationDto {
  const dto: PlatformInvitationValidationDto = {
    valid: input.valid,
    expired: input.expired,
    canActivate: input.canActivate,
  };
  if (input.emailHint) dto.emailHint = input.emailHint;
  return dto;
}

export function mapPlatformInvitationAccept(input: {
  preauthToken: string;
  expiresIn: number;
}): PlatformInvitationAcceptDto {
  return {
    kind: 'mfa_enrollment_required',
    preauthToken: input.preauthToken,
    expiresIn: input.expiresIn,
  };
}

export function mapPlatformAdminSession(input: {
  sessionId: string;
  createdAt: Date;
  lastInteractiveActivityAt: Date;
  deviceSummary: string;
  deviceCategory?: string;
  deviceLabel?: string | null;
  idleExpiresAt?: Date | null;
  absoluteExpiresAt?: Date | null;
  authMethod?: string | null;
  isCurrent?: boolean | null;
  isStepUpFresh?: boolean | null;
  revoked?: boolean;
}): PlatformAdminSessionDto {
  return {
    sessionId: input.sessionId,
    isCurrent: input.isCurrent ?? null,
    deviceSummary: input.deviceSummary,
    deviceCategory: input.deviceCategory ?? 'unknown',
    deviceLabel: input.deviceLabel ?? null,
    createdAt: input.createdAt,
    lastInteractiveActivityAt: input.lastInteractiveActivityAt,
    idleExpiresAt: dateOrNull(input.idleExpiresAt),
    absoluteExpiresAt: dateOrNull(input.absoluteExpiresAt),
    authMethod: input.authMethod ?? null,
    isStepUpFresh: input.isStepUpFresh ?? null,
    revoked: input.revoked ?? false,
  };
}

export function mapPlatformMfaResetRequest(row: {
  id: string;
  targetUserId: string;
  requesterId: string;
  approverId?: string | null;
  status: string;
  reason: string;
  externalRef?: string | null;
  createdAt: Date;
  expiresAt: Date;
  decidedAt?: Date | null;
  completedAt?: Date | null;
}): PlatformMfaResetRequestDto {
  return {
    id: row.id,
    targetUserId: row.targetUserId,
    requesterId: row.requesterId,
    approverId: row.approverId ?? null,
    status: row.status,
    reason: row.reason,
    externalRef: row.externalRef ?? null,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    decidedAt: row.decidedAt ?? null,
    completedAt: row.completedAt ?? null,
    riskClassification: 'critical',
  };
}

export function mapPlatformRoleCatalogItem(role: PlatformRoleDefinition): PlatformRoleCatalogItemDto {
  return {
    key: role.key,
    displayName: role.displayName,
    description: role.description,
    scope: role.scope,
    highImpact: role.highImpact,
    active: true,
    permissionKeys: [...role.permissionKeys],
  };
}

export function mapPlatformPermissionCatalogItem(
  permission: PlatformPermissionDefinition,
): PlatformPermissionCatalogItemDto {
  return {
    key: permission.key,
    displayLabel: permission.description,
    description: permission.description,
    domain: permission.domain,
    action: permission.action,
    risk: permission.risk,
    stepUpExpected: permission.stepUpExpected,
    dualControlExpected: permission.dualControlLater,
    active: permission.lifecycle === 'active',
  };
}

/** Assert serialized JSON has no forbidden field names or sentinel secrets. */
export function assertNoForbiddenPlatformFields(serialized: string, sentinel = 'SHOULD_NEVER_LEAK'): void {
  if (serialized.includes(sentinel)) {
    throw new Error('Serialized Platform response leaked a sentinel secret.');
  }
  for (const field of FORBIDDEN_PLATFORM_RESPONSE_FIELDS) {
    const pattern = new RegExp(`"${field}"\\s*:`);
    if (pattern.test(serialized)) {
      throw new Error(`Serialized Platform response included forbidden field: ${field}`);
    }
  }
}
