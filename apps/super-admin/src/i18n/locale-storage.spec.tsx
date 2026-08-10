import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider, useI18n } from '@booking/i18n/react';
import { LOCALE_STORAGE_KEY } from '@booking/i18n';
import { messages } from './messages';
import { SUPER_ADMIN_LOCALE_STORAGE_KEY } from './locale';

function Harness() {
  const { locale, setLocale } = useI18n();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <button type="button" onClick={() => setLocale('ar-SY')}>
        set-ar
      </button>
      <button type="button" onClick={() => setLocale('en-US')}>
        set-en
      </button>
    </div>
  );
}

function renderWithSuperAdminLocale() {
  return render(
    <I18nProvider messages={messages} storageKey={SUPER_ADMIN_LOCALE_STORAGE_KEY}>
      <Harness />
    </I18nProvider>,
  );
}

describe('Super Admin locale storage isolation', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('uses a dedicated storage key, distinct from the shared booking.locale key', () => {
    expect(SUPER_ADMIN_LOCALE_STORAGE_KEY).toBe('booking.super-admin.locale');
    expect(SUPER_ADMIN_LOCALE_STORAGE_KEY).not.toBe(LOCALE_STORAGE_KEY);
  });

  it('never reads booking.locale — a stored clinic-dashboard preference is ignored', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'ar-SY');
    renderWithSuperAdminLocale();
    // Super Admin defaults to en-US even though the shared clinic key says ar-SY.
    expect(screen.getByTestId('locale').textContent).toBe('en-US');
  });

  it('falls back to the default locale for an invalid value under its own key', () => {
    localStorage.setItem(SUPER_ADMIN_LOCALE_STORAGE_KEY, 'fr-FR');
    renderWithSuperAdminLocale();
    expect(screen.getByTestId('locale').textContent).toBe('en-US');
  });

  it('loads a valid persisted preference from its own key', () => {
    localStorage.setItem(SUPER_ADMIN_LOCALE_STORAGE_KEY, 'ar-SY');
    renderWithSuperAdminLocale();
    expect(screen.getByTestId('locale').textContent).toBe('ar-SY');
  });

  it('persists writes only to booking.super-admin.locale, never to booking.locale', () => {
    renderWithSuperAdminLocale();
    fireEvent.click(screen.getByRole('button', { name: 'set-ar' }));

    expect(localStorage.getItem(SUPER_ADMIN_LOCALE_STORAGE_KEY)).toBe('ar-SY');
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull();
  });

  it('does not overwrite an existing booking.locale value belonging to another app', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'en-US');
    renderWithSuperAdminLocale();
    fireEvent.click(screen.getByRole('button', { name: 'set-ar' }));

    expect(localStorage.getItem(SUPER_ADMIN_LOCALE_STORAGE_KEY)).toBe('ar-SY');
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en-US');
  });

  it('sets document lang/dir from the isolated locale', () => {
    renderWithSuperAdminLocale();
    fireEvent.click(screen.getByRole('button', { name: 'set-ar' }));

    expect(document.documentElement.lang).toBe('ar-SY');
    expect(document.documentElement.dir).toBe('rtl');

    fireEvent.click(screen.getByRole('button', { name: 'set-en' }));
    expect(document.documentElement.lang).toBe('en-US');
    expect(document.documentElement.dir).toBe('ltr');
  });
});
