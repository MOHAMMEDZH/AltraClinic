import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuditPolicy } from '../policies/audit-policy.service';
import { requireAuthenticatedPrincipal } from '../../../common/authenticated-principal.util';

interface AuditRequest {
  user?: { id: string; roles: string[] };
}

@Injectable()
export class AuditPermissionGuard implements CanActivate {
  constructor(private readonly policy: AuditPolicy) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuditRequest>();
    const { id, roles } = requireAuthenticatedPrincipal(
      request,
      'Audit access requires authenticated user and roles.',
    );

    if (!this.policy.canAccessAudit(roles)) {
      throw new ForbiddenException('User does not have permission to access audit logs.');
    }

    request.user = { id, roles };
    return true;
  }
}
