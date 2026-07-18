import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { requireAuthenticatedPrincipal } from '../../../common/authenticated-principal.util';
import { requireTenantScope } from '../../../common/tenant-scope.util';
import { BeautyPolicyService } from '../policies/beauty-policy.service';

@Injectable()
export class BeautyPermissionGuard implements CanActivate {
  constructor(private readonly policy: BeautyPolicyService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const principal = requireAuthenticatedPrincipal(req, 'Authentication is required for beauty endpoints.');
    requireTenantScope(req);

    return this.policy.canAccess(principal, req);
  }
}
