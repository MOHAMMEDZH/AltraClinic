import { describe, expect, it } from 'vitest';
import { BUILTIN_MODULE_MANIFESTS, validateBuiltinManifestCompleteness } from '@booking/module-registry';
import {
  validateBuiltinNotificationIntegrity,
  validateCanonicalNotificationVocabulary,
  CANONICAL_NOTIFICATION_ENTRY_COUNT,
  CANONICAL_NOTIFICATION_TYPE_COUNT,
  buildAllNotificationContributions,
} from '@booking/module-registry/notification';
import { STATIC_NOTIFICATION_CATALOG, STATIC_NOTIFICATION_CATALOG_IS_RUNTIME_AUTHORITY } from './lib/static-notification-catalog';

describe('dynamic notification foundation (Phase 41a)', () => {
  it('keeps static catalog non-authoritative', () => {
    expect(STATIC_NOTIFICATION_CATALOG_IS_RUNTIME_AUTHORITY).toBe(false);
  });

  it('asserts canonical type count is exactly 32', () => {
    expect(CANONICAL_NOTIFICATION_TYPE_COUNT).toBe(32);
  });

  it('scheduling owns appointment lifecycle and reminder types', () => {
    const scheduling = BUILTIN_MODULE_MANIFESTS.find((m) => m.moduleId === 'scheduling');
    expect(
      scheduling?.extensions.notification?.some((c) => c.notificationKind === 'type' && c.typeId === 'appointment-reminder'),
    ).toBe(true);
    expect(
      scheduling?.extensions.notification?.some((c) => c.notificationKind === 'type' && c.typeId === 'appointment-created'),
    ).toBe(true);
  });

  it('notifications module owns the notification center surface', () => {
    const notifications = BUILTIN_MODULE_MANIFESTS.find((m) => m.moduleId === 'notifications');
    expect(
      notifications?.extensions.notification?.some(
        (c) => c.notificationKind === 'surface' && c.surfaceId === 'notification-center',
      ),
    ).toBe(true);
  });

  it('manifest completeness includes notification integrity', () => {
    expect(validateBuiltinManifestCompleteness(BUILTIN_MODULE_MANIFESTS)).toEqual([]);
  });

  it('notification integrity is clean', () => {
    expect(validateBuiltinNotificationIntegrity(BUILTIN_MODULE_MANIFESTS)).toEqual([]);
  });

  it('vocabulary is clean', () => {
    expect(validateCanonicalNotificationVocabulary()).toEqual([]);
  });

  it('contribution count matches static catalog', () => {
    expect(buildAllNotificationContributions()).toHaveLength(CANONICAL_NOTIFICATION_ENTRY_COUNT);
    expect(STATIC_NOTIFICATION_CATALOG).toHaveLength(CANONICAL_NOTIFICATION_ENTRY_COUNT);
  });

  it('manifest and catalog agree on extensionIds field-by-field for types', () => {
    const manifestTypes = BUILTIN_MODULE_MANIFESTS.flatMap((m) => m.extensions.notification ?? []).filter(
      (c) => c.notificationKind === 'type',
    );
    const catalogTypes = STATIC_NOTIFICATION_CATALOG.filter((e) => e.notificationKind === 'type');
    expect(manifestTypes.length).toBe(catalogTypes.length);

    const catalogById = new Map(catalogTypes.map((e) => [e.extensionId, e]));
    for (const contribution of manifestTypes) {
      const catalog = catalogById.get(contribution.extensionId);
      expect(catalog).toBeDefined();
      expect(contribution.typeId).toBe(catalog!.typeId);
      expect(contribution.categoryId).toBe(catalog!.categoryId);
      expect(contribution.permissionResource).toBe(catalog!.permissionResource);
    }
  });

  it('manifest and catalog agree on extensionIds field-by-field for channels', () => {
    const manifestChannels = BUILTIN_MODULE_MANIFESTS.flatMap((m) => m.extensions.notification ?? []).filter(
      (c) => c.notificationKind === 'channel',
    );
    const catalogChannels = STATIC_NOTIFICATION_CATALOG.filter((e) => e.notificationKind === 'channel');
    expect(manifestChannels.length).toBe(catalogChannels.length);

    const catalogById = new Map(catalogChannels.map((e) => [e.extensionId, e]));
    for (const contribution of manifestChannels) {
      const catalog = catalogById.get(contribution.extensionId);
      expect(catalog).toBeDefined();
      expect(contribution.channelId).toBe(catalog!.channelId);
      expect(contribution.runtimeImplemented).toBe(catalog!.runtimeImplemented);
    }
  });
});
