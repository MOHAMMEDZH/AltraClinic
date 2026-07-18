import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PlatformAdminPolicy } from '../policies/platform-admin-policy.service';
import { requireAuthenticatedPrincipal } from '../../../common/authenticated-principal.util';

interface PlatformAdminRequest {
  user?: { id: string; roles: string[] };
}

/**
 * Authentication/authorization gate for the Super Admin Platform API.
 *
 * It guarantees an authenticated principal that holds the platform-level System
 * Administrator role — the ONLY role permitted to reach the cross-tenant control
 * plane. Fine-grained per-operation authorization (lifecycle vs. archive vs.
 * privileged-access review) and the separation-of-duties invariant are enforced
 * downstream in the handlers/domain.
 *
 * NOTE: identity/roles must originate from a verified token upstream and be
 * attached to `request.user`. Because this is the highest-privilege surface,
 * production MUST additionally enforce step-up/MFA and just-in-time elevation
 * before this guard is reached.
 */
@Injectable()
export class PlatformAdminPermissionGuard implements CanActivate {
  constructor(private readonly policy: PlatformAdminPolicy) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<PlatformAdminRequest>();
    const { id, roles } = requireAuthenticatedPrincipal(request);

    if (!this.policy.canViewPlatform(roles)) {
      throw new ForbiddenException('User does not have access to the Super Admin Platform');
    }

    request.user = { id, roles };
    return true;
  }
}
