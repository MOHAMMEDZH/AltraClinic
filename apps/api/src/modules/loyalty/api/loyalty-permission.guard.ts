import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { LoyaltyPolicyService } from '../policies/loyalty-policy.service';

@Injectable()
export class LoyaltyPermissionGuard implements CanActivate {
  constructor(private readonly policy: LoyaltyPolicyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user ?? null;
    if (!user) {
      throw new UnauthorizedException('Authentication required to access loyalty endpoints.');
    }

    const tenantId = String(req.headers?.['x-tenant-id'] ?? req.headers?.['tenant-id'] ?? '').trim() || undefined;
    const allowed = await this.policy.canAccess(user, req, tenantId);
    if (!allowed) {
      throw new ForbiddenException('You do not have permission to access loyalty resources.');
    }

    return true;
  }
}
