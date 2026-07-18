import { Appointment } from '../domain/appointment.entity';
import { AppointmentStatus } from '../domain/appointment-status.enum';
import { TimeSlotVO } from '../domain/timeslot.vo';

const SLOT = new TimeSlotVO('2026-06-15T09:00:00.000Z', '2026-06-15T09:30:00.000Z');

function makeAppointment(status = AppointmentStatus.Confirmed): Appointment {
  return new Appointment(
    'appt-1',
    'tenant-1',
    'branch-1',
    'patient-1',
    'provider-1',
    SLOT,
    status,
  );
}

describe('Appointment entity lifecycle', () => {
  it('transitions to checked_in', () => {
    const appt = makeAppointment();
    appt.checkIn();
    expect(appt.status).toBe(AppointmentStatus.CheckedIn);
    expect(appt.updatedAt).toBeInstanceOf(Date);
  });

  it('transitions to in_progress', () => {
    const appt = makeAppointment();
    appt.startVisit();
    expect(appt.status).toBe(AppointmentStatus.InProgress);
  });

  it('does not check in cancelled appointments', () => {
    const appt = makeAppointment(AppointmentStatus.Cancelled);
    appt.checkIn();
    expect(appt.status).toBe(AppointmentStatus.Cancelled);
  });

  it('reschedules slot', () => {
    const appt = makeAppointment();
    const next = new TimeSlotVO('2026-06-16T10:00:00.000Z', '2026-06-16T10:30:00.000Z');
    appt.reschedule(next);
    expect(appt.slot.start).toBe(next.start);
  });
});
