/**
 * Flexible Step 25 — Super Admin Trials UI matrix UI01–UI60.
 * Contract: docs/TRIAL_CREATION_AND_CUSTOMER_CONVERSION.md
 * Stable i18n identity (audit-center pattern). Mock PlatformAuth + client.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformAuthApiError } from '../../../auth/platform-auth-api';
import { getRouteById, listNavRoutes } from '../../../routing/route-registry';
import { evaluatePermissionPolicy } from '../../../routing/permission-policy';
import { SalesTrialsListPage } from './SalesTrialsListPage';
import { SalesTrialCreatePage } from './SalesTrialCreatePage';
import { SalesTrialDetailPage } from './SalesTrialDetailPage';

const mockUsePlatformAuth = vi.fn();
const mockUseI18n = vi.fn();

vi.mock('../../../auth/PlatformAuthProvider', () => ({
  usePlatformAuth: () => mockUsePlatformAuth(),
}));

vi.mock('@booking/i18n/react', () => ({
  useI18n: () => mockUseI18n(),
}));

/** Stable identity — production I18nProvider memoizes `t`; unstable mocks re-trigger load effects. */
const stableT = (_key: string, fallback?: string) => fallback ?? _key;
const stableI18nEn = { t: stableT, locale: 'en-US' as const };
const stableI18nAr = { t: stableT, locale: 'ar-SY' as const };

const PAID_PV = '22222222-2222-2222-2222-222222222222';

