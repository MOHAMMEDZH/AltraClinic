import type { ImportExportJob } from '../api/import-export-api';

/** Presentation-only filtering for dashboard UX (backend remains source of truth). */
export function filterJobsClientSide(
  jobs: ImportExportJob[],
  options: { filter?: string; search?: string } = {},
): ImportExportJob[] {
  let list = [...jobs];
  const filter = options.filter ?? 'all';
  if (filter === 'running') {
    list = list.filter((j) => ['queued', 'running', 'retrying', 'draft'].includes(j.status));
  } else if (filter === 'completed') {
    list = list.filter((j) => ['completed', 'completed_with_warnings'].includes(j.status));
  } else if (filter === 'failed') {
    list = list.filter((j) => ['failed', 'dead_letter', 'expired', 'cancelled'].includes(j.status));
  }
  if (options.search?.trim()) {
    const q = options.search.trim().toLowerCase();
    list = list.filter(
      (j) =>
        j.id.toLowerCase().includes(q) ||
        j.typeId.toLowerCase().includes(q) ||
        j.correlationId.toLowerCase().includes(q) ||
        j.status.toLowerCase().includes(q),
    );
  }
  return list;
}
