import { describe, expect, it } from 'vitest';
import {
  fetchImportExportCatalog,
  listImportExportJobs,
  createExportSession,
} from '../api/import-export-api';

describe('import-export-api surface', () => {
  it('exports operational API helpers', () => {
    expect(typeof fetchImportExportCatalog).toBe('function');
    expect(typeof listImportExportJobs).toBe('function');
    expect(typeof createExportSession).toBe('function');
  });
});
