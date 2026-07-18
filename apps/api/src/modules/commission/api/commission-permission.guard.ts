import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { requireAuthenticatedPrincipal } from '../../../common/authenticated-principal.util';
import { requireTenantScope } from '../../../common/tenant-scope.util';
import { CommissionPolicyService } from '../policies/commission-policy.service';

@Injectable()
export class CommissionPermissionGuard implements CanActivate {
  constructor(private readonly policy: CommissionPolicyService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const principal = requireAuthenticatedPrincipal(req, 'Authentication required to access commission endpoints.');
    requireTenantScope(req);

    const allowed = this.policy.canAccess(principal, req);
    if (!allowed) {
      throw new ForbiddenException('You do not have permission to access commission resources.');
    }

    return true;
  }
}
