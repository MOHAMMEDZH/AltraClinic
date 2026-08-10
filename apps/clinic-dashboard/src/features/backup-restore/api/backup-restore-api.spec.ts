import { describe, expect, it } from 'vitest';
import {
  fetchBackupRestoreCatalog,
  listBackupRestoreJobs,
  createBackup,
  createRestore,
} from '../api/backup-restore-api';

describe('backup-restore-api surface', () => {
  it('exports operational API helpers', () => {
    expect(typeof fetchBackupRestoreCatalog).toBe('function');
    expect(typeof listBackupRestoreJobs).toBe('function');
    expect(typeof createBackup).toBe('function');
    expect(typeof createRestore).toBe('function');
  });
});
