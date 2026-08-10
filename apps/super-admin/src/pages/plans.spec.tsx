import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppProviders } from '../app/providers/AppProviders';
import { PlansPage } from './PlansPage';
import { PlanDetailPage } from './plans/PlanDetailPage';
import { PlanVersionEditPage } from './plans/PlanVersionEditPage';
import { PlanVersionComparePage } from './plans/PlanVersionDetailPage';
import { PlanLegacyMappingsPage } from './plans/PlanLegacyMappingsPage';

const listPlatformPlans = vi.fn();
const getPlatformPlan = vi.fn();
const getPlatformPlanReferences = vi.fn();
const listPlatformPlanVersions = vi.fn();
const getPlatformPlanVersion = vi.fn();
const comparePlatformPlanVersions = vi.fn();
const getPlatformPlanLegacyMappings = vi.fn();

let permissions: string[] = [
  'plan.view',
  'plan.create',
  'plan-version.view',
  'plan-version.create',
];

vi.mock('../auth/PlatformAuthProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../auth/PlatformAuthProvider')>();
  return {
    ...actual,
    usePlatformAuth: () => ({
      client: {
        listPlatformPlans,
        getPlatformPlan,
        getPlatformPlanReferences,
        listPlatformPlanVersions,
        getPlatformPlanVersion,
        comparePlatformPlanVersions,
        getPlatformPlanLegacyMappings,
        createPlatformPlan: vi.fn(),
        createPlatformPlanDraftVersion: vi.fn(),
        publishPlatformPlanVersion: vi.fn(),
      },
      withAccessToken: async (fn: (token: string) => Promise<unknown>) => fn('token'),
      principal: { permissions },
    }),
  };
});

