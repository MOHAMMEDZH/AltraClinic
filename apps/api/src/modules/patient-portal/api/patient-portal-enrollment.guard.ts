import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PORTAL_ACCOUNT_REPOSITORY } from '../../../infrastructure/provider.tokens';
import { PortalAccountRepository } from '../domain/repositories/portal-account.repository.interface';

/**
 * Phase 46b — enrollment must be complete (ACTIVE + consent) before product surfaces.
 * Applied to existing /me and accounts self routes that must stay closed for incomplete enrollment.
 */
@Injectable()
export class PatientPortalEnrollmentCompleteGuard implements CanActivate {
  constructor(
    @Inject(PORTAL_ACCOUNT_REPOSITORY) private readonly portalRepo: PortalAccountRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: JwtClaimsVO }>();
    const user = request.user;
    if (!user?.sub || !user.tenantId) {
      throw new UnauthorizedException('Authentication required');
    }
    if (user.sessionClass !== 'patient') {
      // Staff admin paths use different guards; reject staff on patient product paths.
      throw new UnauthorizedException({
        code: 'PATIENT_PORTAL_STAFF_SESSION_REJECTED',
        message: 'Staff sessions cannot access patient portal product APIs',
      });
    }
    const account = await this.portalRepo.findByUserId(user.sub, user.tenantId);
    if (!account || !account.isEnrollmentComplete) {
      throw new UnauthorizedException({
        code: 'PATIENT_PORTAL_ENROLLMENT_INCOMPLETE',
        message: 'Patient portal enrollment is incomplete',
      });
    }
    return true;
  }
}
