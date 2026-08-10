import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { isPatientPortalAppointmentsEnabled } from '../config/patient-portal-config';
import { PATIENT_PORTAL_ERROR_CODES } from '../patient-portal.constants';

/**
 * Phase 46c — fail-closed appointments sub-flag gate.
 * Requires PATIENT_PORTAL_CENTER_ENABLED and PATIENT_PORTAL_APPOINTMENTS_ENABLED.
 */
@Injectable()
export class PatientPortalAppointmentsEnabledGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    if (!isPatientPortalAppointmentsEnabled()) {
      throw new ServiceUnavailableException({
        statusCode: 503,
        code: PATIENT_PORTAL_ERROR_CODES.APPOINTMENTS_DISABLED,
        message: 'Patient Portal appointments are not available',
        error: 'Service Unavailable',
      });
    }
    return true;
  }
}