const planDetailFixture = {
  id: 'p1',
  canonicalKey: 'plan.lite',
  lifecycle: 'ACTIVE',
  displayName: 'Lite',
  sortOrder: 1,
  hasOpenDraft: false,
  legacyAssignmentCount: 2,
  planVersionSubscriberCount: { status: 'unavailable', reason: 'no_plan_version_fk' },
  version: 1,
  versionCount: 1,
  latestVersionNumber: 1,
  latestPublishedVersionNumber: 1,
  translations: [
    { locale: 'en-US', displayName: 'Lite', shortDescription: 'Lite plan' },
    { locale: 'ar-SY', displayName: 'لايت', shortDescription: 'خطة لايت' },
  ],
  aliases: [],
  deferred: {
    entitlementsAndLimits: 'available',
    addOnsAndOverrides: 'available',
    subscriptionManagement: 'unavailable_until_step_16',
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('PlansPage', () => {
  beforeEach(() => {
    permissions = ['plan.view', 'plan.create', 'plan-version.view', 'plan-version.create'];
    listPlatformPlans.mockReset();
    listPlatformPlans.mockResolvedValue({
      items: [
        {
          id: 'p1',
          canonicalKey: 'plan.lite',
          lifecycle: 'ACTIVE',
          displayName: 'Lite',
          hasOpenDraft: false,
          legacyAssignmentCount: 2,
          planVersionSubscriberCount: { status: 'unavailable', reason: 'no_plan_version_fk' },
          version: 1,
        },
      ],
      page: 1,
      pageSize: 50,
      total: 1,
    });
    getPlatformPlan.mockResolvedValue(planDetailFixture);
    getPlatformPlanReferences.mockResolvedValue({
      planId: 'p1',
      versionCount: 1,
      aliasCount: 0,
      legacyAssignmentCount: 2,
      planVersionSubscriberCount: { status: 'unavailable', reason: 'no_plan_version_fk' },
      entitlements: { status: 'available', reason: 'step_14_commercial_definition' },
      addOns: { status: 'available', reason: 'step_15_commercial_definition' },
      overrides: { status: 'available', reason: 'step_15_commercial_definition' },
      directSubscriptions: { status: 'unavailable', reason: 'step_16_not_implemented' },
    });
    listPlatformPlanVersions.mockResolvedValue({
      items: [
        {
          id: 'v1',
          planId: 'p1',
          versionNumber: 1,
          lifecycle: 'PUBLISHED',
          rowVersion: 2,
          immutable: true,
          translations: [],
        },
      ],
    });
    getPlatformPlanVersion.mockResolvedValue({
      id: 'v1',
      planId: 'p1',
      versionNumber: 1,
      lifecycle: 'PUBLISHED',
      rowVersion: 2,
      immutable: true,
      effectiveFrom: null,
      retireAt: null,
      trialDefault: { status: 'unavailable', enabled: null, days: null },
      pricing: { status: 'unavailable', amountMinor: null, currency: null, billingInterval: null, billingIntervalCount: null },
      publishedAt: new Date().toISOString(),
      publicationFingerprint: 'fp1',
      translations: [{ locale: 'en-US', releaseLabel: 'Initial', shortDescription: 'Initial release' }],
      entitlementReadiness: { status: 'LEGACY_UNCONFIGURED', reason: 'metadata_only_publication' },
    });
    comparePlatformPlanVersions.mockResolvedValue({
      planId: 'p1',
      left: { versionNumber: 2, lifecycle: 'DRAFT' },
      right: { versionNumber: 1, lifecycle: 'PUBLISHED' },
      entitlements: {
        status: 'available',
        added: [{ canonicalKey: 'module.dashboard', kind: 'MODULE' }],
        removed: [],
        unchanged: [],
      },
      limits: {
        status: 'available',
        added: [],
        removed: [],
        changed: [{ canonicalKey: 'limit.max_users', left: { valueText: '10' }, right: { valueText: '25' } }],
      },
      fields: [{ field: 'versionNumber', left: 2, right: 1 }],
    });
    getPlatformPlanLegacyMappings.mockResolvedValue({
      items: [
        {
          id: 'a1',
          sourceNamespace: 'prisma_plan_enum',
          aliasValue: 'LITE',
          canonicalKey: 'plan.lite',
          planId: 'p1',
          planLifecycle: 'ACTIVE',
          aliasLifecycle: 'ACTIVE',
          migrationNote: null,
          usageCount: 2,
        },
      ],
      unresolved: [
        {
          value: 'business',
          status: 'unresolved',
          classification: 'ui_tier_overlay',
          confidence: 'medium',
          note: 'Clinic UI tier overlay on PRO — not Plan-equivalent.',
          canonicalMapping: null,
        },
      ],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders plan list and shows unavailable version subscribers honestly', async () => {
    render(
      <AppProviders>
        <MemoryRouter>
          <PlansPage />
        </MemoryRouter>
      </AppProviders>,
    );
    expect(await screen.findByText('Lite')).toBeTruthy();
    expect(screen.getByText('plan.lite')).toBeTruthy();
    expect(screen.getAllByText(/Unavailable/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Commercial metadata only/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Create plan/i }).getAttribute('href')).toBe('/plans/new');
  });

  it('denies list load without plan.view', async () => {
    permissions = [];
    render(
      <AppProviders>
        <MemoryRouter>
          <PlansPage />
        </MemoryRouter>
      </AppProviders>,
    );
    expect(await screen.findByText(/plan\.view permission/i)).toBeTruthy();
    expect(listPlatformPlans).not.toHaveBeenCalled();
  });
});

describe('PlanDetailPage', () => {
  beforeEach(() => {
    permissions = ['plan.view', 'plan-version.view'];
    getPlatformPlan.mockResolvedValue(planDetailFixture);
    getPlatformPlanReferences.mockResolvedValue({
      planId: 'p1',
      versionCount: 1,
      aliasCount: 0,
      legacyAssignmentCount: 2,
      planVersionSubscriberCount: { status: 'unavailable', reason: 'no_plan_version_fk' },
      entitlements: { status: 'available', reason: 'step_14_commercial_definition' },
      addOns: { status: 'available', reason: 'step_15_commercial_definition' },
      overrides: { status: 'available', reason: 'step_15_commercial_definition' },
      directSubscriptions: { status: 'unavailable', reason: 'step_16_not_implemented' },
    });
    listPlatformPlanVersions.mockResolvedValue({ items: [] });
  });

  afterEach(() => cleanup());

  it('shows Step 14/15 commercial SoR and deferred Step 16 banner on detail', async () => {
    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/plans/p1']}>
          <Routes>
            <Route path="/plans/:planId" element={<PlanDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );
    expect(await screen.findByText('Lite')).toBeTruthy();
    expect(screen.getByText(/Deferred capabilities/i)).toBeTruthy();
    expect(
      screen.getByText(/Entitlements and Limits are available on Plan Versions/i),
    ).toBeTruthy();
    expect(
      screen.getAllByText(/Add-ons and Commercial Overrides are available \(commercial definition only\)/i)
        .length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/Unavailable until Step 16 \(subscription management\)/i)).toBeTruthy();
  });
});

describe('PlanVersionEditPage', () => {
  beforeEach(() => {
    permissions = ['plan-version.view', 'plan-version.create'];
    getPlatformPlanVersion.mockResolvedValue({
      id: 'v1',
      planId: 'p1',
      versionNumber: 1,
      lifecycle: 'PUBLISHED',
      rowVersion: 2,
      immutable: true,
      translations: [],
    });
  });

  afterEach(() => cleanup());

  it('blocks edit form for published versions', async () => {
    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/plans/p1/versions/v1/edit']}>
          <Routes>
            <Route path="/plans/:planId/versions/:versionId/edit" element={<PlanVersionEditPage />} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );
    expect(await screen.findByText(/Draft only/i)).toBeTruthy();
    expect(screen.getByText(/immutable/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Save/i })).toBeNull();
  });
});

