import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppProviders } from './app/providers/AppProviders';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { RequireAppointmentsEnabled, RequirePortalSession } from './app/router/RequirePortalSession';
import { MemorySecureStorage } from './lib/secure-storage';
import { loadPatientPortalRuntimeConfig } from './config/runtime-config';
import { formatPortalDate, t } from './i18n/messages';

vi.mock('./app/providers/ConfigProvider', async () => {
  const actual = await vi.importActual<typeof import('./app/providers/ConfigProvider')>(
    './app/providers/ConfigProvider',
  );
  return actual;
});

describe('Phase 46c — patient-portal appointments UI', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.stubEnv('VITE_PATIENT_PORTAL_CENTER_ENABLED', 'true');
    vi.stubEnv('VITE_PATIENT_PORTAL_APPOINTMENTS_ENABLED', 'false');
    vi.stubEnv('VITE_API_BASE_URL', '/api');
    vi.stubEnv('VITE_DEFAULT_LOCALE', 'en');
  });

  it('defaults appointments flag OFF in runtime config', () => {
    const config = loadPatientPortalRuntimeConfig({
      VITE_PATIENT_PORTAL_CENTER_ENABLED: 'true',
      VITE_PATIENT_PORTAL_APPOINTMENTS_ENABLED: undefined,
      VITE_API_BASE_URL: '/api',
      VITE_DEFAULT_LOCALE: 'en',
    });
    expect(config.appointmentsEnabled).toBe(false);
    expect(config.phase).toBe('46e');
  });

  it('localizes appointment labels in EN and AR (RTL-ready)', () => {
    expect(t('en', 'appointments.title')).toBe('Appointments');
    expect(t('ar', 'appointments.title')).toBe('المواعيد');
    const formatted = formatPortalDate(new Date('2026-07-20T10:00:00.000Z'), 'en', 'UTC');
    expect(formatted.length).toBeGreaterThan(0);
  });

  it('redirects unauthenticated users away from appointments', () => {
    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/appointments']}>
          <Routes>
            <Route
              path="/appointments"
              element={
                <RequirePortalSession>
                  <div>secret</div>
                </RequirePortalSession>
              }
            />
            <Route path="/login" element={<div>login-page</div>} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );
    expect(screen.getByText('login-page')).toBeTruthy();
  });

  it('hides appointments when sub-flag OFF even with session', () => {
    const storage = new MemorySecureStorage();
    storage.setItem('portal.accessToken', 'tok');
    storage.setItem('portal.tenantId', 't1');
    storage.setItem('portal.sessionId', 's1');

    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/appointments']}>
          <Routes>
            <Route
              path="/appointments"
              element={
                <RequireAppointmentsEnabled>
                  <AppointmentsPage />
                </RequireAppointmentsEnabled>
              }
            />
            <Route path="/account" element={<div>account-page</div>} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );
    expect(screen.getByText('account-page')).toBeTruthy();
  });
});
