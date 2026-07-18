import { describe, expect, it, beforeEach } from 'vitest';
import {
  clearEmrDraft,
  hasEmrDraft,
  loadEmrDraft,
  listEmrDrafts,
  saveEmrDraft,
} from './emr-offline-draft';

function mockLocalStorage() {
  const store = new Map<string, string>();
  const storage = {
    get length() {
      return store.size;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  return store;
}

describe('emr-offline-draft', () => {
  beforeEach(() => {
    mockLocalStorage().clear();
  });

  it('saves and loads encounter drafts', () => {
    saveEmrDraft({
      encounterId: 'enc-1',
      payload: { chiefComplaint: 'Headache' },
      savedAt: new Date().toISOString(),
    });
    expect(hasEmrDraft('enc-1')).toBe(true);
    expect(loadEmrDraft('enc-1')?.payload.chiefComplaint).toBe('Headache');
    expect(listEmrDrafts()).toHaveLength(1);
    clearEmrDraft('enc-1');
    expect(hasEmrDraft('enc-1')).toBe(false);
  });
});
