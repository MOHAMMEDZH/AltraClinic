import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppProviders } from '../app/providers/AppProviders';
import { AddOnsListPage } from './addons/AddOnsListPage';
import { OverrideDetailPage } from './addons/OverridesPages';
import { CompositionPreviewPage } from './addons/CompositionPreviewPage';
import { STATIC_COMMERCIAL_PREVIEW_WARNING } from './addons/addons-shared';

const listPlatformAddOns = vi.fn();
const getPlatformCommercialOverride = vi.fn();
const getPlatformCommercialOverrideReadiness = vi.fn();
const listPlatformCommercialOverrides = vi.fn();
const approvePlatformCommercialOverride = vi.fn();
const previewPlatformCommercialComposition = vi.fn();
const listHealthcareCatalogItems = vi.fn();

let permissions: string[] = ['addon.view'];

vi.mock('../auth/PlatformAuthProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../auth/PlatformAuthProvider')>();
  return {
    ...actual,
    usePlatformAuth: () => ({
      client: {
        listPlatformAddOns,
        getPlatformCommercialOverride,
        getPlatformCommercialOverrideReadiness,
        listPlatformCommercialOverrides,
        approvePlatformCommercialOverride,
        previewPlatformCommercialComposition,
        listHealthcareCatalogItems,
      },
      withAccessToken: async (fn: (token: string) => Promise<unknown>) => fn('token'),
      principal: { permissions },
    }),
  };
});

