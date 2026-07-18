import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { JwtClaimsVO } from '../../domain/value-objects/jwt-claims.vo';
import { UserRole } from '../../../identity/domain/user.entity';

/**
 * Role-based access guard. Reads required roles from @Roles() decorator.
 * super_admin always bypasses role checks.
 *
 * COMPETING ARCHITECT:
 *   Challenger: "Role inheritance should be a DB-driven hierarchy, not hard-coded."
 *   Decision: For Phase 1, the inheritance map is a small in-memory constant.
 *   With 12 roles and shallow hierarchies it's stable and testable without DB.
 *   Phase 2: move to a TenantRoleHierarchy domain service if role inheritance
 *   needs to be tenant-configurable.
 */
const ROLE_HIERARCHY: Partial<Record<UserRole, UserRole[]>> = {
  super_admin: ['owner', 'general_manager', 'doctor', 'dentist', 'specialist',
    'nurse', 'assistant', 'receptionist', 'accountant', 'inventory_manager', 'patient'],
  owner: ['general_manager', 'doctor', 'dentist', 'specialist', 'nurse',
    'assistant', 'receptionist', 'accountant', 'inventory_manager', 'patient'],
  general_manager: ['doctor', 'dentist', 'specialist', 'nurse', 'assistant',
    'receptionist', 'accountant', 'inventory_manager'],
};

function expandRoles(roles: UserRole[]): Set<UserRole> {
  const expanded = new Set<UserRole>(roles);
  for (const role of roles) {
    const inherited = ROLE_HIERARCHY[role] ?? [];
    for (const r of inherited) expanded.add(r);
  }
  return expanded;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest().user as JwtClaimsVO | undefined;
    if (!user) throw new ForbiddenException('Authentication context missing.');

    const effectiveRoles = expandRoles(user.roles);
    const hasRole = required.some((r) => effectiveRoles.has(r));

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Required roles: [${required.join(', ')}].`,
      );
    }

    return true;
  }
}
