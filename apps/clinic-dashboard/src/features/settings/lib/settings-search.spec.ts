import { describe, expect, it } from 'vitest';
import { searchSettings } from '../lib/settings-search';
import { SETTINGS_NAV } from '../config/settings-config';

describe('settings-search', () => {
  it('finds settings by keyword', () => {
    const results = searchSettings('mfa', SETTINGS_NAV);
    expect(results.some((r) => r.id === 'security')).toBe(true);
  });

  it('returns empty for blank query', () => {
    expect(searchSettings('  ', SETTINGS_NAV)).toEqual([]);
  });
});
