import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppProviders } from '../app/providers/AppProviders';
import { PlanVersionDetailPage, PlanVersionComparePage } from './plans/PlanVersionDetailPage';

const getPlatformPlanVersion = vi.fn();
const listPlatformPlanVersions = vi.fn();
const getPlatformPlanVersionReadiness = vi.fn();
const getPlatformPlanVersionEntitlements = vi.fn();
const updatePlatformPlanVersionEntitlements = vi.fn();
const applyRequiredPlatformPlanVersionEntitlements = vi.fn();
const getPlatformPlanVersionLimits = vi.fn();
const updatePlatformPlanVersionLimits = vi.fn();
const comparePlatformPlanVersions = vi.fn();

let permissions: string[] = [
  'plan-version.view',
  'plan-version.create',
  'plan-version.review',
  'plan-entitlement.view',
  'plan-entitlement.manage',
  'plan-limit.view',
  'plan-limit.manage',
];

vi.mock('../auth/PlatformAuthProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../auth/PlatformAuthProvider')>();
  return {
    ...actual,
    usePlatformAuth: () => ({
      client: {
        getPlatformPlanVersion,
        listPlatformPlanVersions,
        getPlatformPlanVersionReadiness,
        getPlatformPlanVersionEntitlements,
        updatePlatformPlanVersionEntitlements,
        applyRequiredPlatformPlanVersionEntitlements,
        getPlatformPlanVersionLimits,
        updatePlatformPlanVersionLimits,
        comparePlatformPlanVersions,
        publishPlatformPlanVersion: vi.fn(),
        retirePlatformPlanVersion: vi.fn(),
        clonePlatformPlanVersion: vi.fn(),
      },
      withAccessToken: async (fn: (token: string) => Promise<unknown>) => fn('token'),
      principal: { permissions },
    }),
  };
});

const draftVersion = {
  id: 'v2',
  planId: 'p1',
  versionNumber: 2,
  lifecycle: 'DRAFT',
  rowVersion: 3,
  immutable: false,
  effectiveFrom: null,
  retireAt: null,
  trialDefault: { status: 'unavailable', enabled: null, days: null },
  pricing: { status: 'unavailable', amountMinor: null, currency: null, billingInterval: null, billingIntervalCount: null },
  publishedAt: null,
  publicationFingerprint: null,
  translations: [
    { locale: 'en-US', releaseLabel: 'Draft 2', shortDescription: 'Second draft' },
    { locale: 'ar-SY', releaseLabel: 'مسودة 2', shortDescription: 'مسودة ثانية' },
  ],
  entitlementReadiness: { status: 'available' },
};

const entitlementsFixture = {
  planId: 'p1',
  versionId: 'v2',
  rowVersion: 3,
  lifecycle: 'DRAFT',
  readOnly: false,
  legacyUnconfigured: false,
  catalogItems: [
    {
      canonicalKey: 'module.scheduling',
      kind: 'MODULE',
      displayName: 'Scheduling',
      lifecycle: 'ACTIVE',
      selectable: true,
    },
    {
      canonicalKey: 'feature.ai_assist',
      kind: 'FEATURE',
      displayName: 'AI Assist',
      lifecycle: 'ACTIVE',
      selectable: true,
      owningModuleKey: 'module.scheduling',
    },
    {
      canonicalKey: 'facility_type.clinic',
      kind: 'FACILITY_TYPE',
      displayName: 'Clinic',
      lifecycle: 'ACTIVE',
      selectable: false,
    },
  ],
  grants: [{ canonicalKey: 'module.scheduling', kind: 'MODULE', source: 'explicit' }],
  dependencyWarnings: [
    {
      code: 'missing_dependency',
      message: 'feature.ai_assist requires module.scheduling',
      subjectKey: 'feature.ai_assist',
      missingKeys: ['module.scheduling'],
    },
  ],
  requiredMissing: [],
};

const limitsFixture = {
  planId: 'p1',
  versionId: 'v2',
  rowVersion: 3,
  lifecycle: 'DRAFT',
  readOnly: false,
  legacyUnconfigured: false,
  groups: [
    {
      moduleKey: 'module.scheduling',
      moduleDisplayName: 'Scheduling',
      limits: [
        {
          canonicalKey: 'limit.max_users',
          displayName: 'Max users',
          valueType: 'INTEGER',
          unit: 'users',
          min: '1',
          max: '1000',
          zeroValid: false,
          unlimitedSupported: true,
          owningModuleKey: 'module.scheduling',
          ownerModuleGranted: true,
          assignment: { state: 'UNCONFIGURED', value: null },
        },
      ],
    },
  ],
  ungrouped: [],
};

