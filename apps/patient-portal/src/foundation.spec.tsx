import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import {
  loadPatientPortalRuntimeConfig,
  validatePatientPortalRuntimeConfig,
} from './config/runtime-config';
import { createPortalHttpClient } from './lib/api-client';
import { MemorySecureStorage } from './lib/secure-storage';
import {
  applyPortalBrandToDocument,
  mergePortalBrand,
  loadPortalBrandAsset,
} from './lib/white-label';
import { formatPortalDate, resolvePortalLocale, t } from './i18n/messages';
import { AppProviders } from './app/providers/AppProviders';
import { PortalShellLayout } from './app/layout/PortalShellLayout';
import { UnavailablePage } from './pages/UnavailablePage';
import { FoundationPage } from './pages/FoundationPage';

describe('Phase 46a — patient-portal frontend foundation', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.stubEnv('VITE_PATIENT_PORTAL_CENTER_ENABLED', 'false');
    vi.stubEnv('VITE_API_BASE_URL', '/api');
    vi.stubEnv('VITE_DEFAULT_LOCALE', 'en');
  });

  it('loads runtime config with center flag default OFF', () => {
    const config = loadPatientPortalRuntimeConfig({
      VITE_PATIENT_PORTAL_CENTER_ENABLED: undefined,
      VITE_API_BASE_URL: '/api',
      VITE_DEFAULT_LOCALE: 'en',
    });
    expect(config.centerEnabled).toBe(false);
    expect(config.appointmentsEnabled).toBe(false);
    expect(config.phase).toBe('46e');
    expect(validatePatientPortalRuntimeConfig(config)).toEqual({ ok: true });
  });

  it('validates api base URL shape', () => {
    const bad = loadPatientPortalRuntimeConfig({
      VITE_API_BASE_URL: 'not-a-url',
      VITE_DEFAULT_LOCALE: 'en',
    });
    const result = validatePatientPortalRuntimeConfig(bad);
    expect(result.ok).toBe(false);
  });

  it('secure storage allows portal session keys and rejects secrets', () => {
    const storage = new MemorySecureStorage();
    storage.setItem('portal.refreshToken', 'rt');
    expect(storage.getItem('portal.refreshToken')).toBe('rt');
    expect(() => storage.setItem('password', 'x')).toThrow(/Credential persistence/);
  });

  it('API client propagates tenant and correlation headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ready: true }),
      headers: new Headers(),
    });
    vi.stubGlobal('fetch', fetchMock);
    const client = createPortalHttpClient('/api');
    await client.request('/patient-portal/health', {
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      correlationId: 'corr-1',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/patient-portal/health',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Tenant-Id': 'tenant-1',
          'X-Branch-Id': 'branch-1',
          'X-Correlation-Id': 'corr-1',
        }),
      }),
    );
  });

  it('White Label merge and CSS variables apply safely', () => {
    const brand = mergePortalBrand({ clinicName: 'Acme Clinic', primaryColor: '#123456' });
    expect(brand.clinicName).toBe('Acme Clinic');
    const root = document.createElement('div');
    applyPortalBrandToDocument(brand, root);
    expect(root.style.getPropertyValue('--portal-color-primary')).toBe('#123456');
  });

  it('White Label asset loader degrades on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    expect(await loadPortalBrandAsset('https://example.test/logo.png')).toBeNull();
    expect(await loadPortalBrandAsset(null)).toBeNull();
  });

  it('localization initializes en/ar and formatting', () => {
    expect(resolvePortalLocale('ar-SA')).toBe('ar');
    expect(t('en', 'app.unavailable.title')).toMatch(/unavailable/i);
    expect(t('ar', 'app.name')).toBeTruthy();
    expect(formatPortalDate(new Date('2026-07-19T12:00:00Z'), 'en', 'UTC')).toBeTruthy();
  });

  it('renders unavailable state when flag OFF', () => {
    const { container } = render(
      <AppProviders>
        <MemoryRouter>
          <Routes>
            <Route element={<PortalShellLayout />}>
              <Route index element={<UnavailablePage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );
    expect(within(container).getByRole('heading', { level: 1 })).toBeTruthy();
    expect(within(container).getByTestId('portal-phase').textContent).toMatch(/center OFF|flag OFF/);
    expect(within(container).getByRole('banner')).toBeTruthy();
    expect(within(container).getByRole('contentinfo')).toBeTruthy();
    expect(container.querySelector('.portal-skip-link')).toBeTruthy();
  });

  it('renders foundation shell when flag ON with appointments gated OFF by default', () => {
    vi.stubEnv('VITE_PATIENT_PORTAL_CENTER_ENABLED', 'true');
    const { container } = render(
      <AppProviders>
        <MemoryRouter>
          <Routes>
            <Route element={<PortalShellLayout />}>
              <Route index element={<FoundationPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );
    expect(within(container).getByTestId('portal-phase').textContent).toMatch(/center ON/);
    expect(within(container).getByTestId('portal-phase').textContent).toMatch(/appointments OFF/);
  });
});
