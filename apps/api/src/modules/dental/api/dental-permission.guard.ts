import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { requireAuthenticatedPrincipal } from '../../../common/authenticated-principal.util';
import { requireTenantScope } from '../../../common/tenant-scope.util';
import { DentalPolicyService } from '../policies/dental-policy.service';

@Injectable()
export class DentalPermissionGuard implements CanActivate {
  constructor(private readonly policy: DentalPolicyService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const principal = requireAuthenticatedPrincipal(req, 'Authentication is required for dental endpoints.');
    const scope = requireTenantScope(req);

    return this.policy.canViewChart(principal, scope.tenantId);
  }
}
