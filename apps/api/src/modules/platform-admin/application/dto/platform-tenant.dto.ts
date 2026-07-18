import { EffectivePrivilegedAccessGrantStatus } from '../../domain/value-objects/privileged-access-grant-status';
import { PrivilegedAccessScope } from '../../domain/value-objects/privileged-access-scope';
import { PlatformTenantStatus } from '../../domain/value-objects/platform-tenant-status';
import { PlatformRegion } from '../../domain/value-objects/platform-region';
import { EntitlementPlan } from '../../domain/value-objects/entitlement-plan';

export interface PrivilegedAccessGrantDto {
  grantId: string;
  adminId: string;
  adminName: string;
  scopes: PrivilegedAccessScope[];
  justification: string;
  breakGlass: boolean;
  status: EffectivePrivilegedAccessGrantStatus;
  requestedAt: string;
  expiresAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedReason: string | null;
  rejectedAt: string | null;
  revokedReason: string | null;
  revokedAt: string | null;
  active: boolean;
}

export interface PlatformTenantDto {
  platformTenantId: string;
  tenantId: string;
  displayName: string;
  region: PlatformRegion;
  plan: EntitlementPlan;
  planLimits: { maxBranches: number | null; maxUsers: number | null };
  status: PlatformTenantStatus;
  privilegedGrants: PrivilegedAccessGrantDto[];
  provisionedBy: string;
  createdAt: string;
  updatedAt: string;
  activatedAt: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
  archivedAt: string | null;
  archivedReason: string | null;
}

export interface PlatformTenantPageDto {
  items: PlatformTenantDto[];
  total: number;
  limit: number;
  offset: number;
}
