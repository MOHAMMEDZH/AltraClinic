import type { AppointmentListItem } from '../types/scheduling.types';

export const APPOINTMENT_DRAG_MIME = 'application/x-scheduling-appointment-id';

export function setAppointmentDragData(dataTransfer: DataTransfer, appointmentId: string): void {
  dataTransfer.setData(APPOINTMENT_DRAG_MIME, appointmentId);
  dataTransfer.setData('text/plain', appointmentId);
  dataTransfer.effectAllowed = 'move';
}

export function readAppointmentDragId(dataTransfer: DataTransfer): string {
  return dataTransfer.getData(APPOINTMENT_DRAG_MIME) || dataTransfer.getData('text/plain');
}

export function rescheduleAppointmentToDay(
  appt: AppointmentListItem,
  targetDay: Date,
): { start: string; end: string } {
  const origStart = new Date(appt.start);
  const origEnd = new Date(appt.end);
  const durationMs = Math.max(origEnd.getTime() - origStart.getTime(), 15 * 60_000);

  const newStart = new Date(targetDay);
  newStart.setHours(
    origStart.getHours(),
    origStart.getMinutes(),
    origStart.getSeconds(),
    origStart.getMilliseconds(),
  );

  const newEnd = new Date(newStart.getTime() + durationMs);
  return { start: newStart.toISOString(), end: newEnd.toISOString() };
}

export function isSameCalendarDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}
