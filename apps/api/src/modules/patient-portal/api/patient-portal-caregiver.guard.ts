import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { isPatientPortalCaregiverEnabled } from '../config/patient-portal-config';
import { PATIENT_PORTAL_ERROR_CODES } from '../patient-portal.constants';

/**
 * Phase 46d — fail-closed caregiver sub-flag gate.
 */
@Injectable()
export class PatientPortalCaregiverEnabledGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    if (!isPatientPortalCaregiverEnabled()) {
      throw new ServiceUnavailableException({
        statusCode: 503,
        code: PATIENT_PORTAL_ERROR_CODES.CAREGIVER_DISABLED,
        message: 'Patient Portal caregiver access is not available',
        error: 'Service Unavailable',
      });
    }
    return true;
  }
}
