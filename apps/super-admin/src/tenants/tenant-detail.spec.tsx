import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppProviders } from '../app/providers/AppProviders';
import { TenantDetailPage } from '../pages/TenantDetailPage';
import { SectionExplanation } from './SectionExplanation';
import type { TenantDetailResponse } from './types';

const getPlatformTenantDetail = vi.fn();
const getTenantLifecycle = vi.fn();

vi.mock('../auth/PlatformAuthProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../auth/PlatformAuthProvider')>();
  return {
    ...actual,
    usePlatformAuth: () => ({
      client: { getPlatformTenantDetail, getTenantLifecycle },
      withAccessToken: async (fn: (token: string) => Promise<unknown>) => fn('token'),
      principal: { permissions: ['tenant.view', 'plan.view', 'subscription.view', 'entitlement.view'] },
    }),
  };
});

function detailPayload(overrides: Partial<TenantDetailResponse> = {}): TenantDetailResponse {
  return {
    generatedAt: new Date().toISOString(),
    banner: {
      displayName: 'Alpha Clinic',
      platformTenantId: 'pt-1',
      status: 'ACTIVE',
      region: 'ME_SOUTH',
      messageKey: 'tenantDetail.banner.readOnly',
    },
    identity: {
      id: 'identity',
      availability: 'available',
      platformTenantId: 'pt-1',
      tenantId: 't-1',
      displayName: 'Alpha Clinic',
      slug: 'alpha',
      tenantName: 'Alpha Clinic',
      status: 'ACTIVE',
      region: 'ME_SOUTH',
      trialEndsAt: null,
      activatedAt: null,
      suspendedAt: null,
      archivedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      readOnlyPlatformView: true,
    },
    facilityProfile: {
      id: 'facilityProfile',
      availability: 'available',
      facilityType: 'medical',
      specialties: { id: 'specialties', availability: 'unavailable', reasonCode: 'step12_catalog' },
    },
    contacts: { id: 'contacts', availability: 'unavailable', reasonCode: 'no_phi_in_step11' },
    commercial: {
      legacyPlan: { id: 'legacyPlan', availability: 'available_legacy', plan: 'LITE' },
      planVersion: { id: 'planVersion', availability: 'unavailable', reasonCode: 'step13_plans' },
      subscription: {
        id: 'subscription',
        availability: 'available',
        history: [{
          id: 'sub-1',
          status: 'ACTIVE',
          plan: 'LITE',
          startDate: '2026-01-01',
          endDate: '2027-01-01',
          createdAt: '2026-01-01T00:00:00.000Z',
          primaryForLicensing: true,
        }],
      },
      addons: { id: 'addons', availability: 'unavailable', reasonCode: 'step15_addons' },
      overrides: { id: 'overrides', availability: 'unavailable', reasonCode: 'step15_overrides' },
    },
    access: {
      availability: 'available',
      modules: [{ key: 'patients', kind: 'module', decision: 'enabled', availability: 'available' }],
      limits: [
        { key: 'maxUsers', kind: 'limit', value: null, unlimited: true, availability: 'available' },
        { key: 'maxReportsPerMonth', kind: 'limit', value: null, unlimited: false, availability: 'available' },
      ],
    },
    operations: { id: 'operations', availability: 'unavailable', reasonCode: 'operations_console_deferred' },
    sales: { id: 'sales', availability: 'unavailable', reasonCode: 'step23_sales' },
    auditLink: { id: 'auditLink', availability: 'available', reasonCode: 'audit_route_step21' },
    warnings: [],
    ...overrides,
  };
}

function renderDetail() {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={['/tenants/pt-1']}>
        <Routes>
          <Route path="/tenants/:tenantId" element={<TenantDetailPage />} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('TenantDetailPage', () => {
  beforeEach(() => {
    getPlatformTenantDetail.mockResolvedValue(detailPayload());
    // Step 19 panel is mounted on detail; default containment OFF (buttons present but disabled).
    getTenantLifecycle.mockResolvedValue({
      status: 'ACTIVE',
      displayName: 'Alpha Clinic',
      rowVersion: 1,
      lifecycleEnabled: false,
      pendingRequests: [],
    });
  });

  afterEach(() => {
    cleanup();
  });

  async function waitForDetail() {
    expect(await screen.findByText(/Read-only platform view/i)).toBeTruthy();
  }

  it('renders read-only banner text', async () => {
    renderDetail();
    expect(await screen.findByText(/Read-only platform view/i)).toBeTruthy();
    expect(screen.getByText(/No clinical data or contact PHI/i)).toBeTruthy();
  });

  it('does not render mutation buttons', async () => {
    renderDetail();
    await waitForDetail();
    await screen.findByRole('heading', { name: /Lifecycle actions/i });
    // Step 19 lifecycle controls may render when tenant.view is granted, but must stay disabled
    // while TENANT_LIFECYCLE_ENABLED is false. No legacy provision control.
    const suspend = screen.getByRole('button', { name: /suspend/i }) as HTMLButtonElement;
    expect(suspend.disabled).toBe(true);
    const archive = screen.queryByRole('button', { name: /request archival/i }) as HTMLButtonElement | null;
    if (archive) expect(archive.disabled).toBe(true);
    expect(screen.queryByRole('button', { name: /^provision$/i })).toBeNull();
  });

  it('does not render specialties free text when unavailable', async () => {
    renderDetail();
    await waitForDetail();
    expect(screen.queryByText(/cardiology/i)).toBeNull();
    expect(screen.getByTestId('section-explanation-facilityProfile')).toBeTruthy();
  });

  it('shows unavailable badges for plan version, add-ons, and overrides', async () => {
    renderDetail();
    await waitForDetail();
    expect(screen.getAllByRole('heading', { name: /Plan version/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: /Add-ons/i })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Overrides/i })).toBeTruthy();
    expect(screen.getAllByText(/Unavailable/i).length).toBeGreaterThan(0);
  });

  it('shows access modules with source labels when entitlement.view is granted', async () => {
    renderDetail();
    await waitForDetail();
    const patients = screen.getByText(/patients:/i);
    expect(patients).toBeTruthy();
    expect(patients.textContent || '').toMatch(/enabled/i);
  });

  it('presents unlimited and unknown limits distinctly', async () => {
    renderDetail();
    await waitForDetail();
    expect(screen.getByText(/Unlimited/i)).toBeTruthy();
    expect(screen.getAllByText(/Unknown/i).length).toBeGreaterThan(0);
  });

  it('shows permission_limited access section without entitlement.view', async () => {
    getPlatformTenantDetail.mockResolvedValue(
      detailPayload({
        access: { id: 'access', availability: 'permission_limited', reasonCode: 'missing_entitlement_view' },
      }),
    );
    renderDetail();
    await waitForDetail();
    expect(screen.getByTestId('section-explanation-access')).toBeTruthy();
    expect(screen.getAllByText(/Permission limited/i).length).toBeGreaterThan(0);
  });
});

describe('SectionExplanation keyboard interaction', () => {
  afterEach(() => {
    cleanup();
  });

  it('opens on click and returns focus to summary', () => {
    render(
      <AppProviders>
        <SectionExplanation sectionId="access" availability="permission_limited" reasonCode="missing_entitlement_view" />
      </AppProviders>,
    );
    const summary = screen.getByTestId('section-explanation-access').querySelector('summary')!;
    summary.focus();
    fireEvent.click(summary);
    expect(screen.getByText(/Permission limited/i)).toBeTruthy();
    summary.focus();
    expect(document.activeElement).toBe(summary);
  });
});
