import { describe, expect, it } from 'vitest';
import {
  APPOINTMENT_CTX,
  appointmentsReturnUrl,
  buildAppointmentContextQuery,
  clinicalNotesFromAppointment,
  dentalChartFromAppointment,
  isFromAppointment,
  parseAppointmentContext,
  patientProfileFromAppointment,
  treatmentPlanFromAppointment,
} from '@/lib/appointment-clinical-nav';

describe('appointment-clinical-nav', () => {
  const appointmentId = 'a2000000-0000-4000-8000-000000000001';
  const patientId = 'b1000000-0000-4000-8000-000000000001';
  const encounterId = 'e3000000-0000-4000-8000-000000000001';

  it('parses appointment context from search params', () => {
    const sp = new URLSearchParams(
      `${APPOINTMENT_CTX.FROM}=${APPOINTMENT_CTX.SOURCE}&${APPOINTMENT_CTX.APPOINTMENT_ID}=${appointmentId}&${APPOINTMENT_CTX.RETURN_TO}=/appointments&${APPOINTMENT_CTX.TAB}=notes`,
    );
    expect(parseAppointmentContext(sp)).toEqual({
      from: 'appointment',
      appointmentId,
      returnTo: '/appointments',
      tab: 'notes',
    });
  });

  it('detects appointment-origin navigation', () => {
    expect(isFromAppointment({ from: 'appointment', appointmentId })).toBe(true);
    expect(isFromAppointment({ from: 'appointment' })).toBe(false);
    expect(isFromAppointment({ appointmentId })).toBe(false);
  });

  it('builds return URL with selected appointment', () => {
    expect(appointmentsReturnUrl(appointmentId)).toBe(
      `/appointments?selected=${encodeURIComponent(appointmentId)}`,
    );
  });

  it('builds contextual clinical destinations', () => {
    const ctx = buildAppointmentContextQuery(appointmentId, {
      returnTo: appointmentsReturnUrl(appointmentId),
      tab: 'treatment',
    });
    expect(patientProfileFromAppointment(patientId, appointmentId)).toContain(`/patients/${patientId}?`);
    expect(patientProfileFromAppointment(patientId, appointmentId)).toContain(appointmentId);
    expect(dentalChartFromAppointment(patientId, appointmentId, 'treatment')).toContain(
      `/dental/chart/${patientId}?`,
    );
    expect(dentalChartFromAppointment(patientId, appointmentId, 'treatment')).toContain(`${APPOINTMENT_CTX.TAB}=treatment`);
    expect(treatmentPlanFromAppointment(patientId, appointmentId, 'active')).toContain(
      `/dental/chart/${patientId}/plan/active?`,
    );
    expect(clinicalNotesFromAppointment(patientId, appointmentId, encounterId)).toContain(
      `/encounters/${encounterId}?`,
    );
    expect(clinicalNotesFromAppointment(patientId, appointmentId, encounterId)).toContain(`${APPOINTMENT_CTX.TAB}=notes`);
    expect(ctx).toContain(`${APPOINTMENT_CTX.RETURN_TO}=`);
  });
});
