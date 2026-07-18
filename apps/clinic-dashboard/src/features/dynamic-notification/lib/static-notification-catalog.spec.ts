import { describe, expect, it } from 'vitest';
import {
  STATIC_NOTIFICATION_CATALOG,
  STATIC_NOTIFICATION_CATALOG_IS_RUNTIME_AUTHORITY,
  assertNotificationCatalogValid,
} from './static-notification-catalog';

describe('STATIC_NOTIFICATION_CATALOG (Phase 41a)', () => {
  it('is never runtime authority', () => {
    expect(STATIC_NOTIFICATION_CATALOG_IS_RUNTIME_AUTHORITY).toBe(false);
  });

  it('contains 92 parity entries', () => {
    expect(STATIC_NOTIFICATION_CATALOG).toHaveLength(92);
  });

  it('has unique extensionIds', () => {
    const ids = STATIC_NOTIFICATION_CATALOG.map((e) => e.extensionId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('passes local catalog validation', () => {
    expect(assertNotificationCatalogValid()).toEqual([]);
  });

  it('breaks down into 8 channels, 32 types, 32 templates, 6 providers, 6 surfaces, 8 packs', () => {
    const byKind = (kind: string) => STATIC_NOTIFICATION_CATALOG.filter((e) => e.notificationKind === kind).length;
    expect(byKind('channel')).toBe(8);
    expect(byKind('type')).toBe(32);
    expect(byKind('template')).toBe(32);
    expect(byKind('provider')).toBe(6);
    expect(byKind('surface')).toBe(6);
    expect(byKind('pack')).toBe(8);
  });

  it('never declares secret-like template variable names', () => {
    const secretPattern = /password|secret|token|apikey|credential|ssn|otp/i;
    const templates = STATIC_NOTIFICATION_CATALOG.filter((e) => e.notificationKind === 'template');
    for (const template of templates) {
      for (const variableName of template.variableNames ?? []) {
        expect(secretPattern.test(variableName)).toBe(false);
      }
    }
  });
});
