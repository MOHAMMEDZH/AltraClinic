/**
 * Step 15 route-level RTL + a11y coverage for every Add-ons / Overrides /
 * Composition route family registered in route-registry.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppProviders } from '../app/providers/AppProviders';
import { SUPER_ADMIN_LOCALE_STORAGE_KEY } from '../i18n/locale';
import { AddOnsListPage } from './addons/AddOnsListPage';
import { AddOnCreatePage } from './addons/AddOnCreatePage';
import { AddOnDetailPage } from './addons/AddOnDetailPage';
import {
  AddOnVersionOverviewPage,
  AddOnVersionEntitlementsPage,
  AddOnVersionLimitsPage,
  AddOnVersionApplicabilityPage,
  AddOnVersionReadinessPage,
  AddOnVersionComparePage,
} from './addons/AddOnVersionPage';
import {
  OverridesListPage,
  OverrideCreatePage,
  OverrideDetailPage,
  OverrideReadinessPage,
  OverrideComparePage,
} from './addons/OverridesPages';
import { CompositionPreviewPage } from './addons/CompositionPreviewPage';

const listPlatformAddOns = vi.fn();
const createPlatformAddOn = vi.fn();
const getPlatformAddOn = vi.fn();
const listPlatformAddOnVersions = vi.fn();
const getPlatformAddOnVersion = vi.fn();
const getPlatformAddOnVersionReadiness = vi.fn();
const comparePlatformAddOnVersions = vi.fn();
const publishPlatformAddOnVersion = vi.fn();
const listPlatformCommercialOverrides = vi.fn();
const createPlatformCommercialOverride = vi.fn();
const getPlatformCommercialOverride = vi.fn();
const getPlatformCommercialOverrideReadiness = vi.fn();
const comparePlatformCommercialOverrides = vi.fn();
const approvePlatformCommercialOverride = vi.fn();
const listHealthcareCatalogItems = vi.fn();
const listPlatformPlans = vi.fn();
const previewPlatformCommercialComposition = vi.fn();

let permissions: string[] = [];

vi.mock('../auth/PlatformAuthProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../auth/PlatformAuthProvider')>();
  return {
    ...actual,
    usePlatformAuth: () => ({
      client: {
        listPlatformAddOns,
        createPlatformAddOn,
        getPlatformAddOn,
        listPlatformAddOnVersions,
        getPlatformAddOnVersion,
        getPlatformAddOnVersionReadiness,
        comparePlatformAddOnVersions,
        publishPlatformAddOnVersion,
        listPlatformCommercialOverrides,
        createPlatformCommercialOverride,
        getPlatformCommercialOverride,
        getPlatformCommercialOverrideReadiness,
        comparePlatformCommercialOverrides,
        approvePlatformCommercialOverride,
        listHealthcareCatalogItems,
        listPlatformPlans,
        previewPlatformCommercialComposition,
      },
      withAccessToken: async (fn: (token: string) => Promise<unknown>) => fn('token'),
      principal: { permissions },
    }),
  };
});

const draftVersion = {
  id: 'ver1',
  addOnId: 'ao1',
  versionNumber: 1,
  lifecycle: 'DRAFT',
  rowVersion: 1,
  publishedAt: null,
  publishedByPlatformUserId: null,
  publicationFingerprint: null,
  publicationReason: null,
  sourceVersionId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  translations: [
    { locale: 'en-US', releaseLabel: 'Draft', shortDescription: 'Draft version' },
    { locale: 'ar-SY', releaseLabel: 'مسودة', shortDescription: 'إصدار مسودة' },
  ],
  runtimeEffective: false as const,
  entitlements: [],
  limitEffects: [],
  applicability: [],
};

const addOnDetail = {
  id: 'ao1',
  canonicalKey: 'addon.sample',
  lifecycle: 'ACTIVE',
  rowVersion: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  translations: [
    { locale: 'en-US', displayName: 'Sample add-on', shortDescription: 'Sample' },
    { locale: 'ar-SY', displayName: 'إضافة عينة', shortDescription: 'عينة' },
  ],
  runtimeEffective: false as const,
};

const overrideRow = {
  id: 'ov1',
  lifecycle: 'PENDING_APPROVAL',
  rowVersion: 2,
  reasonCode: 'OTHER',
  reasonNote: 'note',
  effectiveFrom: null,
  expiresAt: null,
  createdByPlatformUserId: 'other-user',
  submittedByPlatformUserId: 'other-user',
  approvedByPlatformUserId: null,
  rejectedByPlatformUserId: null,
  revokedByPlatformUserId: null,
  predecessorId: null,
  effects: [],
  runtimeEffective: false as const,
  tenantAssignment: 'unavailable_until_step_16',
};

function renderRtl(path: string, element: React.ReactElement, routePath = path) {
  localStorage.setItem(SUPER_ADMIN_LOCALE_STORAGE_KEY, 'ar-SY');
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

function assertNoAssignmentActions() {
  expect(screen.queryByRole('button', { name: /Apply to Subscription|Save to Tenant/i })).toBeNull();
  expect(screen.queryByText(/Apply to Subscription/i)).toBeNull();
  expect(screen.queryByText(/Save to Tenant/i)).toBeNull();
}

describe('Step 15 RTL + a11y — every route family', () => {
  beforeEach(() => {
    permissions = [];
    localStorage.setItem(SUPER_ADMIN_LOCALE_STORAGE_KEY, 'ar-SY');
    document.documentElement.lang = 'en-US';
    document.documentElement.dir = 'ltr';

    listPlatformAddOns.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 50,
      total: 0,
      emptyCatalog: true,
    });
    listPlatformCommercialOverrides.mockResolvedValue({ items: [], page: 1, pageSize: 50, total: 0 });
    listHealthcareCatalogItems.mockResolvedValue({ items: [] });
    listPlatformPlans.mockResolvedValue({ items: [], page: 1, pageSize: 100, total: 0 });
    getPlatformAddOn.mockResolvedValue(addOnDetail);
    listPlatformAddOnVersions.mockResolvedValue({ items: [draftVersion] });
    getPlatformAddOnVersion.mockResolvedValue(draftVersion);
    getPlatformAddOnVersionReadiness.mockResolvedValue({
      status: 'ready',
      reason: 'ok',
      translationReady: true,
      entitlementCount: 0,
      limitEffectCount: 0,
      applicabilityCount: 0,
      publicationReady: true,
      blockers: [],
      runtimeEffective: false,
      emptyDefinitionAllowed: true,
    });
    comparePlatformAddOnVersions.mockResolvedValue({
      left: { id: 'ver1', versionNumber: 1, lifecycle: 'DRAFT' },
      right: { id: 'ver2', versionNumber: 2, lifecycle: 'PUBLISHED' },
      entitlementsAdded: [],
      entitlementsRemoved: [],
      runtimeEffective: false,
    });
    getPlatformCommercialOverride.mockResolvedValue(overrideRow);
    getPlatformCommercialOverrideReadiness.mockResolvedValue({
      status: 'ready',
      reason: 'ok',
      submitReady: true,
      blockers: [],
      runtimeEffective: false,
    });
    comparePlatformCommercialOverrides.mockResolvedValue({
      left: { id: 'ov1', lifecycle: 'PENDING_APPROVAL', fingerprint: null },
      right: { id: 'ov2', lifecycle: 'APPROVED', fingerprint: null },
      effectsAdded: [],
      effectsRemoved: [],
      runtimeEffective: false,
    });
    previewPlatformCommercialComposition.mockResolvedValue({
      disclaimer: 'static',
      runtimeEffective: false,
      entitlements: [],
      limits: [],
      layers: {
        baseEntitlementCount: 0,
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
  });

  afterEach(() => {
    cleanup();
    localStorage.removeItem(SUPER_ADMIN_LOCALE_STORAGE_KEY);
  });

  const routeCases: Array<{
    name: string;
    path: string;
    routePath: string;
    element: React.ReactElement;
    need: string[];
    denyText: RegExp;
    formLabels?: RegExp[];
    /** Accessible table column headers — must use role=columnheader (no text fallback). */
    columnHeaders?: RegExp[];
  }> = [
    {
      name: 'add-ons list',
      path: '/add-ons',
      routePath: '/add-ons',
      element: <AddOnsListPage />,
      need: ['addon.view'],
      denyText: /addon\.view/i,
    },
    {
      name: 'add-ons new',
      path: '/add-ons/new',
      routePath: '/add-ons/new',
      element: <AddOnCreatePage />,
      need: ['addon.manage'],
      denyText: /addon\.manage|permission|صلاحية/i,
      formLabels: [/المفتاح الأساسي/i, /اسم العرض \(en-US\)/i, /اسم العرض \(ar-SY\)/i],
    },
    {
      name: 'add-ons detail',
      path: '/add-ons/ao1',
      routePath: '/add-ons/:addOnId',
      element: <AddOnDetailPage />,
      need: ['addon.view'],
      denyText: /addon\.view/i,
    },
    {
      name: 'add-ons version overview',
      path: '/add-ons/ao1/versions/ver1',
      routePath: '/add-ons/:addOnId/versions/:versionId',
      element: <AddOnVersionOverviewPage />,
      need: ['addon.view'],
      denyText: /addon\.view/i,
    },
    {
      name: 'add-ons version entitlements',
      path: '/add-ons/ao1/versions/ver1/entitlements',
      routePath: '/add-ons/:addOnId/versions/:versionId/entitlements',
      element: <AddOnVersionEntitlementsPage />,
      need: ['addon.view'],
      denyText: /addon\.view/i,
      columnHeaders: [/اختيار/i],
    },
    {
      name: 'add-ons version limits',
      path: '/add-ons/ao1/versions/ver1/limits',
      routePath: '/add-ons/:addOnId/versions/:versionId/limits',
      element: <AddOnVersionLimitsPage />,
      need: ['addon.view'],
      denyText: /addon\.view/i,
      columnHeaders: [/نوع التأثير/i, /القيمة/i],
    },
    {
      name: 'add-ons version applicability',
      path: '/add-ons/ao1/versions/ver1/applicability',
      routePath: '/add-ons/:addOnId/versions/:versionId/applicability',
      element: <AddOnVersionApplicabilityPage />,
      need: ['addon.view'],
      denyText: /addon\.view/i,
    },
    {
      name: 'add-ons version readiness',
      path: '/add-ons/ao1/versions/ver1/readiness',
      routePath: '/add-ons/:addOnId/versions/:versionId/readiness',
      element: <AddOnVersionReadinessPage />,
      need: ['addon.view'],
      denyText: /addon\.view/i,
    },
    {
      name: 'add-ons version compare',
      path: '/add-ons/ao1/versions/ver1/compare',
      routePath: '/add-ons/:addOnId/versions/:versionId/compare',
      element: <AddOnVersionComparePage />,
      need: ['addon.view'],
      denyText: /addon\.view/i,
    },
    {
      name: 'overrides list',
      path: '/commercial-overrides',
      routePath: '/commercial-overrides',
      element: <OverridesListPage />,
      need: ['override.view'],
      denyText: /override\.view/i,
    },
    {
      name: 'overrides new',
      path: '/commercial-overrides/new',
      routePath: '/commercial-overrides/new',
      element: <OverrideCreatePage />,
      need: ['override.request'],
      denyText: /override\.request|permission|صلاحية/i,
      formLabels: [/رمز السبب/i, /ملاحظة السبب/i, /ساري من/i, /ينتهي في/i],
    },
    {
      name: 'overrides detail',
      path: '/commercial-overrides/ov1',
      routePath: '/commercial-overrides/:overrideId',
      element: <OverrideDetailPage />,
      need: ['override.view'],
      denyText: /override\.view/i,
    },
    {
      name: 'overrides readiness',
      path: '/commercial-overrides/ov1/readiness',
      routePath: '/commercial-overrides/:overrideId/readiness',
      element: <OverrideReadinessPage />,
      need: ['override.view'],
      denyText: /override\.view/i,
    },
    {
      name: 'overrides compare',
      path: '/commercial-overrides/ov1/compare',
      routePath: '/commercial-overrides/:overrideId/compare',
      element: <OverrideComparePage />,
      need: ['override.view'],
      denyText: /override\.view/i,
    },
    {
      name: 'composition preview',
      path: '/commercial-composition/preview',
      routePath: '/commercial-composition/preview',
      element: <CompositionPreviewPage />,
      need: ['addon.view'],
      denyText: /permission|plan\.view|addon\.view|override\.view|صلاحية/i,
      formLabels: [/معرّف إصدار الخطة/i, /معرّفات إصدارات الإضافة/i, /معرّفات التجاوز/i],
    },
  ];

  for (const c of routeCases) {
    it(`${c.name}: permission gate when empty perms (rtl)`, async () => {
      permissions = [];
      renderRtl(c.path, c.element, c.routePath);
      expect(await screen.findByText(c.denyText)).toBeTruthy();
      expect(document.documentElement.dir).toBe('rtl');
      expect(document.documentElement.lang).toBe('ar-SY');
      assertNoAssignmentActions();
    });

    it(`${c.name}: one H1, no assignment actions when permitted (rtl)`, async () => {
      permissions = c.need;
      renderRtl(c.path, c.element, c.routePath);
      const h1s = await screen.findAllByRole('heading', { level: 1 });
      expect(h1s.length).toBe(1);
      expect(document.documentElement.dir).toBe('rtl');
      expect(document.documentElement.lang).toBe('ar-SY');
      assertNoAssignmentActions();
      if (c.columnHeaders) {
        for (const name of c.columnHeaders) {
          expect(await screen.findByRole('columnheader', { name })).toBeTruthy();
        }
      }
      if (c.formLabels) {
        for (const label of c.formLabels) {
          expect(await screen.findByText(label)).toBeTruthy();
        }
      }
    });
  }

  it('add-ons version entitlements: column header accessible name (ltr)', async () => {
    permissions = ['addon.view'];
    localStorage.setItem(SUPER_ADMIN_LOCALE_STORAGE_KEY, 'en-US');
    document.documentElement.lang = 'en-US';
    document.documentElement.dir = 'ltr';
    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/add-ons/ao1/versions/ver1/entitlements']}>
          <Routes>
            <Route
              path="/add-ons/:addOnId/versions/:versionId/entitlements"
              element={<AddOnVersionEntitlementsPage />}
            />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );
    expect(await screen.findByRole('columnheader', { name: /select/i })).toBeTruthy();
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('en-US');
  });

  it('publish uses ConfirmationDialog, not window.confirm (rtl)', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    permissions = ['addon.view', 'addon.manage'];
    renderRtl(
      '/add-ons/ao1/versions/ver1',
      <AddOnVersionOverviewPage />,
      '/add-ons/:addOnId/versions/:versionId',
    );

    const publishBtn = await screen.findByRole('button', { name: /Publish|نشر/i });
    fireEvent.click(publishBtn);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(within(dialog).getByRole('heading', { level: 2 })).toBeTruthy();
    expect(confirmSpy).not.toHaveBeenCalled();
    assertNoAssignmentActions();
    confirmSpy.mockRestore();
  });

  it('approve uses ConfirmationDialog, not window.confirm (rtl)', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    permissions = ['override.view', 'override.approve'];
    renderRtl(
      '/commercial-overrides/ov1',
      <OverrideDetailPage />,
      '/commercial-overrides/:overrideId',
    );

    const approveBtn = await screen.findByRole('button', { name: /Approve|موافقة/i });
    fireEvent.click(approveBtn);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(confirmSpy).not.toHaveBeenCalled();
    assertNoAssignmentActions();
    confirmSpy.mockRestore();
  });
});
