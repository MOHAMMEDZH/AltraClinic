import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { requireAuthenticatedPrincipal } from '../../../common/authenticated-principal.util';
import { requireTenantScope } from '../../../common/tenant-scope.util';
import { BillingPolicyService } from '../policies/billing-policy.service';

@Injectable()
export class BillingPermissionGuard implements CanActivate {
  constructor(private readonly policy: BillingPolicyService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const principal = requireAuthenticatedPrincipal(req, 'Authentication required to access billing endpoints.');
    requireTenantScope(req);

    const allowed = this.policy.canAccess(principal, req);
    if (!allowed) {
      throw new ForbiddenException('You do not have permission to access billing resources.');
    }

    return true;
  }
}
