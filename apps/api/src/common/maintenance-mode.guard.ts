import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../modules/auth/api/decorators/public.decorator';
import { SKIP_MAINTENANCE_KEY } from './decorators/skip-maintenance.decorator';
import { TenantPolicyService } from '../modules/settings/application/services/tenant-policy.service';

const ADMIN_ROLES = new Set(['owner', 'super_admin', 'general_manager']);

@Injectable()
export class MaintenanceModeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantPolicy: TenantPolicyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_MAINTENANCE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const request = context.switchToHttp().getRequest<{
      user?: { roles?: string[]; tenantId?: string };
      headers?: Record<string, string | string[] | undefined>;
    }>();

    const tenantId =
      request.user?.tenantId ??
      (typeof request.headers?.['x-tenant-id'] === 'string' ? request.headers['x-tenant-id'] : undefined);

    if (!tenantId) return true;

    const maintenance = await this.tenantPolicy.isMaintenanceMode(tenantId);
    if (!maintenance) return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const roles = request.user?.roles ?? [];
    if (roles.some((role) => ADMIN_ROLES.has(role))) return true;

    throw new ServiceUnavailableException({
      statusCode: 503,
      error: 'Service Unavailable',
      message: 'The clinic is in maintenance mode.',
      code: 'MAINTENANCE_MODE',
    });
  }
}
