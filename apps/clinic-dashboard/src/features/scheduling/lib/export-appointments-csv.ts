import type { AppointmentListItem } from '../types/scheduling.types';
import { formatProviderLabel } from '../config/scheduling-config';

export function downloadAppointmentsCsv(
  items: AppointmentListItem[],
  filename = 'appointments.csv',
): void {
  const header = ['Patient', 'Provider', 'Start', 'End', 'Status', 'Notes'];
  const rows = items.map((a) => [
    a.patientName,
    formatProviderLabel(a.providerId),
    a.start,
    a.end,
    a.status,
    a.notes ?? '',
  ]);
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map((row) => row.map(escape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
