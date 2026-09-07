import {
  getPlatformRole,
  PLATFORM_ROLE_KEY_SET,
} from '../../auth/platform-rbac/platform-rbac.catalog';
import { SALES_MANAGE_GRANTABLE_ROLE_KEYS } from '../platform-sales-representatives.constants';
import { SalesRepForbiddenError, SalesRepValidationError } from '../domain/sales-representative.errors';

/**
 * Frozen grantability rule (contract §7): the sales-manage administration path
 * (`sales-representative.manage`) may ONLY assign `sales_representative`.
 * Every other built-in role — including platform_owner, security_administrator,
 * platform_administrator, operations_engineer, and any role carrying plan publish,
 * entitlement/limit mutation, override grant/revoke, subscription mutation,
 * feature-flag kill-switch, or platform-user/RBAC admin authority — is denied by
 * construction: this allow-list contains exactly one role.
 */
const GRANTABLE_SET = new Set<string>(SALES_MANAGE_GRANTABLE_ROLE_KEYS);

export function isGrantableViaSalesManagePath(roleKey: string): boolean {
  return GRANTABLE_SET.has(roleKey);
}

export function assertGrantableViaSalesManagePath(roleKey: string): void {
  if (!PLATFORM_ROLE_KEY_SET.has(roleKey)) {
    throw new SalesRepValidationError('Unknown platform role.');
  }
  if (!isGrantableViaSalesManagePath(roleKey)) {
    throw new SalesRepForbiddenError(
      `Role "${roleKey}" is not grantable via the sales representative management path.`,
    );
  }
}

/** Dangerous permission fragments that must never reach a role granted through this path. */
const DANGEROUS_PERMISSION_KEYS = [
  'plan.lifecycle',
  'plan-version.publish',
  'plan-version.retire',
  'plan-entitlement.manage',
  'plan-limit.manage',
  'override.approve',
  'override.request',
  'subscription.assign',
  'subscription.migrate',
  'subscription.suspend',
  'subscription.cancel',
  'feature-flag.manage',
  'feature-flag.kill-switch',
  'settings.manage',
  'settings.reference.manage',
  'operations.execute',
  'operations.cache.invalidate',
  'platform-user.role.assign',
  'platform-user.role.remove',
  'platform-user.suspend',
  'platform-user.create',
  'platform-role.assign',
] as const;

/** Defensive check used by tests (S-matrix): confirms no grantable role carries dangerous authority. */
export function roleCarriesDangerousPermission(roleKey: string): boolean {
  const role = getPlatformRole(roleKey);
  if (!role) return false;
  return role.permissionKeys.some((key) => (DANGEROUS_PERMISSION_KEYS as readonly string[]).includes(key));
}

export function assertNoGrantableRoleIsDangerous(): void {
  for (const roleKey of SALES_MANAGE_GRANTABLE_ROLE_KEYS) {
    if (roleCarriesDangerousPermission(roleKey)) {
      throw new Error(`Sales-manage grantable role "${roleKey}" carries a dangerous permission.`);
    }
  }
}

assertNoGrantableRoleIsDangerous();
