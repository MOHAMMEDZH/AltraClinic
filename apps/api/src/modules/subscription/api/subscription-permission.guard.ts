import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { SubscriptionPolicy } from '../policies/subscription-policy.service';
import { requireAuthenticatedPrincipal } from '../../../common/authenticated-principal.util';

interface SubscriptionRequest {
  user?: { id: string; roles: string[] };
}

@Injectable()
export class SubscriptionPermissionGuard implements CanActivate {
  constructor(private readonly policy: SubscriptionPolicy) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<SubscriptionRequest>();
    const { id, roles } = requireAuthenticatedPrincipal(request);

    if (!this.policy.canManageSubscriptions(roles)) {
      throw new ForbiddenException('User does not have permission to access subscriptions');
    }

    request.user = { id, roles };
    return true;
  }
}