describe('PlanVersionDetailPage Step 14', () => {
  beforeEach(() => {
    permissions = [
      'plan-version.view',
      'plan-version.create',
      'plan-version.review',
      'plan-entitlement.view',
      'plan-entitlement.manage',
      'plan-limit.view',
      'plan-limit.manage',
    ];
    getPlatformPlanVersion.mockResolvedValue(draftVersion);
    listPlatformPlanVersions.mockResolvedValue({ items: [draftVersion] });
    getPlatformPlanVersionReadiness.mockResolvedValue({
      metadataReady: true,
      entitlementReadiness: { status: 'available' },
      subscriptionEligibility: false,
      runtimeEffective: false,
      blockers: [],
      warnings: [],
      entitlementsReady: false,
      limitsReady: false,
      sections: {
        metadata: { status: 'ready' },
        translations: { status: 'ready' },
        entitlements: { status: 'not_ready' },
        dependencies: { status: 'warning' },
        compatibility: { status: 'ready' },
        limits: { status: 'not_ready' },
        catalogLifecycle: { status: 'ready' },
        addOns: { status: 'available', reason: 'step_15_commercial_definition' },
        overrides: { status: 'available', reason: 'step_15_commercial_definition' },
      },
    });
    getPlatformPlanVersionEntitlements.mockResolvedValue(entitlementsFixture);
    getPlatformPlanVersionLimits.mockResolvedValue(limitsFixture);
    updatePlatformPlanVersionEntitlements.mockResolvedValue({
      ...entitlementsFixture,
      rowVersion: 4,
      grants: [
        { canonicalKey: 'module.scheduling', kind: 'MODULE', source: 'explicit' },
        { canonicalKey: 'feature.ai_assist', kind: 'FEATURE', source: 'explicit' },
      ],
    });
    applyRequiredPlatformPlanVersionEntitlements.mockResolvedValue({
      ...entitlementsFixture,
      rowVersion: 5,
    });
    updatePlatformPlanVersionLimits.mockResolvedValue({
      ...limitsFixture,
      rowVersion: 4,
      groups: [
        {
          ...limitsFixture.groups[0],
          limits: [
            {
              ...limitsFixture.groups[0].limits[0],
              assignment: { state: 'VALUE', value: '25' },
            },
          ],
        },
      ],
    });
  });

  afterEach(() => cleanup());

  it('shows preview disclaimer and entitlements tab with MODULE/FEATURE editor', async () => {
    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/plans/p1/versions/v2?tab=entitlements']}>
          <Routes>
            <Route path="/plans/:planId/versions/:versionId" element={<PlanVersionDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    expect(await screen.findByText(/Commercial Plan Version definition only/i)).toBeTruthy();
    expect(await screen.findByRole('link', { name: /Entitlements/i })).toBeTruthy();
    expect(await screen.findByText('Scheduling')).toBeTruthy();
    expect(screen.getByText(/Not a commercial grant/i)).toBeTruthy();
    expect(screen.getByText(/Dependency warnings/i)).toBeTruthy();
  });

  it('saves entitlements atomically with expectedRowVersion', async () => {
    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/plans/p1/versions/v2?tab=entitlements']}>
          <Routes>
            <Route path="/plans/:planId/versions/:versionId" element={<PlanVersionDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    await screen.findByText('Scheduling');
    fireEvent.click(screen.getByRole('tab', { name: /Features/i }));
    await screen.findByText('AI Assist');
    fireEvent.click(screen.getByRole('checkbox', { name: /AI Assist/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => {
      expect(updatePlatformPlanVersionEntitlements).toHaveBeenCalledWith('token', 'p1', 'v2', {
        expectedRowVersion: 3,
        grants: expect.arrayContaining([
          { kind: 'MODULE', canonicalKey: 'module.scheduling' },
          { kind: 'FEATURE', canonicalKey: 'feature.ai_assist' },
        ]),
      });
    });
  });

  it('apply-required uses ConfirmationDialog not window.confirm', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/plans/p1/versions/v2?tab=entitlements']}>
          <Routes>
            <Route path="/plans/:planId/versions/:versionId" element={<PlanVersionDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    await screen.findByText('Scheduling');
    fireEvent.click(screen.getByRole('button', { name: /Apply required dependencies/i }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(confirmSpy).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: /Apply required$/i }));

    await waitFor(() => {
      expect(applyRequiredPlatformPlanVersionEntitlements).toHaveBeenCalledWith('token', 'p1', 'v2', {
        expectedRowVersion: 3,
      });
    });
    confirmSpy.mockRestore();
  });

  it('limits editor distinguishes Unconfigured from Unlimited', async () => {
    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/plans/p1/versions/v2?tab=limits']}>
          <Routes>
            <Route path="/plans/:planId/versions/:versionId" element={<PlanVersionDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    await screen.findByText('Max users');
    expect(screen.getByLabelText(/Unconfigured/i)).toBeTruthy();
    expect(screen.getByLabelText(/Unlimited/i)).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/^Value$/i));
    const valueInput = screen.getByRole('spinbutton');
    fireEvent.change(valueInput, { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => {
      expect(updatePlatformPlanVersionLimits).toHaveBeenCalledWith('token', 'p1', 'v2', {
        expectedRowVersion: 3,
        assignments: expect.arrayContaining([
          { canonicalKey: 'limit.max_users', state: 'VALUE', value: '25' },
        ]),
      });
    });
  });

  it('readiness panel shows extended sections and subscriptionEligibility false', async () => {
    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/plans/p1/versions/v2?tab=readiness']}>
          <Routes>
            <Route path="/plans/:planId/versions/:versionId" element={<PlanVersionDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    expect(await screen.findByText(/Publication readiness/i)).toBeTruthy();
    expect(screen.getByText(/Subscription eligibility/i)).toBeTruthy();
    expect(screen.getAllByText(/^No$/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('cell', { name: /^Add-ons$/i })).toBeTruthy();
    expect(
      screen.getAllByText(/Add-ons and Commercial Overrides are available \(commercial definition only\)/i)
        .length,
    ).toBeGreaterThan(0);
  });

  it('tolerates entitlement.view for read-only entitlements tab', async () => {
    permissions = ['plan-version.view', 'entitlement.view'];
    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/plans/p1/versions/v2?tab=entitlements']}>
          <Routes>
            <Route path="/plans/:planId/versions/:versionId" element={<PlanVersionDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    expect(await screen.findByText('Scheduling')).toBeTruthy();
    expect(screen.getByText(/plan-entitlement.manage/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Save$/i })).toBeNull();
  });
});

describe('PlanVersionComparePage Step 14', () => {
  beforeEach(() => {
    permissions = ['plan-version.view'];
    comparePlatformPlanVersions.mockResolvedValue({
      planId: 'p1',
      left: { versionNumber: 2, lifecycle: 'DRAFT' },
      right: { versionNumber: 1, lifecycle: 'PUBLISHED' },
      entitlements: { status: 'available' },
      limits: { status: 'available' },
      fields: [{ field: 'versionNumber', left: 2, right: 1 }],
      entitlementDiff: {
        status: 'available',
        added: ['feature.ai_assist'],
        removed: [],
        unchanged: ['module.scheduling'],
        leftCount: 2,
        rightCount: 1,
      },
      limitDiff: {
        status: 'available',
        entries: [
          {
            canonicalKey: 'limit.max_users',
            displayName: 'Max users',
            leftLabel: 'Unconfigured',
            rightLabel: '25',
            changed: true,
          },
        ],
      },
    });
  });

  afterEach(() => cleanup());

  it('renders entitlement and limit diffs when available', async () => {
    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/plans/p1/versions/v2/compare?rightId=v1']}>
          <Routes>
            <Route path="/plans/:planId/versions/:versionId/compare" element={<PlanVersionComparePage />} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    expect(await screen.findByText(/Commercial Plan Version definition only/i)).toBeTruthy();
    expect(screen.getByText('feature.ai_assist')).toBeTruthy();
    expect(screen.getByText('Max users')).toBeTruthy();
    expect(screen.getByText('Unconfigured')).toBeTruthy();
  });
});
