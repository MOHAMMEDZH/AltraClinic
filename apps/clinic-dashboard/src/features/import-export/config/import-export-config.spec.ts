import { describe, expect, it } from 'vitest';
import {
  canCreateImport,
  canExportData,
  canManageImportExport,
  canViewImportExport,
  formatBytes,
  isLiveJobStatus,
} from '../config/import-export-config';

describe('import-export-config', () => {
  it('gates RBAC helpers by role matrix', () => {
    expect(canViewImportExport(['owner'])).toBe(true);
    expect(canCreateImport(['owner'])).toBe(true);
    expect(canExportData(['owner'])).toBe(true);
    expect(canManageImportExport(['owner'])).toBe(true);
    expect(canViewImportExport(['receptionist'])).toBe(false);
    expect(canExportData(['receptionist'])).toBe(false);
  });

  it('identifies live job statuses for polling', () => {
    expect(isLiveJobStatus('queued')).toBe(true);
    expect(isLiveJobStatus('running')).toBe(true);
    expect(isLiveJobStatus('completed')).toBe(false);
  });

  it('formats byte sizes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toContain('KB');
  });
});
