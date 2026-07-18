import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InventoryPolicyService } from '../policies/inventory-policy.service';

@Injectable()
export class InventoryPermissionGuard implements CanActivate {
  constructor(private readonly policy: InventoryPolicyService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user ?? null;
    if (!user) {
      throw new UnauthorizedException('Authentication required to access inventory endpoints.');
    }

    const allowed = this.policy.canAccess(user, req);
    if (!allowed) {
      throw new ForbiddenException('You do not have permission to access inventory resources.');
    }

    return true;
  }
}
