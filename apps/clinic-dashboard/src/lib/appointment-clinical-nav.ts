/** Query params for appointment → clinical navigation context preservation. */
import type { BeautyWorkspaceTab } from '@/features/beauty/types/beauty.types';

export type { BeautyWorkspaceTab };

export const APPOINTMENT_CTX = {
  FROM: 'from',
  SOURCE: 'appointment',
  APPOINTMENT_ID: 'appointmentId',
  RETURN_TO: 'returnTo',
  TAB: 'tab',
} as const;

export interface AppointmentNavContext {
  from?: string;
  appointmentId?: string;
  returnTo?: string;
  tab?: string;
}

export function parseAppointmentContext(searchParams: URLSearchParams): AppointmentNavContext {
  return {
    from: searchParams.get(APPOINTMENT_CTX.FROM) ?? undefined,
    appointmentId: searchParams.get(APPOINTMENT_CTX.APPOINTMENT_ID) ?? undefined,
    returnTo: searchParams.get(APPOINTMENT_CTX.RETURN_TO) ?? undefined,
    tab: searchParams.get(APPOINTMENT_CTX.TAB) ?? undefined,
  };
}

export function isFromAppointment(ctx: AppointmentNavContext): boolean {
  return ctx.from === APPOINTMENT_CTX.SOURCE && Boolean(ctx.appointmentId);
}

export function appointmentsReturnUrl(appointmentId: string): string {
  return `/appointments?selected=${encodeURIComponent(appointmentId)}`;
}

export function buildAppointmentContextQuery(
  appointmentId: string,
  options?: { returnTo?: string; tab?: string },
): string {
  const sp = new URLSearchParams({
    [APPOINTMENT_CTX.FROM]: APPOINTMENT_CTX.SOURCE,
    [APPOINTMENT_CTX.APPOINTMENT_ID]: appointmentId,
  });
  if (options?.returnTo) sp.set(APPOINTMENT_CTX.RETURN_TO, options.returnTo);
  if (options?.tab) sp.set(APPOINTMENT_CTX.TAB, options.tab);
  return sp.toString();
}

export function patientProfileFromAppointment(patientId: string, appointmentId: string): string {
  return `/patients/${patientId}?${buildAppointmentContextQuery(appointmentId, {
    returnTo: appointmentsReturnUrl(appointmentId),
  })}`;
}

export type ClinicalNavTarget = 'patient' | 'chart' | 'plan' | 'notes' | 'beauty';

export type DentalChartTab =
  | 'summary'
  | 'procedures'
  | 'treatment'
  | 'perio'
  | 'imaging'
  | 'materials'
  | 'ortho'
  | 'implants'
  | 'notes'
  | 'timeline';

export function dentalChartFromAppointment(
  patientId: string,
  appointmentId: string,
  tab?: DentalChartTab,
): string {
  return `/dental/chart/${patientId}?${buildAppointmentContextQuery(appointmentId, {
    returnTo: appointmentsReturnUrl(appointmentId),
    tab,
  })}`;
}

export function treatmentPlanFromAppointment(
  patientId: string,
  appointmentId: string,
  planId: string = 'active',
): string {
  return `/dental/chart/${patientId}/plan/${planId}?${buildAppointmentContextQuery(appointmentId, {
    returnTo: appointmentsReturnUrl(appointmentId),
  })}`;
}

export function clinicalNotesFromAppointment(
  _patientId: string,
  appointmentId: string,
  encounterId: string,
): string {
  return `/encounters/${encounterId}?${buildAppointmentContextQuery(appointmentId, {
    returnTo: appointmentsReturnUrl(appointmentId),
    tab: 'notes',
  })}`;
}

export function beautyWorkspaceFromAppointment(
  patientId: string,
  appointmentId: string,
  tab?: BeautyWorkspaceTab,
): string {
  return `/beauty/workspace/${patientId}?${buildAppointmentContextQuery(appointmentId, {
    returnTo: appointmentsReturnUrl(appointmentId),
    tab,
  })}`;
}
