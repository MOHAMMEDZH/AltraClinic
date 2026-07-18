import { describe, expect, it, vi } from 'vitest';
import { logImportExportUiEvent } from '../lib/ui-events';
import { filterJobsClientSide } from '../lib/job-filters';
import type { ImportExportJob } from '../api/import-export-api';

describe('import-export ui events', () => {
  it('logs structured UI events without throwing', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    logImportExportUiEvent('page_opened', { page: 'catalog' });
    expect(spy).toHaveBeenCalled();
    const payload = JSON.parse(String(spy.mock.calls[0][0]));
    expect(payload.kind).toBe('import_export_ui');
    expect(payload.event).toBe('page_opened');
    spy.mockRestore();
  });
});

describe('job filter helpers', () => {
  const jobs = [
    {
      id: '1',
      typeId: 'users-export',
      status: 'running',
      direction: 'export',
      correlationId: 'abc',
    },
    {
      id: '2',
      typeId: 'users-import',
      status: 'completed',
      direction: 'import',
      correlationId: 'xyz',
    },
  ] as unknown as ImportExportJob[];

  it('filters by bucket and search without business rules', () => {
    expect(filterJobsClientSide(jobs, { filter: 'running' })).toHaveLength(1);
    expect(filterJobsClientSide(jobs, { search: 'import' })).toHaveLength(1);
    expect(filterJobsClientSide(jobs, { search: 'abc' })).toHaveLength(1);
  });
});
