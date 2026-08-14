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
const inactivateMutateAsync = vi.fn();
const replaceMutateAsync = vi.fn();
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
  useInactivateClinicalPriceVersion: () => ({
    mutateAsync: inactivateMutateAsync,
    isPending: false,
  }),
  useReplaceScheduledClinicalPriceVersion: () => ({
    mutateAsync: replaceMutateAsync,
    isPending: false,
  }),
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
    inactivateMutateAsync.mockResolvedValue({});
    replaceMutateAsync.mockResolvedValue({});
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
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
    fireEvent.change(screen.getByTestId('clinical-pricing-effective-from'), {
      target: { value: '2026-09-01T10:00' },
    });
    fireEvent.change(screen.getByTestId('clinical-pricing-effective-to'), {
      target: { value: '2026-10-01T10:00' },
    });
    fireEvent.click(screen.getByText('billing.clinicalPricing.saveDraft'));
    expect(createPriceMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicalServiceId: 'svc-9',
        branchId: 'branch-2',
        currency: 'SYP',
        pricingUnit: 'PER_VISIT',
        unitPrice: 25,
        effectiveFrom: expect.any(String),
        effectiveTo: expect.any(String),
      }),
    );
    const payload = createPriceMutateAsync.mock.calls[0][0] as {
      effectiveFrom: string;
      effectiveTo: string;
    };
    expect(new Date(payload.effectiveTo).getTime()).toBeGreaterThan(
      new Date(payload.effectiveFrom).getTime(),
    );
  });

  it('rejects effectiveTo before effectiveFrom client-side', async () => {
    renderWithQc(<ClinicalPricingPage />);
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'svc-9' } });
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '10' } });
    fireEvent.change(screen.getByTestId('clinical-pricing-effective-from'), {
      target: { value: '2026-10-01T10:00' },
    });
    fireEvent.change(screen.getByTestId('clinical-pricing-effective-to'), {
      target: { value: '2026-09-01T10:00' },
    });
    fireEvent.click(screen.getByText('billing.clinicalPricing.saveDraft'));
    expect(createPriceMutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText('billing.clinicalPricing.effectiveToInvalid')).toBeTruthy();
  });

  it('UI-PA04-01 — SCHEDULED row distinct; cancel/replace present; supersede absent', async () => {
    useClinicalPriceVersions.mockReturnValue({
      isLoading: false,
      data: [
        {
          id: 'p-sched',
          clinicalServiceId: 'svc-9',
          branchId: null,
          pricingUnit: 'PER_VISIT',
          currency: 'SYP',
          unitPrice: 12,
          taxPercent: 0,
          effectiveFrom: '2026-12-01T00:00:00.000Z',
          effectiveTo: null,
          status: 'SCHEDULED',
        },
      ],
    });
    renderWithQc(<ClinicalPricingPage />);
    const scheduledRow = screen.getByTestId('price-row-SCHEDULED');
    expect(scheduledRow).toBeTruthy();
    expect(scheduledRow.getAttribute('data-status')).toBe('SCHEDULED');
    expect(scheduledRow.textContent).toContain('billing.clinicalPricing.status.SCHEDULED');
    expect(screen.getByTestId('cancel-scheduled')).toBeTruthy();
    expect(screen.getByTestId('replace-scheduled')).toBeTruthy();
    expect(screen.queryByText(/supersede/i)).toBeNull();
    expect(screen.queryByTestId('inactivate-active')).toBeNull();
  });

  it('UI-PA04-02 — cancel scheduled calls inactivate with row id', async () => {
    useClinicalPriceVersions.mockReturnValue({
      isLoading: false,
      data: [
        {
          id: 'p-sched-cancel',
          clinicalServiceId: 'svc-9',
          branchId: null,
          pricingUnit: 'PER_VISIT',
          currency: 'SYP',
          unitPrice: 12,
          taxPercent: 0,
          effectiveFrom: '2026-12-01T00:00:00.000Z',
          effectiveTo: null,
          status: 'SCHEDULED',
        },
      ],
    });
    renderWithQc(<ClinicalPricingPage />);
    fireEvent.click(screen.getByTestId('cancel-scheduled'));
    expect(inactivateMutateAsync).toHaveBeenCalledWith('p-sched-cancel');
  });

  it('UI-PA04-03 — controlled replace uses localized prompt and same-boundary payload', async () => {
    const promptSpy = vi.fn().mockReturnValue('42');
    vi.stubGlobal('prompt', promptSpy);
    useClinicalPriceVersions.mockReturnValue({
      isLoading: false,
      data: [
        {
          id: 'p-sched-replace',
          clinicalServiceId: 'svc-9',
          branchId: 'branch-2',
          pricingUnit: 'PER_VISIT',
          currency: 'SYP',
          unitPrice: 12,
          taxPercent: 5,
          effectiveFrom: '2026-12-01T00:00:00.000Z',
          effectiveTo: '2027-01-01T00:00:00.000Z',
          status: 'SCHEDULED',
        },
      ],
    });
    renderWithQc(<ClinicalPricingPage />);
    fireEvent.click(screen.getByTestId('replace-scheduled'));
    expect(promptSpy).toHaveBeenCalledWith(
      'billing.clinicalPricing.replacementUnitPricePrompt',
      '12',
    );
    expect(promptSpy.mock.calls[0][0]).not.toBe('Replacement unit price');
    expect(replaceMutateAsync).toHaveBeenCalledWith({
      canceledScheduleId: 'p-sched-replace',
      replacement: {
        clinicalServiceId: 'svc-9',
        branchId: 'branch-2',
        currency: 'SYP',
        pricingUnit: 'PER_VISIT',
        unitPrice: 42,
        taxPercent: 5,
        effectiveFrom: '2026-12-01T00:00:00.000Z',
        effectiveTo: '2027-01-01T00:00:00.000Z',
      },
    });
  });

  it('UI-PA04-04 — ACTIVE row exposes withdraw; supersede absent', async () => {
    useClinicalPriceVersions.mockReturnValue({
      isLoading: false,
      data: [
        {
          id: 'p-active',
          clinicalServiceId: 'svc-9',
          branchId: null,
          pricingUnit: 'PER_VISIT',
          currency: 'SYP',
          unitPrice: 12,
          taxPercent: 0,
          effectiveFrom: '2026-01-01T00:00:00.000Z',
          effectiveTo: null,
          status: 'ACTIVE',
        },
      ],
    });
    renderWithQc(<ClinicalPricingPage />);
    expect(screen.getByTestId('inactivate-active')).toBeTruthy();
    expect(screen.queryByTestId('cancel-scheduled')).toBeNull();
    expect(screen.queryByTestId('replace-scheduled')).toBeNull();
    expect(screen.queryByText(/supersede/i)).toBeNull();
    fireEvent.click(screen.getByTestId('inactivate-active'));
    expect(inactivateMutateAsync).toHaveBeenCalledWith('p-active');
  });
});
