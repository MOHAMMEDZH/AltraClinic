import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtClaimsVO } from '../../domain/value-objects/jwt-claims.vo';
import { UserRole } from '../../../identity/domain/user.entity';
import { PermissionAction } from '../../../../common/authorization/permission-matrix.validation';
import { PrismaService } from '../../../../infrastructure/prisma.service';

export interface RequiredPermission {
  resource: string;
  action: PermissionAction;
}

export const PERMISSION_KEY = 'required_permission';
export const RequirePermission = (resource: string, action: PermissionAction) =>
  SetMetadata(PERMISSION_KEY, { resource, action } as RequiredPermission);

export function expandRoles(roles: string[], matrix: { roles?: Array<{ key: string; inherits?: string[] }> }): string[] {
  const result = new Set(roles);
  let changed = true;
  while (changed) {
    changed = false;
    for (const role of [...result]) {
      const def = matrix.roles?.find((r) => r.key === role);
      for (const inherited of def?.inherits ?? []) {
        if (!result.has(inherited)) {
          result.add(inherited);
          changed = true;
        }
      }
    }
  }
  return [...result];
}

/**
 * Frozen PatientFormInstance sign/void is clinical staff only
 * (`docs/PHASE_48_TARGET_DOMAIN_ARCHITECTURE.md` ownership matrix).
 * Generic super_admin bypass and custom-role grants must not grant consent lifecycle.
 */
export const SUPER_ADMIN_BYPASS_EXCLUSIONS: Array<{ resource: string; action: PermissionAction }> = [
  { resource: 'api.clinical-forms', action: 'approve' },
];

/** Same protected-action set: custom roles cannot grant clinical sign/void. */
export const CUSTOM_ROLE_GRANT_EXCLUSIONS = SUPER_ADMIN_BYPASS_EXCLUSIONS;

function isProtectedPermission(resource: string, action: PermissionAction): boolean {
  return SUPER_ADMIN_BYPASS_EXCLUSIONS.some((ex) => ex.resource === resource && ex.action === action);
}

function superAdminBypassApplies(resource: string, action: PermissionAction): boolean {
  return !isProtectedPermission(resource, action);
}

export function customRoleGrantsApply(resource: string, action: PermissionAction): boolean {
  return !isProtectedPermission(resource, action);
}

/** Role-matrix check used by guards and by PHI/report gating (does not invent permissions). */
export function rolesGrantPermission(roles: string[], resource: string, action: PermissionAction): boolean {
  if (roles.includes('super_admin' as UserRole) && superAdminBypassApplies(resource, action)) return true;
  const matrix = PermissionGuard.peekMatrix();
  if (!matrix) return false;
  const def = matrix.resources.find((r: { id: string }) => r.id === resource);
  if (!def) return false;
  const effectiveRoles = expandRoles(roles, matrix);
  const allowedRoles: string[] = def.permissions[action] ?? [];
  return effectiveRoles.some((role) => allowedRoles.includes(role));
}

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<RequiredPermission | undefined>(
      PERMISSION_KEY, [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const user = context.switchToHttp().getRequest().user as JwtClaimsVO | undefined;
    if (!user) throw new ForbiddenException('Authentication required.');

    // Platform principals never use the legacy super_admin permission bypass (Step 06/08).
    if (user.isPlatformSession()) {
      throw new ForbiddenException(
        'Platform RBAC is not available on this route. Use platform-auth endpoints.',
      );
    }

    const matrix = PermissionGuard.peekMatrix();
    if (!matrix) {
      throw new ForbiddenException('Permission matrix unavailable. Access denied.');
    }
    const resource = matrix.resources.find((r: { id: string }) => r.id === required.resource);
    if (!resource) {
      throw new ForbiddenException(`Unknown resource '${required.resource}'. Permission denied.`);
    }

    if (rolesGrantPermission(user.roles, required.resource, required.action)) return true;

    if (customRoleGrantsApply(required.resource, required.action)) {
      const customGrants = await this.loadCustomRoleGrants(user.sub, user.tenantId ?? '');
      const hasCustom = customGrants.some((grant) => (grant[required.resource] ?? []).includes(required.action));
      if (hasCustom) return true;
    }

    throw new ForbiddenException(`Permission denied: ${required.action} on ${required.resource}.`);
  }

  private async loadCustomRoleGrants(userId: string, tenantId: string): Promise<Array<Record<string, string[]>>> {
    const rows = await this.prisma.userCustomRole.findMany({
      where: { userId, tenantId },
      include: { customRole: { select: { permissions: true, isArchived: true } } },
    });
    return rows
      .filter((r) => !r.customRole.isArchived)
      .map((r) => r.customRole.permissions as Record<string, string[]>);
  }

  private static cachedMatrix: ReturnType<typeof JSON.parse> | null = null;

  static peekMatrix() {
    return PermissionGuard.getMatrix();
  }

  private static getMatrix() {
    if (PermissionGuard.cachedMatrix !== null) return PermissionGuard.cachedMatrix;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const matrix = require('../../../../../config/permission-matrix.json');
      PermissionGuard.cachedMatrix = matrix;
      return matrix;
    } catch {
      PermissionGuard.cachedMatrix = null;
      return null;
    }
  }
}
