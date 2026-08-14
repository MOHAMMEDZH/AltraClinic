/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClinicalServicesPage } from './ClinicalServicesPage';

const useAuth = vi.fn();
const useClinicalServices = vi.fn();
const useTenantServiceConfigs = vi.fn();
let canViewClinicalCatalog = true;

vi.mock('@booking/permissions', () => ({
  hasPermission: (_roles: string[], resource: string, action: string) => {
    if (resource === 'api.clinical-catalog') {
      if (action === 'view') return canViewClinicalCatalog;
      if (action === 'create') return canViewClinicalCatalog;
      if (action === 'update') return canViewClinicalCatalog;
      if (action === 'manage') return canViewClinicalCatalog;
    }
    return false;
  },
}));

vi.mock('@/app/providers/AuthProvider', () => ({
  useAuth: () => useAuth(),
}));

vi.mock('./hooks/useClinicalCatalog', () => ({
  useClinicalServices: (...args: unknown[]) => useClinicalServices(...args),
  useTenantServiceConfigs: (...args: unknown[]) => useTenantServiceConfigs(...args),
  useCreateTenantClinicalService: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePublishClinicalService: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpsertTenantServiceConfig: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@booking/i18n/react', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: 'en-US',
  }),
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ClinicalServicesPage />
    </QueryClientProvider>,
  );
}

describe('ClinicalServicesPage', () => {
  beforeEach(() => {
    canViewClinicalCatalog = true;
    useAuth.mockReturnValue({
      user: { tenantId: 'tenant-1', roles: ['clinic_admin'] },
    });
    useClinicalServices.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [
        {
          id: 'svc-1',
          stableKey: 'canonical.general.consultation',
          provenance: 'SYSTEM_CANONICAL',
          domain: 'GENERAL',
          categoryKey: null,
          defaultDurationMin: 30,
          lifecycle: 'PUBLISHED',
          tenantId: null,
          translations: [
            { locale: 'en', displayName: 'Consultation' },
            { locale: 'ar', displayName: 'استشارة' },
          ],
          createdAt: '',
          updatedAt: '',
        },
      ],
    });
    useTenantServiceConfigs.mockReturnValue({ data: [] });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders service list when user has view permission', async () => {
    renderPage();
    expect(await screen.findByText(/Consultation/)).toBeTruthy();
    expect(screen.getByText(/canonical.general.consultation/)).toBeTruthy();
  });

  it('shows access denied without clinical-catalog view permission', async () => {
    canViewClinicalCatalog = false;
    useAuth.mockReturnValue({
      user: { tenantId: 'tenant-1', roles: ['guest'] },
    });
    renderPage();
    expect(await screen.findByText('clinicalCatalog.accessDenied')).toBeTruthy();
  });
});