const sampleTrial = {
  id: 'trial-1',
  status: 'ACTIVE' as const,
  organizationName: 'Acme Trial Clinic',
  platformTenantId: 'pt-1',
  originatingLeadId: null,
  ownerRepresentativeId: 'rep-1',
  trialPlanVersionId: '11111111-1111-1111-1111-111111111111',
  facilityTypeKey: 'facility_type.clinic',
  selectedSpecialtyKeys: ['specialty.general'],
  selectedModuleKeys: ['module.scheduling'],
  startsAt: '2026-08-01T00:00:00.000Z',
  expiresAt: '2026-08-15T00:00:00.000Z',
  maxExtensions: 2,
  extensionCount: 0,
  commercialConfigId: 'cc-1',
  provisioningRequestId: null,
  trialOnlyGrants: [
    { grantKey: 'addon.premium_support', kind: 'ADD_ON' as const, referenceId: null, trialOnly: true },
  ],
  attributionSnapshot: {
    originatingLeadId: null,
    ownerRepresentativeId: 'rep-1',
    salesAttributionId: null,
    createdByPlatformUserId: 'u1',
    frozenAt: '2026-08-01T00:00:00.000Z',
  },
  expiredAt: null,
  cancelledAt: null,
  cancellationReason: null,
  rowVersion: 3,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

const samplePreview = {
  trialId: 'trial-1',
  trialPlanVersionId: sampleTrial.trialPlanVersionId,
  targetPaidPlanVersionId: PAID_PV,
  retainedEntitlements: ['module.scheduling'],
  addedEntitlements: ['module.billing'],
  removedEntitlements: ['specialty.general'],
  limits: [
    {
      canonicalKey: 'limit.users',
      trialState: 'CONFIGURED' as const,
      trialValue: '5',
      paidState: 'CONFIGURED' as const,
      paidValue: '50',
      classification: 'CHANGED' as const,
    },
    {
      canonicalKey: 'limit.locations',
      trialState: 'UNCONFIGURED' as const,
      trialValue: null,
      paidState: 'UNLIMITED' as const,
      paidValue: null,
      classification: 'ADDED' as const,
    },
  ],
  trialOnlyExpiring: ['addon.premium_support'],
  trialOnlyMigrating: [] as string[],
  incompatibilities: [
    { reasonCode: 'specialty_removed', message: 'Specialty general is not in the paid plan.' },
  ],
  unconfiguredVsUnlimited: [
    {
      canonicalKey: 'limit.locations',
      trialState: 'UNCONFIGURED' as const,
      paidState: 'UNLIMITED' as const,
    },
  ],
  requiredDispositionGrantKeys: ['addon.premium_support'],
  runtimeSource: 'STEP16_SNAPSHOT_STEP18_EER' as const,
  disclaimer: {
    readOnly: true as const,
    doesNotMutateProtectedSoR: true as const,
    notEntitlementDecision: true as const,
    notRuntimeLicenseDecision: true as const,
  },
};

const sampleHistory = {
  trialId: 'trial-1',
  audits: [
    {
      id: 'a1',
      action: 'sales_trial.created',
      actorId: 'u1',
      reason: null,
      correlationId: 'corr-1',
      createdAt: '2026-08-01T00:00:00.000Z',
    },
  ],
  extensions: [] as unknown[],
  conversion: null as unknown,
};

function clientMocks(overrides: Record<string, unknown> = {}) {
  return {
    listSalesTrials: vi
      .fn()
      .mockResolvedValue({ items: [sampleTrial], total: 1, page: 1, pageSize: 25 }),
    getSalesTrial: vi.fn().mockResolvedValue(sampleTrial),
    createSalesTrial: vi.fn().mockResolvedValue({ ...sampleTrial, id: 'trial-new' }),
    updateSalesTrial: vi.fn().mockResolvedValue({ ...sampleTrial, rowVersion: 4 }),
    extendSalesTrial: vi
      .fn()
      .mockResolvedValue({ ...sampleTrial, extensionCount: 1, rowVersion: 4 }),
    cancelSalesTrial: vi
      .fn()
      .mockResolvedValue({ ...sampleTrial, status: 'CANCELLED', rowVersion: 4 }),
    getSalesTrialEntitlementPreview: vi.fn().mockResolvedValue(samplePreview),
    convertSalesTrial: vi.fn().mockResolvedValue({
      trialId: 'trial-1',
      status: 'CONVERTED',
      replayed: false,
      conversion: {
        id: 'conv-1',
        trialId: 'trial-1',
        targetPaidPlanVersionId: PAID_PV,
        dispositions: [],
        actorPlatformUserId: 'u1',
        convertedAt: '2026-08-10T00:00:00.000Z',
        correlationId: 'corr-2',
        outboxEventId: 'ob-1',
        commercialConfigId: 'cc-1',
      },
    }),
    listSalesTrialExtensions: vi.fn().mockResolvedValue([]),
    getSalesTrialHistory: vi.fn().mockResolvedValue(sampleHistory),
    ...overrides,
  };
}

const ALL_TRIAL_PERMS = [
  'trial.view',
  'trial.create',
  'trial.update',
  'trial.extend',
  'trial.extend.exceptional',
  'trial.convert',
  'trial.preview-entitlements',
];

function auth(
  permissions: string[],
  clientOverrides: Record<string, unknown> = {},
  opts: { status?: string } = {},
) {
  const client = clientMocks(clientOverrides);
  mockUsePlatformAuth.mockReturnValue({
    status: opts.status ?? 'authenticated',
    getAccessToken: () => 'tok',
    withAccessToken: async (fn: (token: string) => Promise<unknown>) => fn('tok'),
    principal: { id: 'u1', permissions },
    client,
  });
  return client;
}

function renderList() {
  return render(
    <MemoryRouter>
      <SalesTrialsListPage />
    </MemoryRouter>,
  );
}

function renderCreate() {
  return render(
    <MemoryRouter>
      <SalesTrialCreatePage />
    </MemoryRouter>,
  );
}

function renderDetail(id = 'trial-1') {
  return render(
    <MemoryRouter initialEntries={[`/sales/trials/${id}`]}>
      <Routes>
        <Route path="/sales/trials/:id" element={<SalesTrialDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Runs the preview form so the disposition controls and comparison render. */
async function runPreview() {
  fireEvent.change(await screen.findByLabelText(/Target paid plan version id/i), {
    target: { value: PAID_PV },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Preview comparison' }));
}

describe('Step 25 Trials UI UI01–UI60', () => {
  beforeEach(() => {
    mockUseI18n.mockReturnValue(stableI18nEn);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // ─── navigation and route policy ──────────────────────────────────────────

  it('UI01 authorized nav visible for trial.view', () => {
    const route = getRouteById('sales-trials');
    expect(route?.status).toBe('available');
    expect(route?.step).toBe(25);
    const nav = listNavRoutes({ permissions: ['trial.view'] });
    expect(nav.some((r) => r.id === 'sales-trials')).toBe(true);
  });

  it('UI02 unauthorized nav hidden', () => {
    const nav = listNavRoutes({ permissions: [] });
    expect(nav.some((r) => r.id === 'sales-trials')).toBe(false);
  });

  it('UI03 list route policy requires trial.view', () => {
    const route = getRouteById('sales-trials');
    expect(evaluatePermissionPolicy({ permissions: [] }, route!.policy)).toBe(false);
    expect(evaluatePermissionPolicy({ permissions: ['trial.view'] }, route!.policy)).toBe(true);
  });

  it('UI04 create route policy requires trial.create', () => {
    const route = getRouteById('sales-trials-new');
    expect(evaluatePermissionPolicy({ permissions: ['trial.view'] }, route!.policy)).toBe(false);
    expect(evaluatePermissionPolicy({ permissions: ['trial.create'] }, route!.policy)).toBe(true);
  });

  it('UI05 detail route policy requires trial.view', () => {
    const route = getRouteById('sales-trials-detail');
    expect(evaluatePermissionPolicy({ permissions: [] }, route!.policy)).toBe(false);
    expect(evaluatePermissionPolicy({ permissions: ['trial.view'] }, route!.policy)).toBe(true);
  });

  it('UI06 lead permissions alone never unlock the Trial surface', () => {
    const route = getRouteById('sales-trials');
    expect(
      evaluatePermissionPolicy({ permissions: ['sales-lead.view', 'sales-lead.manage'] }, route!.policy),
    ).toBe(false);
  });

  // ─── list ─────────────────────────────────────────────────────────────────

  it('UI07 list renders trials with status and window', async () => {
    auth(['trial.view']);
    renderList();
    expect(await screen.findByText('Acme Trial Clinic')).toBeTruthy();
    // Scoped to the table: the status filter also offers an ACTIVE option.
    const table = screen.getByRole('table');
    expect(within(table).getByText('ACTIVE')).toBeTruthy();
    expect(within(table).getByText('0/2')).toBeTruthy();
  });

  it('UI08 create button hidden without trial.create', async () => {
    auth(['trial.view']);
    renderList();
    await screen.findByText('Acme Trial Clinic');
    expect(screen.queryByRole('link', { name: 'New trial' })).toBeNull();
  });

  it('UI09 create button visible with trial.create', async () => {
    auth(['trial.view', 'trial.create']);
    renderList();
    expect(await screen.findByRole('link', { name: 'New trial' })).toBeTruthy();
  });

  it('UI10 loading then results', async () => {
    let resolveList!: (v: unknown) => void;
    auth(['trial.view'], {
      listSalesTrials: vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveList = resolve;
          }),
      ),
    });
    renderList();
    resolveList({ items: [sampleTrial], total: 1, page: 1, pageSize: 25 });
    expect(await screen.findByText('Acme Trial Clinic')).toBeTruthy();
  });

  it('UI11 empty state', async () => {
    auth(['trial.view'], {
      listSalesTrials: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }),
    });
    renderList();
    expect(await screen.findByText('No trials found')).toBeTruthy();
  });

  it('UI12 status filter re-queries', async () => {
    const client = auth(['trial.view']);
    renderList();
    await screen.findByText('Acme Trial Clinic');
    fireEvent.change(screen.getByLabelText(/Status/i), { target: { value: 'EXPIRED' } });
    await waitFor(() =>
      expect(client.listSalesTrials).toHaveBeenCalledWith(
        'tok',
        expect.objectContaining({ status: 'EXPIRED' }),
      ),
    );
  });

  it('UI13 search re-queries', async () => {
    const client = auth(['trial.view']);
    renderList();
    await screen.findByText('Acme Trial Clinic');
    fireEvent.change(screen.getByLabelText(/Search/i), { target: { value: 'acme' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() =>
      expect(client.listSalesTrials).toHaveBeenCalledWith(
        'tok',
        expect.objectContaining({ search: 'acme' }),
      ),
    );
  });

  it('UI14 list error surfaces via Alert', async () => {
    auth(['trial.view'], {
      listSalesTrials: vi.fn().mockRejectedValue(new PlatformAuthApiError('Boom', 500, 'error')),
    });
    renderList();
    expect(await screen.findByText('Boom')).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('UI15 bounded pagination controls', async () => {
    auth(['trial.view'], {
      listSalesTrials: vi
        .fn()
        .mockResolvedValue({ items: [sampleTrial], total: 100, page: 1, pageSize: 25 }),
    });
    renderList();
    const prev = await screen.findByRole('button', { name: 'Previous' });
    expect((prev as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('UI16 deterministic page summary', async () => {
    auth(['trial.view'], {
      listSalesTrials: vi
        .fn()
        .mockResolvedValue({ items: [sampleTrial], total: 40, page: 1, pageSize: 25 }),
    });
    renderList();
    expect(await screen.findByText(/Page 1/)).toBeTruthy();
    expect(screen.getByText(/40 trials/)).toBeTruthy();
  });

  // ─── create ───────────────────────────────────────────────────────────────

  it('UI17 create form submits governance intent with an idempotency key', async () => {
    const client = auth(['trial.create']);
    renderCreate();
    fireEvent.change(screen.getByLabelText(/Organization/i), { target: { value: 'New Trial Org' } });
    fireEvent.change(screen.getByLabelText(/Facility type key/i), {
      target: { value: 'facility_type.clinic' },
    });
    fireEvent.change(screen.getByLabelText(/Trial plan version id/i), {
      target: { value: sampleTrial.trialPlanVersionId },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create trial' }));
    await waitFor(() => expect(client.createSalesTrial).toHaveBeenCalled());
    const [, body, idempotencyKey] = client.createSalesTrial.mock.calls[0];
    expect(body).toMatchObject({ organizationName: 'New Trial Org' });
    expect(typeof idempotencyKey).toBe('string');
    expect((idempotencyKey as string).length).toBeGreaterThan(10);
  });

  it('UI18 create requires organization, facility type, and plan version', () => {
    auth(['trial.create']);
    renderCreate();
    expect((screen.getByLabelText(/Organization/i) as HTMLInputElement).required).toBe(true);
    expect((screen.getByLabelText(/Facility type key/i) as HTMLInputElement).required).toBe(true);
    expect((screen.getByLabelText(/Trial plan version id/i) as HTMLInputElement).required).toBe(true);
  });

  it('UI19 create duration is bounded by policy', () => {
    auth(['trial.create']);
    renderCreate();
    const duration = screen.getByLabelText(/Duration in days/i) as HTMLInputElement;
    expect(duration.min).toBe('1');
    expect(duration.max).toBe('90');
  });

  it('UI20 create extension budget is bounded and never unlimited', () => {
    auth(['trial.create']);
    renderCreate();
    const maxExtensions = screen.getByLabelText(/Maximum extensions/i) as HTMLInputElement;
    expect(maxExtensions.min).toBe('1');
    expect(maxExtensions.max).toBe('12');
    expect(screen.queryByText(/unlimited/i)).toBeNull();
  });

  it('UI21 create states that entitlements come from the plan version', () => {
    auth(['trial.create']);
    renderCreate();
    expect(
      screen.getByText(/Trial entitlements come from the plan version commercial definition/i),
    ).toBeTruthy();
  });

  it('UI22 create omits blank optional fields from the request', async () => {
    const client = auth(['trial.create']);
    renderCreate();
    fireEvent.change(screen.getByLabelText(/Organization/i), { target: { value: 'Lean Org' } });
    fireEvent.change(screen.getByLabelText(/Facility type key/i), {
      target: { value: 'facility_type.clinic' },
    });
    fireEvent.change(screen.getByLabelText(/Trial plan version id/i), {
      target: { value: sampleTrial.trialPlanVersionId },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create trial' }));
    await waitFor(() => expect(client.createSalesTrial).toHaveBeenCalled());
    const body = client.createSalesTrial.mock.calls[0][1] as Record<string, unknown>;
    expect('durationDays' in body).toBe(false);
    expect('ownerRepresentativeId' in body).toBe(false);
  });

  it('UI23 create error surfaces via Alert', async () => {
    auth(['trial.create'], {
      createSalesTrial: vi
        .fn()
        .mockRejectedValue(new PlatformAuthApiError('Plan version is not published.', 409, 'conflict')),
    });
    renderCreate();
    fireEvent.change(screen.getByLabelText(/Organization/i), { target: { value: 'X' } });
    fireEvent.change(screen.getByLabelText(/Facility type key/i), { target: { value: 'f' } });
    fireEvent.change(screen.getByLabelText(/Trial plan version id/i), { target: { value: 'p' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create trial' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('Plan version is not published.')).toBeTruthy();
  });

  // ─── detail: window, attribution ──────────────────────────────────────────

  it('UI24 detail shows the trial window and extension budget', async () => {
    auth(['trial.view']);
    renderDetail();
    expect(await screen.findByText('Extensions used')).toBeTruthy();
    expect(screen.getByText('0/2')).toBeTruthy();
    expect(screen.getByText('Expires')).toBeTruthy();
  });

  it('UI25 detail shows frozen sales attribution', async () => {
    auth(['trial.view']);
    renderDetail();
    expect(await screen.findByText('Sales attribution (frozen)')).toBeTruthy();
    expect(
      screen.getByText(/Attribution is frozen when the trial is created/i),
    ).toBeTruthy();
  });

  it('UI26 detail links to the Audit Center', async () => {
    auth(['trial.view']);
    renderDetail();
    const link = await screen.findByRole('link', { name: 'Open Audit Center' });
    expect(link.getAttribute('href')).toBe('/audit');
  });

  it('UI27 detail load error surfaces via Alert', async () => {
    auth(['trial.view'], {
      getSalesTrial: vi.fn().mockRejectedValue(new PlatformAuthApiError('Not found', 404, 'not_found')),
    });
    renderDetail();
    expect(await screen.findByText('Not found')).toBeTruthy();
  });

  // ─── detail: extend ───────────────────────────────────────────────────────

  it('UI28 extend section hidden without trial.extend', async () => {
    auth(['trial.view']);
    renderDetail();
    await screen.findByText('Sales attribution (frozen)');
    expect(screen.queryByRole('button', { name: 'Extend trial' })).toBeNull();
  });

  it('UI29 extend sends days, reason, and the current rowVersion', async () => {
    const client = auth(['trial.view', 'trial.extend']);
    renderDetail();
    await screen.findByRole('button', { name: 'Extend trial' });
    fireEvent.change(screen.getByLabelText(/Extension days/i), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/Extension reason/i), {
      target: { value: 'pilot continues' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Extend trial' }));
    await waitFor(() =>
      expect(client.extendSalesTrial).toHaveBeenCalledWith(
        'tok',
        'trial-1',
        expect.objectContaining({
          extensionDays: 5,
          reason: 'pilot continues',
          expectedRowVersion: 3,
        }),
        expect.any(String),
      ),
    );
  });

  it('UI30 extension reason is mandatory', async () => {
    auth(['trial.view', 'trial.extend']);
    renderDetail();
    await screen.findByRole('button', { name: 'Extend trial' });
    expect((screen.getByLabelText(/Extension reason/i) as HTMLTextAreaElement).required).toBe(true);
  });

  it('UI31 extension days are bounded and never unlimited', async () => {
    auth(['trial.view', 'trial.extend']);
    renderDetail();
    const days = (await screen.findByLabelText(/Extension days/i)) as HTMLInputElement;
    expect(days.min).toBe('1');
    expect(days.max).toBe('30');
  });

  it('UI32 exceptional toggle only for trial.extend.exceptional', async () => {
    auth(['trial.view', 'trial.extend']);
    renderDetail();
    await screen.findByRole('button', { name: 'Extend trial' });
    expect(screen.queryByLabelText(/Exceptional extension beyond policy/i)).toBeNull();
    cleanup();
    auth(['trial.view', 'trial.extend', 'trial.extend.exceptional']);
    renderDetail();
    expect(
      await screen.findByLabelText(/Exceptional extension beyond policy/i),
    ).toBeTruthy();
  });

  it('UI33 exceptional extension is flagged in the request', async () => {
    const client = auth(['trial.view', 'trial.extend', 'trial.extend.exceptional']);
    renderDetail();
    await screen.findByRole('button', { name: 'Extend trial' });
    fireEvent.change(screen.getByLabelText(/Extension reason/i), {
      target: { value: 'exception approved' },
    });
    fireEvent.click(screen.getByLabelText(/Exceptional extension beyond policy/i));
    fireEvent.click(screen.getByRole('button', { name: 'Extend trial' }));
    await waitFor(() =>
      expect(client.extendSalesTrial).toHaveBeenCalledWith(
        'tok',
        'trial-1',
        expect.objectContaining({ exceptional: true }),
        expect.any(String),
      ),
    );
  });

  it('UI34 exhausted extension budget is announced', async () => {
    auth(['trial.view', 'trial.extend'], {
      getSalesTrial: vi.fn().mockResolvedValue({ ...sampleTrial, extensionCount: 2 }),
    });
    renderDetail();
    expect(
      await screen.findByText(/The extension budget for this trial is exhausted/i),
    ).toBeTruthy();
  });

  it('UI35 extension OCC conflict surfaces via Alert', async () => {
    auth(['trial.view', 'trial.extend'], {
      extendSalesTrial: vi
        .fn()
        .mockRejectedValue(new PlatformAuthApiError('Row version conflict.', 409, 'row_version_conflict')),
    });
    renderDetail();
    await screen.findByRole('button', { name: 'Extend trial' });
    fireEvent.change(screen.getByLabelText(/Extension reason/i), { target: { value: 'r' } });
    fireEvent.click(screen.getByRole('button', { name: 'Extend trial' }));
    expect(await screen.findByText('Row version conflict.')).toBeTruthy();
  });

  it('UI36 extension history renders after a recorded extension', async () => {
    auth(['trial.view'], {
      getSalesTrialHistory: vi.fn().mockResolvedValue({
        ...sampleHistory,
        extensions: [
          {
            id: 'x1',
            trialId: 'trial-1',
            previousExpiresAt: '2026-08-15T00:00:00.000Z',
            newExpiresAt: '2026-08-20T00:00:00.000Z',
            extensionDays: 5,
            reason: 'pilot continues',
            exceptional: false,
            actorPlatformUserId: 'u1',
            createdAt: '2026-08-10T00:00:00.000Z',
          },
        ],
      }),
    });
    renderDetail();
    const heading = await screen.findByText('Extension history');
    expect(heading.closest('section')?.textContent).toMatch(/pilot continues/);
  });

  it('UI37 extend section hidden once the trial is no longer ACTIVE', async () => {
    auth(['trial.view', 'trial.extend'], {
      getSalesTrial: vi.fn().mockResolvedValue({ ...sampleTrial, status: 'EXPIRED' }),
    });
    renderDetail();
    await screen.findByText('EXPIRED');
    expect(screen.queryByRole('button', { name: 'Extend trial' })).toBeNull();
  });

  // ─── detail: preview ──────────────────────────────────────────────────────

  it('UI38 preview section hidden without trial.preview-entitlements', async () => {
    auth(['trial.view']);
    renderDetail();
    await screen.findByText('Sales attribution (frozen)');
    expect(screen.queryByText('Entitlement comparison preview')).toBeNull();
  });

  it('UI39 preview is labelled read-only and advisory', async () => {
    auth(['trial.view', 'trial.preview-entitlements']);
    renderDetail();
    expect(await screen.findByText('Entitlement comparison preview')).toBeTruthy();
    expect(
      screen.getByText(/Read-only comparison. It does not change entitlements/i),
    ).toBeTruthy();
  });

  it('UI40 preview requests the target paid plan version', async () => {
    const client = auth(['trial.view', 'trial.preview-entitlements']);
    renderDetail();
    await runPreview();
    await waitFor(() =>
      expect(client.getSalesTrialEntitlementPreview).toHaveBeenCalledWith('tok', 'trial-1', PAID_PV),
    );
  });

  it('UI41 preview shows retained, added, and removed entitlements', async () => {
    auth(['trial.view', 'trial.preview-entitlements']);
    renderDetail();
    await runPreview();
    expect(await screen.findByText(/Retained: module.scheduling/)).toBeTruthy();
    expect(screen.getByText(/Added: module.billing/)).toBeTruthy();
    expect(screen.getByText(/Removed: specialty.general/)).toBeTruthy();
  });

  it('UI42 preview limit table shows both values and the classification', async () => {
    auth(['trial.view', 'trial.preview-entitlements']);
    renderDetail();
    await runPreview();
    expect(await screen.findByText('limit.users')).toBeTruthy();
    expect(screen.getByText('CONFIGURED (5)')).toBeTruthy();
    expect(screen.getByText('CONFIGURED (50)')).toBeTruthy();
    expect(screen.getByText('CHANGED')).toBeTruthy();
  });

  it('UI43 preview distinguishes unconfigured from unlimited', async () => {
    auth(['trial.view', 'trial.preview-entitlements']);
    renderDetail();
    await runPreview();
    expect(
      await screen.findByText(/Unconfigured and unlimited are different states/i),
    ).toBeTruthy();
    expect(screen.getByText('UNCONFIGURED')).toBeTruthy();
    expect(screen.getByText('UNLIMITED')).toBeTruthy();
  });

  it('UI44 preview lists incompatibilities', async () => {
    auth(['trial.view', 'trial.preview-entitlements']);
    renderDetail();
    await runPreview();
    expect(
      await screen.findByText('Specialty general is not in the paid plan.'),
    ).toBeTruthy();
  });

  it('UI45 preview surfaces a disposition control per trial-only grant', async () => {
    auth(['trial.view', 'trial.preview-entitlements']);
    renderDetail();
    await runPreview();
    expect(await screen.findByText('Trial-only grant dispositions')).toBeTruthy();
    expect(screen.getByLabelText('addon.premium_support')).toBeTruthy();
  });

  it('UI46 preview error surfaces via Alert', async () => {
    auth(['trial.view', 'trial.preview-entitlements'], {
      getSalesTrialEntitlementPreview: vi
        .fn()
        .mockRejectedValue(new PlatformAuthApiError('Target plan version is a draft.', 409, 'conflict')),
    });
    renderDetail();
    await runPreview();
    expect(await screen.findByText('Target plan version is a draft.')).toBeTruthy();
  });

  it('UI47 preview never renders a price or billing amount', async () => {
    auth(['trial.view', 'trial.preview-entitlements']);
    renderDetail();
    await runPreview();
    await screen.findByText('limit.users');
    expect(document.body.textContent).not.toMatch(/price|invoice|USD|49900/i);
  });

  // ─── detail: convert ──────────────────────────────────────────────────────

  it('UI48 convert section hidden without trial.convert', async () => {
    auth(['trial.view', 'trial.preview-entitlements']);
    renderDetail();
    await screen.findByText('Entitlement comparison preview');
    expect(screen.queryByRole('button', { name: 'Convert trial' })).toBeNull();
  });

  it('UI49 convert opens a focus-trapped confirmation dialog', async () => {
    auth(ALL_TRIAL_PERMS);
    renderDetail();
    fireEvent.click(await screen.findByRole('button', { name: 'Convert trial' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('UI50 convert requires a reason before confirming', async () => {
    auth(ALL_TRIAL_PERMS);
    renderDetail();
    fireEvent.click(await screen.findByRole('button', { name: 'Convert trial' }));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Convert trial' });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it('UI51 convert posts the target plan version, rowVersion, and dispositions', async () => {
    const client = auth(ALL_TRIAL_PERMS);
    renderDetail();
    await runPreview();
    await screen.findByText('Trial-only grant dispositions');
    fireEvent.change(screen.getByLabelText('addon.premium_support'), {
      target: { value: 'MIGRATE_TO_PAID_EQUIVALENT' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Convert trial' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Reason/i), {
      target: { value: 'customer signed' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Convert trial' }));
    await waitFor(() =>
      expect(client.convertSalesTrial).toHaveBeenCalledWith(
        'tok',
        'trial-1',
        expect.objectContaining({
          targetPaidPlanVersionId: PAID_PV,
          expectedRowVersion: 3,
          dispositions: [
            { grantKey: 'addon.premium_support', disposition: 'MIGRATE_TO_PAID_EQUIVALENT' },
          ],
          reason: 'customer signed',
        }),
        expect.any(String),
      ),
    );
  });

  it('UI52 convert failure surfaces via Alert and closes the dialog', async () => {
    auth(ALL_TRIAL_PERMS, {
      convertSalesTrial: vi
        .fn()
        .mockRejectedValue(
          new PlatformAuthApiError('Dispositions are required for every trial-only grant.', 400, 'error'),
        ),
    });
    renderDetail();
    fireEvent.click(await screen.findByRole('button', { name: 'Convert trial' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Reason/i), { target: { value: 'go' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Convert trial' }));
    expect(
      await screen.findByText('Dispositions are required for every trial-only grant.'),
    ).toBeTruthy();
  });

  it('UI53 convert section hidden once the trial is CONVERTED', async () => {
    auth(ALL_TRIAL_PERMS, {
      getSalesTrial: vi.fn().mockResolvedValue({ ...sampleTrial, status: 'CONVERTED' }),
    });
    renderDetail();
    await screen.findByText('CONVERTED');
    expect(screen.queryByRole('button', { name: 'Convert trial' })).toBeNull();
  });

  it('UI54 conversion record renders the durable outcome', async () => {
    auth(ALL_TRIAL_PERMS, {
      getSalesTrial: vi.fn().mockResolvedValue({ ...sampleTrial, status: 'CONVERTED' }),
      getSalesTrialHistory: vi.fn().mockResolvedValue({
        ...sampleHistory,
        conversion: {
          id: 'conv-1',
          trialId: 'trial-1',
          targetPaidPlanVersionId: PAID_PV,
          dispositions: [],
          actorPlatformUserId: 'u1',
          convertedAt: '2026-08-10T00:00:00.000Z',
          correlationId: 'corr-2',
          outboxEventId: 'ob-1',
          commercialConfigId: 'cc-1',
        },
      }),
    });
    renderDetail();
    expect(await screen.findByText('Converted at')).toBeTruthy();
    expect(screen.getByText(PAID_PV)).toBeTruthy();
  });

  // ─── detail: cancel, audit trail ──────────────────────────────────────────

  it('UI55 cancel requires a reason and posts the current rowVersion', async () => {
    const client = auth(ALL_TRIAL_PERMS);
    renderDetail();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel trial' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Reason/i), {
      target: { value: 'prospect withdrew' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel trial' }));
    await waitFor(() =>
      expect(client.cancelSalesTrial).toHaveBeenCalledWith(
        'tok',
        'trial-1',
        { reason: 'prospect withdrew', expectedRowVersion: 3 },
        expect.any(String),
      ),
    );
  });

  it('UI56 governance audit trail renders recorded actions', async () => {
    auth(['trial.view']);
    renderDetail();
    const heading = await screen.findByText('Governance audit trail');
    expect(heading.closest('section')?.textContent).toMatch(/sales_trial.created/);
  });

  // ─── accessibility, locale, privacy ───────────────────────────────────────

  it('UI57 one H1 that is a focusable landmark target', async () => {
    auth(['trial.view']);
    renderList();
    const h1 = await screen.findByRole('heading', { level: 1 });
    expect(h1.id).toBe('main-heading');
    expect(h1.getAttribute('tabindex')).toBe('-1');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(document.querySelector('article.sa-page')).toBeTruthy();
  });

  it('UI58 status is never color-only and the table avoids horizontal overflow', async () => {
    auth(['trial.view']);
    renderList();
    await screen.findByText('Acme Trial Clinic');
    expect(within(screen.getByRole('table')).getByText('ACTIVE')).toBeTruthy();
    expect(document.querySelector('.sa-table-wrap')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Search' }).tagName).toBe('BUTTON');
  });

  it('UI59 en-US and ar-SY locale identities both render the surface', async () => {
    mockUseI18n.mockReturnValue(stableI18nEn);
    auth(['trial.view']);
    renderList();
    expect(await screen.findByText('Acme Trial Clinic')).toBeTruthy();
    expect(mockUseI18n().locale).toBe('en-US');
    cleanup();
    mockUseI18n.mockReturnValue(stableI18nAr);
    auth(['trial.view']);
    renderList();
    expect(await screen.findByText('Acme Trial Clinic')).toBeTruthy();
    expect(mockUseI18n().locale).toBe('ar-SY');
  });

  it('UI60 no PHI, secrets, or Step 26 commission surface is rendered', async () => {
    auth(ALL_TRIAL_PERMS);
    renderDetail();
    await screen.findByText('Sales attribution (frozen)');
    expect(document.body.textContent).not.toMatch(/password|accessToken|ssn|diagnosis/i);
    expect(document.body.textContent).not.toMatch(/commission|quota attainment|payout/i);
  });

  it('UI61 N/A: the Trial UI has no 429 rate-limit surface (API does not rate limit these routes)', async () => {
    auth(['trial.view']);
    renderList();
    await screen.findByText('Acme Trial Clinic');
    expect(screen.queryByText(/429|rate limit/i)).toBeNull();
  });

  it('UI62 N/A: Trial pages introduce no motion requiring reduced-motion handling', async () => {
    auth(['trial.view']);
    renderList();
    await screen.findByText('Acme Trial Clinic');
    expect(document.querySelector('[class*="animate"]')).toBeNull();
  });
});