describe('Step 15 — Add-ons / Overrides / Composition', () => {
  beforeEach(() => {
    permissions = ['addon.view'];
    listPlatformAddOns.mockReset();
    getPlatformCommercialOverride.mockReset();
    getPlatformCommercialOverrideReadiness.mockReset();
    listPlatformCommercialOverrides.mockReset();
    approvePlatformCommercialOverride.mockReset();
    previewPlatformCommercialComposition.mockReset();
    listHealthcareCatalogItems.mockResolvedValue({ items: [] });
    listPlatformAddOns.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 50,
      total: 0,
      emptyCatalog: true,
    });
  });

  afterEach(() => cleanup());

  it('gates add-ons list on addon.view', async () => {
    permissions = [];
    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/add-ons']}>
          <Routes>
            <Route path="/add-ons" element={<AddOnsListPage />} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    expect(await screen.findByText(/addon\.view permission/i)).toBeTruthy();
    expect(listPlatformAddOns).not.toHaveBeenCalled();
  });

  it('requires override.approve for the approve button', async () => {
    permissions = ['override.view', 'override.request'];
    getPlatformCommercialOverride.mockResolvedValue({
      id: 'ov1',
      lifecycle: 'PENDING_APPROVAL',
      rowVersion: 2,
      reasonCode: 'OTHER',
      reasonNote: 'note',
      effectiveFrom: null,
      expiresAt: null,
      effects: [],
      runtimeEffective: false,
      tenantAssignment: 'unavailable_until_step_16',
    });
    getPlatformCommercialOverrideReadiness.mockResolvedValue({
      status: 'ready',
      reason: 'ok',
      submitReady: true,
      blockers: [],
      runtimeEffective: false,
    });
    listPlatformCommercialOverrides.mockResolvedValue({ items: [], page: 1, pageSize: 50, total: 0 });

    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/commercial-overrides/ov1']}>
          <Routes>
            <Route path="/commercial-overrides/:overrideId" element={<OverrideDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    expect(await screen.findByText(/Approve requires override\.approve permission/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Approve$/i })).toBeNull();

    permissions = ['override.view', 'override.approve'];
    cleanup();
    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/commercial-overrides/ov1']}>
          <Routes>
            <Route path="/commercial-overrides/:overrideId" element={<OverrideDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    expect(await screen.findByRole('button', { name: /^Approve$/i })).toBeTruthy();
  });

  it('shows static commercial warning and never offers Apply to Subscription', async () => {
    permissions = ['addon.view', 'plan.view'];
    previewPlatformCommercialComposition.mockResolvedValue({
      disclaimer: STATIC_COMMERCIAL_PREVIEW_WARNING,
      runtimeEffective: false,
      entitlements: ['module.scheduling'],
      limits: [{ canonicalKey: 'limit.max_users', unlimited: false, valueText: '10' }],
      layers: {
        baseEntitlementCount: 1,
        addonGrantedCount: 0,
        overrideGrantedCount: 0,
        overrideSuppressedCount: 0,
      },
      planCanonicalKey: 'plan.lite',
      planVersionId: 'pv1',
      planVersionLifecycle: 'PUBLISHED',
      addonVersionIds: [],
      overrideIds: [],
      licensingEngineCalled: false,
    });

    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/commercial-composition/preview']}>
          <Routes>
            <Route path="/commercial-composition/preview" element={<CompositionPreviewPage />} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    expect(await screen.findByTestId('static-commercial-preview-warning')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Apply to Subscription/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Save to Tenant/i })).toBeNull();

    fireEvent.change(screen.getByLabelText(/Plan version id/i), { target: { value: 'pv1' } });
    fireEvent.submit(screen.getByRole('button', { name: /Run preview/i }).closest('form')!);

    await waitFor(() => {
      expect(previewPlatformCommercialComposition).toHaveBeenCalledWith(
        'token',
        expect.objectContaining({ planVersionId: 'pv1' }),
      );
    });
    expect(screen.queryByRole('button', { name: /Apply to Subscription/i })).toBeNull();
    expect(await screen.findByText('module.scheduling')).toBeTruthy();
  });

  it('renders list H1 without create control when addon.manage is absent', async () => {
    permissions = ['addon.view'];
    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/add-ons']}>
          <Routes>
            <Route path="/add-ons" element={<AddOnsListPage />} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );
    expect(await screen.findByRole('heading', { level: 1 })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Create add-on/i })).toBeNull();
    expect(await screen.findByText(/Commercial definition only/i)).toBeTruthy();
    expect(screen.queryByText(/Apply to Subscription|Save to Tenant/i)).toBeNull();
  });

  it('deep-link without permission shows gate and does not flash restricted list content', async () => {
    permissions = [];
    listPlatformAddOns.mockResolvedValue({
      items: [{ id: 'secret', canonicalKey: 'addon.secret', lifecycle: 'ACTIVE' }],
      page: 1,
      pageSize: 50,
      total: 1,
      emptyCatalog: false,
    });
    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/add-ons']}>
          <Routes>
            <Route path="/add-ons" element={<AddOnsListPage />} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );
    expect(await screen.findByText(/addon\.view permission/i)).toBeTruthy();
    expect(screen.queryByText('addon.secret')).toBeNull();
    expect(listPlatformAddOns).not.toHaveBeenCalled();
  });

  it('composition rejects empty plan version id and keeps warning visible', async () => {
    permissions = ['addon.view', 'plan.view'];
    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/commercial-composition/preview']}>
          <Routes>
            <Route path="/commercial-composition/preview" element={<CompositionPreviewPage />} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );
    expect(await screen.findByTestId('static-commercial-preview-warning')).toBeTruthy();
    fireEvent.submit(screen.getByRole('button', { name: /Run preview/i }).closest('form')!);
    expect(previewPlatformCommercialComposition).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Apply to Subscription/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Save to Tenant/i })).toBeNull();
  });

  it('override approve confirmation path does not use window.confirm', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    permissions = ['override.view', 'override.approve'];
    getPlatformCommercialOverride.mockResolvedValue({
      id: 'ov1',
      lifecycle: 'PENDING_APPROVAL',
      rowVersion: 2,
      reasonCode: 'OTHER',
      reasonNote: 'note',
      effectiveFrom: null,
      expiresAt: null,
      effects: [],
      runtimeEffective: false,
      tenantAssignment: 'unavailable_until_step_16',
    });
    getPlatformCommercialOverrideReadiness.mockResolvedValue({
      status: 'ready',
      reason: 'ok',
      submitReady: true,
      blockers: [],
      runtimeEffective: false,
    });
    approvePlatformCommercialOverride.mockResolvedValue({
      id: 'ov1',
      lifecycle: 'APPROVED',
      rowVersion: 3,
    });

    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/commercial-overrides/ov1']}>
          <Routes>
            <Route path="/commercial-overrides/:overrideId" element={<OverrideDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    const approveBtn = await screen.findByRole('button', { name: /^Approve$/i });
    fireEvent.click(approveBtn);
    // ConfirmationDialog (if present) or direct action — never window.confirm
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
