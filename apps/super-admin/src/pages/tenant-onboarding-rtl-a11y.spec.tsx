/**
 * Flexible Step 17 — Super Admin onboarding RTL, a11y, and mobile evidence.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppProviders } from '../app/providers/AppProviders';
import { SUPER_ADMIN_LOCALE_STORAGE_KEY } from '../i18n/locale';
import { PlatformAuthApiError } from '../auth/platform-auth-api';
import { TenantOnboardingDetailPage, TenantOnboardingPage } from './TenantOnboardingPage';

const validateTenantProvisioning = vi.fn();
const createTenantProvisioningRequest = vi.fn();
const getTenantProvisioningRequest = vi.fn();
const startTenantProvisioning = vi.fn();
const retryTenantProvisioning = vi.fn();
const activateTenantProvisioning = vi.fn();
const compensateTenantProvisioning = vi.fn();

let permissions: string[] = [
  'tenant.provision.view',
  'tenant.provision.create',
  'tenant.provision.execute',
  'tenant.provision.retry',
  'tenant.provision.compensate',
  'tenant.provision.activate',
];

vi.mock('../auth/PlatformAuthProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../auth/PlatformAuthProvider')>();
  return {
    ...actual,
    usePlatformAuth: () => ({
      client: {
        validateTenantProvisioning,
        createTenantProvisioningRequest,
        getTenantProvisioningRequest,
        startTenantProvisioning,
        retryTenantProvisioning,
        activateTenantProvisioning,
        compensateTenantProvisioning,
      },
      withAccessToken: async (fn: (token: string) => Promise<unknown>) => fn('token'),
      principal: { permissions },
    }),
  };
});

const progressFixture = {
  id: 'req-1',
  status: 'AWAITING_ACTIVATION',
  rowVersion: 3,
  organizationName: 'Clinic Alpha',
  facilityTypeKey: 'facility_type.general_clinic',
  specialtyKeys: ['specialty.general_medicine'],
  publishedPlanVersionId: 'pv-1',
  previewFingerprint: 'abc123fingerprint',
  lastErrorCode: null as string | null,
  tenantId: 'tenant-1',
  checkpoints: [
    { key: 'request_accepted', status: 'COMPLETED', completedAt: '2026-07-01T00:00:00.000Z' },
    { key: 'workflow_completed', status: 'PENDING', completedAt: null },
  ],
};

function renderPath(path: string, element: React.ReactElement, routePath = path) {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={routePath} element={element} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('Step 17 onboarding — RTL, a11y, mobile', () => {
  beforeEach(() => {
    permissions = [
      'tenant.provision.view',
      'tenant.provision.create',
      'tenant.provision.execute',
      'tenant.provision.retry',
      'tenant.provision.compensate',
      'tenant.provision.activate',
    ];
    localStorage.setItem(SUPER_ADMIN_LOCALE_STORAGE_KEY, 'en-US');
    document.documentElement.lang = 'en-US';
    document.documentElement.dir = 'ltr';
    validateTenantProvisioning.mockReset();
    createTenantProvisioningRequest.mockReset();
    getTenantProvisioningRequest.mockReset();
    startTenantProvisioning.mockReset();
    retryTenantProvisioning.mockReset();
    activateTenantProvisioning.mockReset();
    compensateTenantProvisioning.mockReset();
    getTenantProvisioningRequest.mockResolvedValue(progressFixture);
  });

  afterEach(() => {
    cleanup();
  });

  it('form: one H1, fieldsets/legends, visible labels', () => {
    renderPath('/tenants/onboarding', <TenantOnboardingPage />);
    expect(screen.getAllByRole('heading', { level: 1 }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Organization/i)).toBeTruthy();
    expect(screen.getByLabelText(/Legal or display name/i)).toBeTruthy();
    expect(screen.getByLabelText(/Facility type key/i)).toBeTruthy();
    expect(screen.getByLabelText(/^Email$/i)).toBeTruthy();
    expect(document.body.innerHTML).not.toMatch(/<script/i);
  });

  it('validation errors surface without unsafe HTML', async () => {
    validateTenantProvisioning.mockResolvedValue({
      valid: false,
      errors: [{ code: 'invalid_admin_email', field: 'tenantAdmin.email' }],
      warnings: [],
    });
    renderPath('/tenants/onboarding', <TenantOnboardingPage />);
    fireEvent.change(screen.getByLabelText(/Legal or display name/i), {
      target: { value: 'Clinic A' },
    });
    fireEvent.change(screen.getByLabelText(/Published Plan Version ID/i), {
      target: { value: 'pv-1' },
    });
    fireEvent.change(screen.getByLabelText(/^Email$/i), { target: { value: 'bad@x.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Validate/i }));
    await waitFor(() => {
      expect(screen.getByText('Invalid')).toBeTruthy();
      expect(screen.getByText('invalid_admin_email')).toBeTruthy();
    });
    expect(document.body.innerHTML).not.toMatch(/<script|javascript:/i);
  });

  it('compatibility preview shows fingerprint when valid', async () => {
    validateTenantProvisioning.mockResolvedValue({
      valid: true,
      errors: [],
      warnings: [],
      previewFingerprint: 'deadbeefcafebabe0123456789abcdef',
    });
    renderPath('/tenants/onboarding', <TenantOnboardingPage />);
    fireEvent.change(screen.getByLabelText(/Legal or display name/i), {
      target: { value: 'Clinic B' },
    });
    fireEvent.change(screen.getByLabelText(/Published Plan Version ID/i), {
      target: { value: 'pv-1' },
    });
    fireEvent.change(screen.getByLabelText(/^Email$/i), {
      target: { value: 'admin@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Validate/i }));
    await waitFor(() => {
      expect(screen.getByText('Valid')).toBeTruthy();
      expect(screen.getByText(/Preview fingerprint/i)).toBeTruthy();
    });
  });

  it('RTL ar-SY: form layout and labels', () => {
    localStorage.setItem(SUPER_ADMIN_LOCALE_STORAGE_KEY, 'ar-SY');
    renderPath('/tenants/onboarding', <TenantOnboardingPage />);
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar-SY');
    expect(screen.getByText(/المؤسسة/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /تحقق/i })).toBeTruthy();
  });

  it('progress page: accessible status and checkpoint timeline', async () => {
    renderPath('/tenants/onboarding/req-1', <TenantOnboardingDetailPage />, '/tenants/onboarding/:requestId');
    await waitFor(() => {
      expect(screen.getByRole('status')).toBeTruthy();
      expect(screen.getByText(/AWAITING_ACTIVATION/)).toBeTruthy();
    });
    const list = screen.getByRole('list');
    expect(within(list).getByText(/request_accepted/)).toBeTruthy();
    expect(screen.getByLabelText(/Reason/i)).toBeTruthy();
  });

  it('RTL progress timeline', async () => {
    localStorage.setItem(SUPER_ADMIN_LOCALE_STORAGE_KEY, 'ar-SY');
    renderPath('/tenants/onboarding/req-1', <TenantOnboardingDetailPage />, '/tenants/onboarding/:requestId');
    await waitFor(() => {
      expect(document.documentElement.dir).toBe('rtl');
      expect(screen.getByRole('status')).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: /تفعيل/i })).toBeTruthy();
  });

  it('step-up required message on activate', async () => {
    activateTenantProvisioning.mockImplementation(async () => {
      throw new PlatformAuthApiError('Fresh step-up required.', 403, 'PLATFORM_STEP_UP_REQUIRED');
    });
    renderPath('/tenants/onboarding/req-1', <TenantOnboardingDetailPage />, '/tenants/onboarding/:requestId');
    const activate = await screen.findByRole('button', { name: /Activate/i });
    fireEvent.click(activate);
    await waitFor(() => {
      expect(activateTenantProvisioning).toHaveBeenCalled();
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.getByRole('alert').textContent ?? '').toMatch(
        /Fresh step-up verification is required|Fresh step-up required/,
      );
    });
  });

  it('safe error on rate limit / API failure', async () => {
    getTenantProvisioningRequest.mockRejectedValue(
      new PlatformAuthApiError('Too many requests.', 429, 'rate_limited'),
    );
    renderPath('/tenants/onboarding/req-1', <TenantOnboardingDetailPage />, '/tenants/onboarding/:requestId');
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent ?? '').toMatch(/Too many requests|Request failed/);
    });
    expect(document.body.innerHTML).not.toMatch(/stack|Prisma|SELECT /i);
  });

  it('mobile viewport: form remains usable', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });
    renderPath('/tenants/onboarding', <TenantOnboardingPage />);
    expect(screen.getByLabelText(/Legal or display name/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Validate/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Create request/i })).toBeTruthy();
  });

  it('mobile Arabic progress', async () => {
    localStorage.setItem(SUPER_ADMIN_LOCALE_STORAGE_KEY, 'ar-SY');
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    renderPath('/tenants/onboarding/req-1', <TenantOnboardingDetailPage />, '/tenants/onboarding/:requestId');
    await waitFor(() => {
      expect(document.documentElement.dir).toBe('rtl');
      expect(screen.getByRole('button', { name: /إعادة المحاولة/i })).toBeTruthy();
    });
  });

  it('long canonical keys remain visible (untranslated)', async () => {
    getTenantProvisioningRequest.mockResolvedValue({
      ...progressFixture,
      facilityTypeKey: 'facility_type.very_long_canonical_key_for_layout_proof',
      specialtyKeys: ['specialty.very_long_canonical_specialty_key_for_layout'],
      checkpoints: [
        {
          key: 'administrator_invitation_prepared',
          status: 'COMPLETED',
          completedAt: '2026-07-01T00:00:00.000Z',
        },
      ],
    });
    renderPath('/tenants/onboarding/req-1', <TenantOnboardingDetailPage />, '/tenants/onboarding/:requestId');
    await waitFor(() => {
      expect(screen.getByText(/administrator_invitation_prepared/)).toBeTruthy();
    });
  });
});
