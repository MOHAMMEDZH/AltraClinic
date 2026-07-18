import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AiPolicy } from '../policies/ai-policy.service';
import { requireAuthenticatedPrincipal } from '../../../common/authenticated-principal.util';

interface AiRequest {
  user?: { id: string; roles: string[]; tenantId?: string };
}

@Injectable()
export class AiPermissionGuard implements CanActivate {
  constructor(private readonly policy: AiPolicy) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AiRequest>();
    const { id, roles } = requireAuthenticatedPrincipal(request);

    if (!this.policy.canManageModels(roles)) {
      throw new ForbiddenException('User does not have permission to manage AI models');
    }

    request.user = { id, roles };
    return true;
  }
}
