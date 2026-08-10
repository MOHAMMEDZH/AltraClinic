import { describe, expect, it } from 'vitest';
import type { I18nMessages } from '@booking/i18n';
import { messages } from './messages';

function flattenKeys(node: I18nMessages, prefix = ''): string[] {
  return Object.entries(node).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') return [path];
    return flattenKeys(value, path);
  });
}

describe('Super Admin message catalog parity', () => {
  it('en-US and ar-SY expose exactly the same set of keys', () => {
    const enKeys = flattenKeys(messages['en-US']).sort();
    const arKeys = flattenKeys(messages['ar-SY']).sort();

    const missingFromAr = enKeys.filter((key) => !arKeys.includes(key));
    const missingFromEn = arKeys.filter((key) => !enKeys.includes(key));

    expect(missingFromAr).toEqual([]);
    expect(missingFromEn).toEqual([]);
    expect(arKeys).toEqual(enKeys);
  });

  it('every message value is a non-empty string', () => {
    for (const locale of ['en-US', 'ar-SY'] as const) {
      for (const key of flattenKeys(messages[locale])) {
        const parts = key.split('.');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let current: any = messages[locale];
        for (const part of parts) current = current[part];
        expect(typeof current).toBe('string');
        expect((current as string).length).toBeGreaterThan(0);
      }
    }
  });

  it('covers the required Step 09 namespaces for both locales', () => {
    const requiredPrefixes = [
      'confirm.suspendUser',
      'confirm.reactivateUser',
      'confirm.removeRole',
      'confirm.revokeOwnSession',
      'confirm.revokeOwnOthers',
      'confirm.revokeOwnAll',
      'confirm.revokeAdminSession',
      'confirm.revokeAdminAll',
      'confirm.mfaResetApprove',
      'confirm.mfaResetReject',
      'pages.login',
      'pages.security',
      'pages.platformUsers',
      'pages.platformUserDetail',
      'pages.roles',
      'pages.mfaReset',
      'pages.mfa',
      'pages.activate',
      'status',
      'shell.language',
    ];

    for (const locale of ['en-US', 'ar-SY'] as const) {
      const keys = flattenKeys(messages[locale]);
      for (const prefix of requiredPrefixes) {
        expect(keys.some((key) => key === prefix || key.startsWith(`${prefix}.`))).toBe(true);
      }
    }
  });
});
