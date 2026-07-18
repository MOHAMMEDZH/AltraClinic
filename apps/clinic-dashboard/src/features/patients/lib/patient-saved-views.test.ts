import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deletePatientSavedView,
  listPatientSavedViews,
  savePatientSavedView,
} from './patient-saved-views';

function mockLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  });
}

describe('patient-saved-views', () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  it('saves and lists views', () => {
    savePatientSavedView({
      name: 'Active females',
      search: 'sarah',
      status: 'active',
      gender: 'female',
      columns: ['name', 'phone'],
    });
    const views = listPatientSavedViews();
    expect(views).toHaveLength(1);
    expect(views[0]?.name).toBe('Active females');
    expect(views[0]?.gender).toBe('female');
  });

  it('deletes a saved view', () => {
    const view = savePatientSavedView({
      name: 'All patients',
      search: '',
      status: 'all',
      gender: null,
      columns: ['name'],
    });
    deletePatientSavedView(view.id);
    expect(listPatientSavedViews()).toHaveLength(0);
  });
});
