import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { isPatientPortalCenterEnabled } from '../config/patient-portal-config';
import { PATIENT_PORTAL_ERROR_CODES } from '../patient-portal.constants';

/**
 * Phase 46a — fail-closed product gate.
 * When PATIENT_PORTAL_CENTER_ENABLED is OFF, product controllers are dormant.
 * Foundation health endpoints must NOT use this guard.
 */
@Injectable()
export class PatientPortalCenterEnabledGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    if (!isPatientPortalCenterEnabled()) {
      throw new ServiceUnavailableException({
        statusCode: 503,
        code: PATIENT_PORTAL_ERROR_CODES.DISABLED,
        message: 'Patient Portal is not available',
        error: 'Service Unavailable',
      });
    }
    return true;
  }
}
