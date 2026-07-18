import { describe, expect, it, beforeEach } from 'vitest';
import { clearDentalDraft, loadDentalDraft, saveDentalDraft } from '../lib/dental-offline-draft';

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

describe('dental-offline-draft', () => {
  beforeEach(() => {
    mockLocalStorage().clear();
  });

  it('persists and loads chart drafts', () => {
    const patientId = 'test-patient-draft';
    saveDentalDraft({
      patientId,
      teeth: [{ toothNumber: 1, status: 'decayed' }],
      odontogramMode: 'adult',
      savedAt: new Date().toISOString(),
    });
    const draft = loadDentalDraft(patientId);
    expect(draft?.teeth[0]?.status).toBe('decayed');
    clearDentalDraft(patientId);
    expect(loadDentalDraft(patientId)).toBeNull();
  });
});
