import { describe, expect, it } from 'vitest';
import {
  canManageQueue,
  canExportQueue,
  canUpdateQueue,
  canViewQueue,
  canSelectQueueBranch,
  priorityBadgeClass,
  resolveQueueViewMode,
  statusBadgeClass,
} from '../config/queue-config';

describe('queue-config', () => {
  it('gates queue update for receptionist', () => {
    const perm = (action: string) => action === 'update';
    expect(canUpdateQueue(perm)).toBe(true);
  });

  it('gates queue manage for manager', () => {
    const perm = (action: string) => action === 'manage';
    expect(canManageQueue(perm)).toBe(true);
  });

  it('gates queue view for doctor', () => {
    const perm = (action: string) => action === 'view';
    expect(canViewQueue(perm)).toBe(true);
  });

  it('resolves doctor view mode', () => {
    expect(resolveQueueViewMode(['doctor'])).toBe('doctor');
  });

  it('resolves manager view mode', () => {
    expect(resolveQueueViewMode(['owner'])).toBe('manager');
  });

  it('resolves reception view mode by default', () => {
    expect(resolveQueueViewMode(['receptionist'])).toBe('reception');
  });

  it('allows branch selection for general managers', () => {
    expect(canSelectQueueBranch(['general_manager'])).toBe(true);
    expect(canSelectQueueBranch(['receptionist'])).toBe(false);
  });

  it('maps status badge classes', () => {
    expect(statusBadgeClass('waiting')).toBe('badgeWaiting');
    expect(statusBadgeClass('called')).toBe('badgeCalled');
    expect(statusBadgeClass('serving')).toBe('badgeServing');
    expect(statusBadgeClass('no_show')).toBe('badgeNoShow');
  });

  it('allows export for managers', () => {
    const perm = (action: string) => action === 'export';
    expect(canExportQueue(perm)).toBe(true);
  });

  it('maps priority badge classes', () => {
    expect(priorityBadgeClass('emergency')).toBe('priorityEmergency');
    expect(priorityBadgeClass('vip')).toBe('priorityVip');
  });
});
