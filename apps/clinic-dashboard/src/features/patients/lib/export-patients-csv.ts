import type { PatientListItem } from '../types';
import type { ListColumnId } from '../config/patients-config';
import { triggerBrowserDownload } from '@/lib/download-file';

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function downloadPatientsCsv(
  items: PatientListItem[],
  columns: ListColumnId[],
  columnLabels: Record<ListColumnId, string>,
  filename: string,
  formatCell: (item: PatientListItem, column: ListColumnId) => string,
): void {
  const header = columns.map((col) => escapeCsv(columnLabels[col])).join(',');
  const rows = items.map((item) =>
    columns.map((col) => escapeCsv(formatCell(item, col))).join(','),
  );
  const csv = `\uFEFF${[header, ...rows].join('\r\n')}`;
  triggerBrowserDownload(
    new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    filename,
  );
}
