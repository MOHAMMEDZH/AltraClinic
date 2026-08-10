import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PATIENT_PORTAL_ERROR_CODES } from '../patient-portal.constants';
import { buildPatientPortalSafeError } from '../api/patient-portal-safe-errors';

/**
 * Maps Scheduling / Nest exceptions into patient-safe portal error bodies.
 */
export function mapSchedulingErrorToPortal(error: unknown, correlationId?: string | null): never {
  if (error instanceof HttpException) {
    const status = error.getStatus();
    const response = error.getResponse();
    const rawMessage =
      typeof response === 'string'
        ? response
        : typeof response === 'object' && response && 'message' in response
          ? String((response as { message?: unknown }).message ?? '')
          : error.message;
    const lower = rawMessage.toLowerCase();

    if (status === 404 || error instanceof NotFoundException) {
      throw new NotFoundException(
        buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.APPOINTMENT_NOT_FOUND, correlationId),
      );
    }
    if (status === 403 || error instanceof ForbiddenException) {
      throw new ForbiddenException(
        buildPatientPortalSafeError(
          PATIENT_PORTAL_ERROR_CODES.APPOINTMENT_ACCESS_DENIED,
          correlationId,
        ),
      );
    }
    if (status === 409 || error instanceof ConflictException) {
      if (lower.includes('slot') || lower.includes('not available') || lower.includes('conflict')) {
        throw new ConflictException(
          buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.SLOT_UNAVAILABLE, correlationId),
        );
      }
      if (lower.includes('stale') || lower.includes('changed')) {
        throw new ConflictException(
          buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.STALE_APPOINTMENT, correlationId),
        );
      }
      throw new ConflictException(
        buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.SLOT_UNAVAILABLE, correlationId),
      );
    }
    if (status === 400 || error instanceof BadRequestException) {
      if (lower.includes('cancel')) {
        throw new BadRequestException(
          buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.CANCEL_NOT_PERMITTED, correlationId),
        );
      }
      if (lower.includes('reschedule') || lower.includes('start') || lower.includes('end')) {
        throw new BadRequestException(
          buildPatientPortalSafeError(
            PATIENT_PORTAL_ERROR_CODES.RESCHEDULE_NOT_PERMITTED,
            correlationId,
          ),
        );
      }
      throw new BadRequestException(
        buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.BOOKING_NOT_PERMITTED, correlationId),
      );
    }
    if (status >= 500) {
      throw new ServiceUnavailableException(
        buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.SCHEDULING_UNAVAILABLE, correlationId),
      );
    }
  }

  throw new ServiceUnavailableException(
    buildPatientPortalSafeError(PATIENT_PORTAL_ERROR_CODES.SCHEDULING_UNAVAILABLE, correlationId),
  );
}
