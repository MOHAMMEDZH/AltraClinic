import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthSessionClass } from '../../auth/domain/value-objects/jwt-claims.vo';

interface PortalRequestUser {
  sub?: string;
  tenantId?: string;
  sessionId?: string;
  sessionClass?: AuthSessionClass;
}

/**
 * Phase 46b — requires patient session class (rejects staff JWTs).
 */
@Injectable()
export class PatientPortalSessionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: PortalRequestUser }>();
    const user = request.user;
    if (!user?.sessionClass) {
      throw new UnauthorizedException('Patient portal session required');
    }
    if (user.sessionClass !== 'patient') {
      throw new UnauthorizedException({
        code: 'PATIENT_PORTAL_SESSION_REJECTED',
        message: 'Only patient portal sessions can access patient portal identity APIs',
      });
    }
    return true;
  }
}
