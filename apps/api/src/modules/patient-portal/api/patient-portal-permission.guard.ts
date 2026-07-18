import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PatientPortalPolicy } from '../policies/patient-portal-policy.service';
import { requireAuthenticatedPrincipal } from '../../../common/authenticated-principal.util';

interface PortalRequest {
  user?: { id: string; roles: string[]; tenantId?: string };
}

const PORTAL_ROLES = ['admin', 'tenant_admin', 'clinic_manager', 'receptionist', 'patient'];

/**
 * Coarse-grained authentication/authorization gate for the Patient Portal API.
 *
 * It guarantees an authenticated principal carrying at least one portal-relevant
 * role; fine-grained command/query authorization (enrollment vs. governance vs.
 * patient self-service ownership) is enforced in the handlers via
 * {@link PatientPortalPolicy} and ABAC ownership checks.
 *
 * NOTE: identity/roles must originate from a verified token upstream and be
 * attached to `request.user` by the authentication middleware/guard.
 */
@Injectable()
export class PatientPortalPermissionGuard implements CanActivate {
  constructor(private readonly policy: PatientPortalPolicy) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<PortalRequest>();
    const { id, roles } = requireAuthenticatedPrincipal(request);

    const hasPortalRole = roles.some((role) => PORTAL_ROLES.includes(role));
    if (!hasPortalRole) {
      throw new ForbiddenException('User does not have access to the patient portal');
    }

    request.user = { id, roles };
    return true;
  }
}