describe('PlanVersionComparePage', () => {
  beforeEach(() => {
    permissions = ['plan-version.view'];
    comparePlatformPlanVersions.mockResolvedValue({
      planId: 'p1',
      left: { versionNumber: 2, lifecycle: 'DRAFT' },
      right: { versionNumber: 1, lifecycle: 'PUBLISHED' },
      entitlements: { status: 'available' },
      limits: { status: 'available' },
      entitlementDiff: {
        status: 'available',
        added: ['module.dashboard'],
        removed: [],
        unchanged: [],
        leftCount: 1,
        rightCount: 0,
      },
      limitDiff: {
        status: 'available',
        entries: [
          {
            canonicalKey: 'limit.max_users',
            displayName: 'Max users',
            leftLabel: '10',
            rightLabel: '25',
            changed: true,
          },
        ],
      },
      fields: [{ field: 'versionNumber', left: 2, right: 1 }],
    });
  });

  afterEach(() => cleanup());

  it('shows entitlement and limit diffs when Step 14 compare is available', async () => {
    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/plans/p1/versions/v2/compare?rightId=v1']}>
          <Routes>
            <Route path="/plans/:planId/versions/:versionId/compare" element={<PlanVersionComparePage />} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );
    expect(await screen.findByRole('heading', { name: /^Entitlements$/i })).toBeTruthy();
    expect(screen.getByText(/module\.dashboard/i)).toBeTruthy();
    expect(comparePlatformPlanVersions).toHaveBeenCalledWith('token', 'p1', 'v2', 'v1');
  });
});

describe('PlanLegacyMappingsPage', () => {
  beforeEach(() => {
    permissions = ['plan.view'];
    getPlatformPlanLegacyMappings.mockResolvedValue({
      items: [],
      unresolved: [
        {
          value: 'business',
          status: 'unresolved',
          classification: 'ui_tier_overlay',
          confidence: 'medium',
          note: 'Clinic UI tier overlay on PRO — not Plan-equivalent.',
          canonicalMapping: null,
        },
      ],
    });
  });

  afterEach(() => cleanup());

  it('shows unresolved business identifier', async () => {
    render(
      <AppProviders>
        <MemoryRouter>
          <PlanLegacyMappingsPage />
        </MemoryRouter>
      </AppProviders>,
    );
    expect(await screen.findByText(/Clinic UI tier overlay on PRO/i)).toBeTruthy();
    expect(screen.getByText('business')).toBeTruthy();
  });
});
