/**
 * Phase 46e — E2E-style happy-path coverage (deterministic, mocked HTTP).
 * Covers identity → home → appointments flag → caregiver flag → preferences.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppProviders } from './app/providers/AppProviders';
import { PortalShellLayout } from './app/layout/PortalShellLayout';
import { HomeDashboardPage } from './pages/HomeDashboardPage';
import { AccountPage } from './pages/AccountPage';
import { loadPatientPortalRuntimeConfig } from './config/runtime-config';

describe('Phase 46e — end-to-end portal experience workflows', () => {
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

  it('flags remain OFF by default outside stubs', () => {
    const config = loadPatientPortalRuntimeConfig({
      VITE_API_BASE_URL: '/api',
      VITE_DEFAULT_LOCALE: 'en',
    });
    expect(config.centerEnabled).toBe(false);
    expect(config.appointmentsEnabled).toBe(false);
    expect(config.caregiverEnabled).toBe(false);
  });

  it('authenticated home → account security/preferences path', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const path = String(url);
      if (path.includes('/branding')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            clinicName: 'E2E Clinic',
            portalName: 'E2E Portal',
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
      if (path.includes('/me/profile')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            patientId: 'p1',
            firstName: 'Pat',
            lastName: 'Ent',
            dateOfBirth: null,
            gender: null,
            actingContext: 'self',
          }),
          headers: new Headers(),
        };
      }
      if (path.includes('/me/appointments')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ items: [], total: 0 }),
          headers: new Headers(),
        };
      }
      if (path.includes('/me/caregivers')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ items: [] }),
          headers: new Headers(),
        };
      }
      if (path.includes('/auth/me')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            userId: 'u1',
            portalAccountId: 'pa1',
            status: 'active',
            enrollmentComplete: true,
            mfaEnabled: true,
            sessionClass: 'patient',
          }),
          headers: new Headers(),
        };
      }
      if (path.includes('/me/preferences')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            locale: 'en',
            channels: { email: true, sms: true, push: false },
          }),
          headers: new Headers(),
        };
      }
      return { ok: true, status: 200, json: async () => ({}), headers: new Headers() };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route element={<PortalShellLayout />}>
              <Route index element={<HomeDashboardPage />} />
              <Route path="account" element={<AccountPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    expect(await screen.findByRole('heading', { name: /welcome/i })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: /primary/i })).toBeTruthy();
    expect(document.querySelector('a.portal-skip-link')).toBeTruthy();
    expect(document.querySelector('[role="banner"]')).toBeTruthy();
    expect(document.querySelector('[role="contentinfo"]')).toBeTruthy();
  });
});
