import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { requireAuthenticatedPrincipal } from './authenticated-principal.util';
import { requireRegionScope } from './region-scope.util';
import { requireTenantScope } from './tenant-scope.util';
import { PrismaService } from '../infrastructure/prisma.service';

@Injectable()
export class TenantScopedAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    requireAuthenticatedPrincipal(request, 'Authenticated user and roles are required');
    const scope = requireTenantScope(request);
    await requireRegionScope(this.prisma, request, scope.tenantId, scope.branchId);

    return true;
  }
}
