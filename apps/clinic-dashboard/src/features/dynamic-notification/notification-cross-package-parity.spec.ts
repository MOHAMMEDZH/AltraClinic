import { describe, expect, it } from 'vitest';
import { BUILTIN_MODULE_MANIFESTS } from '@booking/module-registry';
import { validateNotificationLayerParity } from '@booking/module-registry/notification';
import { STATIC_NOTIFICATION_CATALOG } from './lib/static-notification-catalog';

describe('notification cross-package parity (Phase 41a)', () => {
  it('enforces vocabulary → manifest → static catalog parity', () => {
    expect(validateNotificationLayerParity(BUILTIN_MODULE_MANIFESTS, [...STATIC_NOTIFICATION_CATALOG])).toEqual([]);
  });
});
