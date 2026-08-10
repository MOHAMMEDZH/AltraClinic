import { describe, expect, it } from 'vitest';
import {
  canApproveRestore,
  canCreateBackup,
  canManage,
  canRestore,
  canVerify,
  canViewBackupRestore,
  formatBytes,
  isCompletedJobStatus,
  isFailedJobStatus,
  isLiveJobStatus,
} from '../config/backup-restore-config';

describe('backup-restore-config', () => {
  it('gates RBAC helpers by role matrix', () => {
    expect(canViewBackupRestore(['owner'])).toBe(true);
    expect(canCreateBackup(['owner'])).toBe(true);
    expect(canVerify(['owner'])).toBe(true);
    expect(canRestore(['owner'])).toBe(true);
    expect(canApproveRestore(['owner'])).toBe(true);
    expect(canManage(['owner'])).toBe(true);
    expect(canViewBackupRestore(['receptionist'])).toBe(false);
    expect(canCreateBackup(['receptionist'])).toBe(false);
    expect(canRestore(['receptionist'])).toBe(false);
  });

  it('identifies live job statuses for polling', () => {
    expect(isLiveJobStatus('queued')).toBe(true);
    expect(isLiveJobStatus('running')).toBe(true);
    expect(isLiveJobStatus('validating')).toBe(true);
    expect(isLiveJobStatus('completed')).toBe(false);
  });

  it('classifies completed and failed statuses', () => {
    expect(isCompletedJobStatus('completed')).toBe(true);
    expect(isFailedJobStatus('dead_letter')).toBe(true);
    expect(isFailedJobStatus('cancelled')).toBe(true);
  });

  it('formats byte sizes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toContain('KB');
  });
});
