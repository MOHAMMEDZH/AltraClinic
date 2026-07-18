import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { requireAuthenticatedPrincipal } from '../../../common/authenticated-principal.util';
import { requireTenantScope } from '../../../common/tenant-scope.util';
import { AiAccessPolicy } from '../policies/ai-access.policy';

@Injectable()
export class AiAccessGuard implements CanActivate {
  constructor(private readonly policy: AiAccessPolicy) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const principal = requireAuthenticatedPrincipal(req, 'Authentication required to access AI endpoints.');
    requireTenantScope(req);

    if (!this.policy.canAccess(principal.roles ?? [])) {
      throw new ForbiddenException('You do not have permission to access AI resources.');
    }

    req.user = { id: principal.id, userId: principal.id, roles: principal.roles };
    return true;
  }
}
