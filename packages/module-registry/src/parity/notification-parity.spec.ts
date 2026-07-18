import { describe, expect, it } from 'vitest';
import { BUILTIN_MODULE_MANIFESTS, validateBuiltinManifestCompleteness } from '../index';
import {
  validateBuiltinNotificationIntegrity,
  validateCanonicalNotificationVocabulary,
  CANONICAL_NOTIFICATION_CATEGORY_COUNT,
  CANONICAL_NOTIFICATION_CHANNEL_COUNT,
  CANONICAL_NOTIFICATION_TYPE_COUNT,
  CANONICAL_NOTIFICATION_TEMPLATE_COUNT,
  CANONICAL_NOTIFICATION_PROVIDER_COUNT,
  CANONICAL_NOTIFICATION_SURFACE_COUNT,
  CANONICAL_NOTIFICATION_PACK_COUNT,
  CANONICAL_NOTIFICATION_ENTRY_COUNT,
  CANONICAL_NOTIFICATION_DELIVERY_POLICIES,
  CANONICAL_NOTIFICATION_RETRY_POLICIES,
  CANONICAL_NOTIFICATION_CONSENT_POLICIES,
  CANONICAL_NOTIFICATION_PREFERENCE_POLICIES,
  CANONICAL_NOTIFICATION_ESCALATION_POLICIES,
  CANONICAL_NOTIFICATION_REDACTION_POLICIES,
  CANONICAL_NOTIFICATION_RETENTION_POLICIES,
  STATIC_NOTIFICATION_CATALOG_IS_RUNTIME_AUTHORITY,
  buildAllNotificationContributions,
  buildNotificationContributionsForModule,
  NOTIFICATION_BUILTIN_PROVIDER_KEY,
} from '../notification';

describe('notification parity (Phase 41a)', () => {
  it('declares static catalog is never runtime authority', () => {
    expect(STATIC_NOTIFICATION_CATALOG_IS_RUNTIME_AUTHORITY).toBe(false);
  });

  it('canonical vocabulary counts are stable', () => {
    expect(CANONICAL_NOTIFICATION_CATEGORY_COUNT).toBe(24);
    expect(CANONICAL_NOTIFICATION_CHANNEL_COUNT).toBe(8);
    expect(CANONICAL_NOTIFICATION_TYPE_COUNT).toBe(32);
    expect(CANONICAL_NOTIFICATION_TEMPLATE_COUNT).toBe(32);
    expect(CANONICAL_NOTIFICATION_PROVIDER_COUNT).toBe(6);
    expect(CANONICAL_NOTIFICATION_SURFACE_COUNT).toBe(6);
    expect(CANONICAL_NOTIFICATION_PACK_COUNT).toBe(8);
    expect(CANONICAL_NOTIFICATION_ENTRY_COUNT).toBe(92);
  });

  it('vocabulary-only policy sets are stable (not counted in ENTRY_COUNT)', () => {
    expect(CANONICAL_NOTIFICATION_DELIVERY_POLICIES).toHaveLength(11);
    expect(CANONICAL_NOTIFICATION_RETRY_POLICIES).toHaveLength(6);
    expect(CANONICAL_NOTIFICATION_CONSENT_POLICIES).toHaveLength(6);
    expect(CANONICAL_NOTIFICATION_PREFERENCE_POLICIES).toHaveLength(4);
    expect(CANONICAL_NOTIFICATION_ESCALATION_POLICIES).toHaveLength(4);
    expect(CANONICAL_NOTIFICATION_REDACTION_POLICIES).toHaveLength(7);
    expect(CANONICAL_NOTIFICATION_RETENTION_POLICIES).toHaveLength(6);
  });

  it('all vocabulary-only policies are fail-closed', () => {
    for (const policies of [
      CANONICAL_NOTIFICATION_DELIVERY_POLICIES,
      CANONICAL_NOTIFICATION_RETRY_POLICIES,
      CANONICAL_NOTIFICATION_CONSENT_POLICIES,
      CANONICAL_NOTIFICATION_PREFERENCE_POLICIES,
      CANONICAL_NOTIFICATION_ESCALATION_POLICIES,
      CANONICAL_NOTIFICATION_REDACTION_POLICIES,
      CANONICAL_NOTIFICATION_RETENTION_POLICIES,
    ]) {
      expect(policies.every((p) => p.failureBehavior.failClosed === true)).toBe(true);
    }
  });

  it('canonical vocabulary passes integrity validation', () => {
    expect(validateCanonicalNotificationVocabulary()).toEqual([]);
  });

  it('buildAllNotificationContributions produces expected count', () => {
    expect(buildAllNotificationContributions()).toHaveLength(CANONICAL_NOTIFICATION_ENTRY_COUNT);
  });

  it('per-module builders avoid handwritten notification entries', () => {
    expect(buildNotificationContributionsForModule('scheduling').length).toBeGreaterThan(0);
    expect(buildNotificationContributionsForModule('notifications').length).toBeGreaterThan(0);
    expect(buildNotificationContributionsForModule('ai')).toHaveLength(0);
  });

  it('channels carry required identity metadata and use the builtin provider key', () => {
    const channels = buildAllNotificationContributions().filter((c) => c.notificationKind === 'channel');
    expect(channels.length).toBe(8);
    for (const channel of channels) {
      expect(channel.channelId).toBeTruthy();
      expect(channel.providerKey).toBe(NOTIFICATION_BUILTIN_PROVIDER_KEY);
      expect(channel.permissionResource).toMatch(/^api\./);
      expect(channel.schemaVersion).toBe('1');
      expect(channel.contributionSchemaVersion).toBe(1);
    }
  });

  it('types declare a category and at least one default channel', () => {
    const types = buildAllNotificationContributions().filter((c) => c.notificationKind === 'type');
    expect(types.length).toBe(32);
    for (const type of types) {
      expect(type.categoryId).toBeTruthy();
      expect(type.defaultChannelIds?.length).toBeGreaterThan(0);
    }
  });

  it('templates never declare secret-like variable names', () => {
    const templates = buildAllNotificationContributions().filter((c) => c.notificationKind === 'template');
    expect(templates.length).toBe(32);
    const secretPattern = /password|secret|token|apikey|credential|ssn|otp/i;
    for (const template of templates) {
      for (const variableName of template.variableNames ?? []) {
        expect(secretPattern.test(variableName)).toBe(false);
      }
    }
  });

  it('providers never require credentials and use the platform vendor', () => {
    const providers = buildAllNotificationContributions().filter((c) => c.notificationKind === 'provider');
    expect(providers.length).toBe(6);
    for (const provider of providers) {
      expect(provider.requiresCredentials).toBe(false);
      expect(provider.vendor).toBe('platform');
    }
  });

  it('builtin manifests satisfy notification integrity', () => {
    const errors = validateBuiltinNotificationIntegrity(BUILTIN_MODULE_MANIFESTS);
    expect(errors).toEqual([]);
  });

  it('builtin manifests satisfy global completeness', () => {
    expect(validateBuiltinManifestCompleteness(BUILTIN_MODULE_MANIFESTS)).toEqual([]);
  });
});
