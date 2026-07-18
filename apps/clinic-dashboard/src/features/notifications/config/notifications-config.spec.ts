import { describe, expect, it } from 'vitest';
import {
  buildNotificationsPermCheck,
  canCreateNotifications,
  canManageNotifications,
  canViewNotifications,
  INBOX_TABS,
  NOTIFICATION_CHANNELS,
} from './notifications-config';

describe('notifications-config', () => {
  it('allows owners to view and manage notifications', () => {
    const perm = buildNotificationsPermCheck(['owner']);
    expect(canViewNotifications(perm)).toBe(true);
    expect(canCreateNotifications(perm)).toBe(true);
    expect(canManageNotifications(perm)).toBe(true);
  });

  it('allows patients to view but not manage', () => {
    const perm = buildNotificationsPermCheck(['patient']);
    expect(canViewNotifications(perm)).toBe(true);
    expect(canManageNotifications(perm)).toBe(false);
    expect(canCreateNotifications(perm)).toBe(false);
  });

  it('blocks roles without notification access', () => {
    const perm = buildNotificationsPermCheck(['unknown_role']);
    expect(canViewNotifications(perm)).toBe(false);
  });

  it('defines channel and inbox tab constants', () => {
    expect(NOTIFICATION_CHANNELS).toContain('email');
    expect(INBOX_TABS).toContain('unread');
  });
});
