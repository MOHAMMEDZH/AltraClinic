import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  loadPatientPortalRuntimeConfig,
  validatePatientPortalRuntimeConfig,
} from './config/runtime-config';
import { applyPortalBrandToDocument, mergePortalBrand } from './lib/white-label';
import { formatPortalNumber, resolvePortalLocale, t, tp } from './i18n/messages';
import { AppProviders } from './app/providers/AppProviders';
import { PortalShellLayout } from './app/layout/PortalShellLayout';
import { HomeDashboardPage } from './pages/HomeDashboardPage';
import { AccountPage } from './pages/AccountPage';

function renderWithProviders(ui: ReactNode, initialPath = '/') {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route element={<PortalShellLayout />}>
            <Route path="*" element={ui} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('Phase 46e — portal experience', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  beforeEach(() => {
    vi.stubEnv('VITE_PATIENT_PORTAL_CENTER_ENABLED', 'true');
    vi.stubEnv('VITE_PATIENT_PORTAL_APPOINTMENTS_ENABLED', 'true');
    vi.stubEnv('VITE_PATIENT_PORTAL_CAREGIVER_ENABLED', 'true');
    vi.stubEnv('VITE_API_BASE_URL', '/api');
    vi.stubEnv('VITE_DEFAULT_LOCALE', 'en');
    sessionStorage.setItem('portal.accessToken', 'tok');
    sessionStorage.setItem('portal.tenantId', 'tenant-1');
    sessionStorage.setItem('portal.sessionId', 'sess-1');
  });

  it('runtime config reports phase 46e with flags defaulting OFF when unset', () => {
    const config = loadPatientPortalRuntimeConfig({
      VITE_PATIENT_PORTAL_CENTER_ENABLED: undefined,
      VITE_API_BASE_URL: '/api',
      VITE_DEFAULT_LOCALE: 'en',
    });
    expect(config.centerEnabled).toBe(false);
    expect(config.phase).toBe('46e');
    expect(validatePatientPortalRuntimeConfig(config)).toEqual({ ok: true });
  });

  it('white label applies colors, favicon token, and portal name', () => {
    const brand = mergePortalBrand({
      primaryColor: '#115e59',
      secondaryColor: '#042f2e',
      portalName: 'Clinic Portal',
      faviconUrl: 'https://example.test/favicon.ico',
      fontFamily: '"IBM Plex Sans", sans-serif',
      source: 'tenant',
    });
    applyPortalBrandToDocument(brand);
    expect(document.documentElement.style.getPropertyValue('--portal-color-primary')).toBe(
      '#115e59',
    );
    expect(document.documentElement.dataset.portalBrand).toBe('Clinic Portal');
    expect(document.title).toBe('Clinic Portal');
  });

  it('localization supports RTL locale, fallback, and pluralization', () => {
    expect(resolvePortalLocale('ar-SA')).toBe('ar');
    expect(t('ar', 'nav.home')).toBeTruthy();
    expect(t('en', 'missing.key.example')).toBe('missing.key.example');
    expect(tp('en', 'nav.home', 'nav.account', 1)).toBe(t('en', 'nav.home'));
    expect(formatPortalNumber(12, 'en')).toBe('12');
  });

  it('home dashboard exposes welcome surface and landmarks', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/branding')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            clinicName: 'Demo Clinic',
            portalName: 'Demo Portal',
            primaryColor: '#0f766e',
            secondaryColor: '#134e4a',
            logoUrl: null,
            faviconUrl: null,
            fontFamily: null,
            source: 'tenant',
          }),
          headers: new Headers(),
        };
      }
      if (String(url).includes('/me/profile')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            patientId: 'p1',
            firstName: 'Ada',
            lastName: 'Lovelace',
            dateOfBirth: null,
            gender: null,
            actingContext: 'self',
          }),
          headers: new Headers(),
        };
      }
      if (String(url).includes('/me/appointments')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: 'a1',
                start: '2026-07-20T10:00:00.000Z',
                end: '2026-07-20T10:30:00.000Z',
                status: 'booked',
                providerId: 'pr1',
                branchId: null,
                serviceType: null,
              },
            ],
            total: 1,
          }),
          headers: new Headers(),
        };
      }
      if (String(url).includes('/me/caregivers')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                grantId: 'g1',
                status: 'active',
                active: true,
                scopes: ['profile'],
                caregiverName: 'Care',
                caregiverContact: 'c@x.test',
                expiresAt: null,
              },
            ],
          }),
          headers: new Headers(),
        };
      }
      return { ok: true, status: 200, json: async () => ({}), headers: new Headers() };
    });
    vi.stubGlobal('fetch', fetchMock);

    renderWithProviders(<HomeDashboardPage />);

    expect(document.querySelector('a.portal-skip-link')).toBeTruthy();
    expect(document.querySelector('main#main')).toBeTruthy();
    expect(await screen.findByRole('heading', { name: /welcome/i })).toBeTruthy();
    expect((await screen.findByTestId('home-profile-name')).textContent).toMatch(/Ada Lovelace/);
  });

  it('account page security and preferences regions are present after me/prefs load', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes('/branding')) {
        return {
          ok: true,
          status: 200,
          json: async () => mergePortalBrand({ source: 'default' }),
          headers: new Headers(),
        };
      }
      if (String(url).includes('/auth/me')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            userId: 'u1',
            portalAccountId: 'pa1',
            status: 'active',
            enrollmentComplete: true,
            mfaEnabled: false,
            sessionClass: 'patient',
          }),
          headers: new Headers(),
        };
      }
      if (String(url).includes('/me/preferences') && (!init?.method || init.method === 'GET')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            locale: 'en',
            channels: { email: true, sms: false, push: false },
          }),
          headers: new Headers(),
        };
      }
      return { ok: true, status: 200, json: async () => ({ ok: true }), headers: new Headers() };
    });
    vi.stubGlobal('fetch', fetchMock);

    renderWithProviders(<AccountPage />, '/account');

    expect(await screen.findByRole('heading', { name: /account & security/i })).toBeTruthy();
    expect(await screen.findByRole('heading', { name: /notification preferences/i })).toBeTruthy();
    const security = document.getElementById('security');
    expect(security).toBeTruthy();
    expect(within(security as HTMLElement).getByText(/current password/i)).toBeTruthy();
  });
});
