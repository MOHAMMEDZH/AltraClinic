import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { requireAuthenticatedPrincipal } from '../../../common/authenticated-principal.util';
import { requireTenantScope } from '../../../common/tenant-scope.util';
import { WorkflowPolicy } from '../policies/workflow-policy.service';

@Injectable()
export class WorkflowPermissionGuard implements CanActivate {
  constructor(private readonly policy: WorkflowPolicy) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const principal = requireAuthenticatedPrincipal(req, 'Authentication required to access workflow endpoints.');
    requireTenantScope(req);

    if (!this.policy.canAccess(principal, req)) {
      throw new ForbiddenException('You do not have permission to access workflow resources.');
    }

    req.user = { id: principal.id, userId: principal.id, roles: principal.roles };
    return true;
  }
}
