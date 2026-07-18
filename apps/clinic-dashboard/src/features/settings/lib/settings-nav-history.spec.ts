import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadFavorites, loadRecent, recordSettingsVisit, toggleFavorite } from './settings-nav-history';

describe('settings-nav-history', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
    vi.stubGlobal('window', { localStorage: globalThis.localStorage });
  });

  it('records and loads recent visits', () => {
    recordSettingsVisit('/settings/general');
    recordSettingsVisit('/settings/branding');
    const recent = loadRecent();
    expect(recent[0]).toBe('/settings/branding');
    expect(recent).toContain('/settings/general');
  });

  it('toggles favorites', () => {
    const next = toggleFavorite('/settings/general');
    expect(next).toContain('/settings/general');
    const removed = toggleFavorite('/settings/general');
    expect(removed).not.toContain('/settings/general');
    expect(loadFavorites()).toEqual(removed);
  });
});
