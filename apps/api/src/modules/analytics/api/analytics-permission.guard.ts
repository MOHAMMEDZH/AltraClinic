import { Injectable, CanActivate, ExecutionContext, ForbiddenException, BadRequestException } from '@nestjs/common';
import { requireAuthenticatedPrincipal } from '../../../common/authenticated-principal.util';
import { AnalyticsPolicy } from '../policies/analytics-policy.service';

/**
 * Analytics Permission Guard
 * Validates authorization for analytics operations
 * Follows consistent patterns from other domain guards
 */
@Injectable()
export class AnalyticsPermissionGuard implements CanActivate {
  constructor(private readonly policy: AnalyticsPolicy) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Step 1: Validate tenant context from headers
    const tenantIdHeader = request.headers['x-tenant-id'] ?? request.headers['tenant-id'];
    const tenantId = String(tenantIdHeader ?? '').trim();
    if (!tenantId) {
      throw new BadRequestException('Tenant ID (x-tenant-id or tenant-id header) is required');
    }

    // Step 2: Validate user context (JWT claims use `sub`, not `id`)
    const principal = requireAuthenticatedPrincipal(
      request,
      'User context missing or invalid',
    );

    const userTenantId = String(
      (request.user as { tenantId?: unknown } | undefined)?.tenantId ?? '',
    ).trim();
    if (userTenantId && userTenantId !== tenantId) {
      throw new ForbiddenException('Tenant mismatch between authenticated user and tenant header');
    }

    const userRoles = principal.roles;
    if (!this.policy.canViewMetrics(userRoles)) {
      throw new ForbiddenException('User does not have permission to access analytics');
    }

    // Step 4: Attach normalized context for handlers
    request.analyticsContext = {
      tenantId,
      userId: principal.id,
      userRoles,
      userTenantId: userTenantId || undefined,
      userBranchId:
        String((request.user as { branchId?: unknown } | undefined)?.branchId ?? '').trim() ||
        undefined,
    };

    return true;
  }
}
