/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClinicalServicesPage } from './ClinicalServicesPage';
import { ClinicalPricingPage } from './ClinicalPricingPage';

const useAuth = vi.fn();
const useClinicalServices = vi.fn();
const useTenantServiceConfigs = vi.fn();
const useClinicalPriceVersions = vi.fn();
const useSettingsBranches = vi.fn();
const upsertMutateAsync = vi.fn();
const createPriceMutateAsync = vi.fn();
let canViewClinicalCatalog = true;
let canViewBilling = true;

vi.mock('@booking/permissions', () => ({
  hasPermission: (_roles: string[], resource: string, action: string) => {
    if (resource === 'api.clinical-catalog') {
      if (action === 'view') return canViewClinicalCatalog;
      if (action === 'create') return canViewClinicalCatalog;
      if (action === 'update') return canViewClinicalCatalog;
      if (action === 'manage') return canViewClinicalCatalog;
    }
    if (resource === 'api.billing') return canViewBilling;
    return false;
  },
}));

vi.mock('@/app/providers/AuthProvider', () => ({
  useAuth: () => useAuth(),
}));

vi.mock('@/features/settings/hooks/useSettings', () => ({
  useSettingsBranches: (...args: unknown[]) => useSettingsBranches(...args),
}));

vi.mock('@/features/billing/config/billing-config', () => ({
  canViewBilling: () => canViewBilling,
  canManageBilling: () => canViewBilling,
  formatBillingCurrency: (n: number) => String(n),
  resolveBillingWorkspaceMode: () => 'full',
}));

vi.mock('@/features/billing/components/BillingQuickNav', () => ({
  BillingQuickNav: () => null,
}));

vi.mock('./hooks/useClinicalCatalog', () => ({
  useClinicalServices: (...args: unknown[]) => useClinicalServices(...args),
  useTenantServiceConfigs: (...args: unknown[]) => useTenantServiceConfigs(...args),
  useCreateTenantClinicalService: () => ({ mutateAsync: vi.fn(), isPending: false }),
  usePublishClinicalService: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpsertTenantServiceConfig: () => ({
    mutateAsync: upsertMutateAsync,
    isPending: false,
  }),
  useClinicalPriceVersions: (...args: unknown[]) => useClinicalPriceVersions(...args),
  useCreateClinicalPriceDraft: () => ({
    mutateAsync: createPriceMutateAsync,
    isPending: false,
  }),
  usePublishClinicalPriceVersion: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@booking/i18n/react', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: 'en-US',
  }),
}));

function renderWithQc(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('ClinicalServicesPage branch scope (PA-05)', () => {
  beforeEach(() => {
    canViewClinicalCatalog = true;
    useAuth.mockReturnValue({
      user: { tenantId: 'tenant-1', roles: ['clinic_admin'] },
    });
    useSettingsBranches.mockReturnValue({
      data: [{ id: 'branch-1', name: 'Downtown', isActive: true }],
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
    useTenantServiceConfigs.mockReturnValue({
      data: [
        {
          id: 'cfg-1',
          clinicalServiceId: 'svc-1',
          branchId: null,
          enabled: true,
        },
      ],
    });
    useClinicalPriceVersions.mockReturnValue({ isLoading: false, data: [] });
    upsertMutateAsync.mockResolvedValue({});
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders branch selector and sends branchId for branch override toggle', async () => {
    renderWithQc(<ClinicalServicesPage />);
    expect(await screen.findByTestId('clinical-services-branch-scope')).toBeTruthy();
    fireEvent.change(screen.getByTestId('clinical-services-branch-scope'), {
      target: { value: 'branch-1' },
    });
    fireEvent.click(screen.getByText('clinicalCatalog.disable'));
    expect(upsertMutateAsync).toHaveBeenCalledWith({
      clinicalServiceId: 'svc-1',
      branchId: 'branch-1',
      enabled: false,
    });
  });

  it('tenant-default toggle omits branchId (null)', async () => {
    renderWithQc(<ClinicalServicesPage />);
    fireEvent.click(await screen.findByText('clinicalCatalog.disable'));
    expect(upsertMutateAsync).toHaveBeenCalledWith({
      clinicalServiceId: 'svc-1',
      branchId: null,
      enabled: false,
    });
  });

  it('shows inherited indicator for branch scope without override', async () => {
    renderWithQc(<ClinicalServicesPage />);
    fireEvent.change(await screen.findByTestId('clinical-services-branch-scope'), {
      target: { value: 'branch-1' },
    });
    expect(screen.getByText(/clinicalCatalog.scope.inherited/)).toBeTruthy();
  });
});

describe('ClinicalPricingPage branch scope (PA-05)', () => {
  beforeEach(() => {
    canViewBilling = true;
    useAuth.mockReturnValue({
      user: { tenantId: 'tenant-1', roles: ['clinic_admin'] },
    });
    useSettingsBranches.mockReturnValue({
      data: [{ id: 'branch-2', name: 'East', isActive: true }],
    });
    useClinicalServices.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [
        {
          id: 'svc-9',
          stableKey: 'canonical.general.procedure',
          provenance: 'SYSTEM_CANONICAL',
          domain: 'GENERAL',
          categoryKey: null,
          defaultDurationMin: 30,
          lifecycle: 'PUBLISHED',
          tenantId: null,
          translations: [{ locale: 'en', displayName: 'Procedure' }],
          createdAt: '',
          updatedAt: '',
        },
      ],
    });
    useClinicalPriceVersions.mockReturnValue({ isLoading: false, data: [] });
    createPriceMutateAsync.mockResolvedValue({});
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders branch selector and submits branch-scoped draft', async () => {
    renderWithQc(<ClinicalPricingPage />);
    expect(await screen.findByTestId('clinical-pricing-branch-scope')).toBeTruthy();
    fireEvent.change(screen.getByTestId('clinical-pricing-branch-scope'), {
      target: { value: 'branch-2' },
    });
    const selects = screen.getAllByRole('combobox');
    // 0 = branch scope, 1 = service, 2 = pricing unit
    fireEvent.change(selects[1], { target: { value: 'svc-9' } });
    const numberInputs = screen.getAllByRole('spinbutton');
    fireEvent.change(numberInputs[0], { target: { value: '25' } });
    fireEvent.click(screen.getByText('billing.clinicalPricing.saveDraft'));
    expect(createPriceMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicalServiceId: 'svc-9',
        branchId: 'branch-2',
        currency: 'SYP',
        pricingUnit: 'PER_VISIT',
        unitPrice: 25,
      }),
    );
  });
});
