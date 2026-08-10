/**
 * Step 16 route-level RTL + a11y coverage for subscription configuration routes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppProviders } from '../app/providers/AppProviders';
import { SUPER_ADMIN_LOCALE_STORAGE_KEY } from '../i18n/locale';
import {
  SubscriptionsListPage,
  SubscriptionCreatePage,
  SubscriptionDetailPage,
  SubscriptionPlanPage,
  SubscriptionAddOnsPage,
  SubscriptionOverridesPage,
  SubscriptionDatesPage,
  SubscriptionReadinessPage,
  SubscriptionPreviewPage,
  SubscriptionHistoryPage,
  SubscriptionComparePage,
  SubscriptionRuntimePage,
} from './subscriptions/SubscriptionsPages';

const listPlatformSubscriptions = vi.fn();
const createPlatformSubscription = vi.fn();
const getPlatformSubscription = vi.fn();
const getPlatformSubscriptionReadiness = vi.fn();
const getPlatformSubscriptionHistory = vi.fn();
const previewPlatformSubscription = vi.fn();
const comparePlatformSubscriptions = vi.fn();
const getPlatformSubscriptionRuntime = vi.fn();
const explainPlatformSubscriptionRuntime = vi.fn();
const listPlatformPlans = vi.fn();
const listPlatformPlanVersions = vi.fn();
const listPlatformAddOns = vi.fn();
const listPlatformAddOnVersions = vi.fn();
const listPlatformCommercialOverrides = vi.fn();

let permissions: string[] = [];

vi.mock('../auth/PlatformAuthProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../auth/PlatformAuthProvider')>();
  return {
    ...actual,
    usePlatformAuth: () => ({
      client: {
        listPlatformSubscriptions,
        createPlatformSubscription,
        getPlatformSubscription,
        getPlatformSubscriptionReadiness,
        getPlatformSubscriptionHistory,
        previewPlatformSubscription,
        comparePlatformSubscriptions,
        getPlatformSubscriptionRuntime,
        explainPlatformSubscriptionRuntime,
        listPlatformPlans,
        listPlatformPlanVersions,
        listPlatformAddOns,
        listPlatformAddOnVersions,
        listPlatformCommercialOverrides,
      },
      withAccessToken: async (fn: (token: string) => Promise<unknown>) => fn('token'),
      principal: { permissions },
    }),
  };
});

const subscriptionRow = {
  id: 'sub1',
  platformTenantId: 'tenant-1',
  platformSubscriptionId: null,
  lifecycle: 'DRAFT',
  isCurrent: true,
  rowVersion: 1,
  planVersionId: null,
  planCanonicalKey: null,
  planVersionNumber: null,
  planPublicationFingerprint: null,
  addonVersionIds: [],
  overrideIds: [],
  addonCount: 0,
  overrideCount: 0,
  commercialStart: null,
  commercialEnd: null,
  scheduledActivationAt: null,
  cancelledAt: null,
  cancellationEffectiveAt: null,
  commercialFingerprint: null,
  fingerprintSchemaVersion: null,
  predecessorId: null,
  hasSnapshot: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  runtimeEffective: false as const,
  disclaimer: 'Commercial configuration only.',
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

function assertNoRuntimeAssignmentActions() {
  expect(screen.queryByRole('button', { name: /Apply to Subscription|Save to Tenant/i })).toBeNull();
  expect(screen.queryByText(/Apply to Subscription/i)).toBeNull();
  expect(screen.queryByText(/Save to Tenant/i)).toBeNull();
  expect(screen.queryByText(/Step 17|billing/i)).toBeNull();
}

describe('Step 16 RTL + a11y — subscription routes', () => {
  beforeEach(() => {
    permissions = [];
    localStorage.setItem(SUPER_ADMIN_LOCALE_STORAGE_KEY, 'ar-SY');
    document.documentElement.lang = 'en-US';
    document.documentElement.dir = 'ltr';

    listPlatformSubscriptions.mockResolvedValue({ items: [], page: 1, pageSize: 50, total: 0 });
    getPlatformSubscription.mockResolvedValue(subscriptionRow);
    getPlatformSubscriptionReadiness.mockResolvedValue({
      status: 'blocked',
      blockers: [{ code: 'plan_version_required', message: 'Plan required' }],
      warnings: [],
      fingerprintAvailable: false,
      runtimeEffective: false,
      disclaimer: 'Commercial configuration only.',
    });
    getPlatformSubscriptionHistory.mockResolvedValue({
      items: [],
      runtimeEffective: false,
      disclaimer: 'Commercial configuration only.',
    });
    previewPlatformSubscription.mockResolvedValue({
      readiness: { status: 'blocked', blockers: [], warnings: [], fingerprintAvailable: false },
      composition: null,
      runtimeEffective: false,
      disclaimer: 'Static preview only.',
    });
    comparePlatformSubscriptions.mockResolvedValue({
      left: subscriptionRow,
      right: { ...subscriptionRow, id: 'sub2', lifecycle: 'SUPERSEDED' },
      differences: {
        planVersionChanged: false,
        addonsChanged: false,
        overridesChanged: false,
        datesChanged: false,
        lifecycleChanged: true,
      },
      runtimeEffective: false,
      disclaimer: 'Compare only.',
    });
    getPlatformSubscriptionRuntime.mockResolvedValue({
      source: 'LEGACY',
      code: 'legacy_runtime',
      lifecycle: 'DRAFT',
      moduleCount: 0,
      featureCount: 0,
      specialtyCount: 0,
      addonCount: 0,
      overrideCount: 0,
      limitsSummary: [],
      cacheStatus: 'MISS',
      evaluatedAt: '2026-01-01T00:00:00.000Z',
      blockers: [],
    });
    explainPlatformSubscriptionRuntime.mockResolvedValue({
      key: 'module.scheduling',
      catalogKind: 'MODULE',
      allowed: false,
      code: 'entitlement_denied',
      source: 'LEGACY',
      evaluatedAt: '2026-01-01T00:00:00.000Z',
      attribution: [],
    });
    listPlatformPlans.mockResolvedValue({ items: [], page: 1, pageSize: 100, total: 0 });
    listPlatformPlanVersions.mockResolvedValue({ items: [] });
    listPlatformAddOns.mockResolvedValue({ items: [], page: 1, pageSize: 100, total: 0, emptyCatalog: true });
    listPlatformAddOnVersions.mockResolvedValue({ items: [] });
    listPlatformCommercialOverrides.mockResolvedValue({ items: [], page: 1, pageSize: 50, total: 0 });
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
  }> = [
    {
      name: 'subscriptions list',
      path: '/subscriptions',
      routePath: '/subscriptions',
      element: <SubscriptionsListPage />,
      need: ['subscription.view'],
      denyText: /subscription\.view/i,
    },
    {
      name: 'subscriptions new',
      path: '/subscriptions/new',
      routePath: '/subscriptions/new',
      element: <SubscriptionCreatePage />,
      need: ['subscription.assign'],
      denyText: /subscription\.assign|permission|صلاحية/i,
      formLabels: [/معرّف مستأجر المنصة/i],
    },
    {
      name: 'subscriptions overview',
      path: '/subscriptions/sub1',
      routePath: '/subscriptions/:subscriptionId',
      element: <SubscriptionDetailPage />,
      need: ['subscription.view'],
      denyText: /subscription\.view/i,
    },
    {
      name: 'subscriptions plan',
      path: '/subscriptions/sub1/plan',
      routePath: '/subscriptions/:subscriptionId/plan',
      element: <SubscriptionPlanPage />,
      need: ['subscription.view'],
      denyText: /subscription\.view/i,
    },
    {
      name: 'subscriptions add-ons',
      path: '/subscriptions/sub1/add-ons',
      routePath: '/subscriptions/:subscriptionId/add-ons',
      element: <SubscriptionAddOnsPage />,
      need: ['subscription.view'],
      denyText: /subscription\.view/i,
    },
    {
      name: 'subscriptions overrides',
      path: '/subscriptions/sub1/overrides',
      routePath: '/subscriptions/:subscriptionId/overrides',
      element: <SubscriptionOverridesPage />,
      need: ['subscription.view'],
      denyText: /subscription\.view/i,
    },
    {
      name: 'subscriptions dates',
      path: '/subscriptions/sub1/dates',
      routePath: '/subscriptions/:subscriptionId/dates',
      element: <SubscriptionDatesPage />,
      need: ['subscription.view'],
      denyText: /subscription\.view/i,
    },
    {
      name: 'subscriptions readiness',
      path: '/subscriptions/sub1/readiness',
      routePath: '/subscriptions/:subscriptionId/readiness',
      element: <SubscriptionReadinessPage />,
      need: ['subscription.view'],
      denyText: /subscription\.view/i,
    },
    {
      name: 'subscriptions preview',
      path: '/subscriptions/sub1/preview',
      routePath: '/subscriptions/:subscriptionId/preview',
      element: <SubscriptionPreviewPage />,
      need: ['subscription.view'],
      denyText: /subscription\.view/i,
    },
    {
      name: 'subscriptions history',
      path: '/subscriptions/sub1/history',
      routePath: '/subscriptions/:subscriptionId/history',
      element: <SubscriptionHistoryPage />,
      need: ['subscription.view'],
      denyText: /subscription\.view/i,
    },
    {
      name: 'subscriptions compare',
      path: '/subscriptions/sub1/compare',
      routePath: '/subscriptions/:subscriptionId/compare',
      element: <SubscriptionComparePage />,
      need: ['subscription.view'],
      denyText: /subscription\.view/i,
    },
    {
      name: 'subscriptions runtime',
      path: '/subscriptions/sub1/runtime',
      routePath: '/subscriptions/:subscriptionId/runtime',
      element: <SubscriptionRuntimePage />,
      need: ['subscription.view'],
      denyText: /subscription\.view/i,
    },
  ];

  for (const routeCase of routeCases) {
    it(`RTL ${routeCase.name} denies without permission`, async () => {
      renderRtl(routeCase.path, routeCase.element, routeCase.routePath);
      expect(await screen.findByText(routeCase.denyText)).toBeTruthy();
      assertNoRuntimeAssignmentActions();
    });

    it(`RTL ${routeCase.name} renders with permission`, async () => {
      permissions = routeCase.need;
      renderRtl(routeCase.path, routeCase.element, routeCase.routePath);
      expect(await screen.findByRole('heading', { level: 1 })).toBeTruthy();
      assertNoRuntimeAssignmentActions();
      if (routeCase.formLabels) {
        for (const label of routeCase.formLabels) {
          expect(within(document.body).getByLabelText(label)).toBeTruthy();
        }
      }
    });
  }
});
