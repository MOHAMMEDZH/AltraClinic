/**
 * Flexible Step 26 — Super Admin Productivity / Commission Snapshot UI matrix UI01–UI60.
 * Contract: docs/SALES_PRODUCTIVITY_AND_COMMISSION_SNAPSHOT.md
 * Stable i18n identity (audit-center pattern). Mock PlatformAuth + client.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformAuthApiError } from '../../../auth/platform-auth-api';
import { getRouteById, listNavRoutes } from '../../../routing/route-registry';
import { evaluatePermissionPolicy } from '../../../routing/permission-policy';
import { SalesProductivitySelfPage } from './SalesProductivitySelfPage';
import { SalesProductivityTeamPage } from './SalesProductivityTeamPage';
import { SalesCommissionSnapshotsListPage } from './SalesCommissionSnapshotsListPage';
import { SalesCommissionSnapshotDetailPage } from './SalesCommissionSnapshotDetailPage';

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

const PV = '11111111-1111-1111-1111-111111111111';
const ADDON = '22222222-2222-2222-2222-222222222222';

function metric(
  id: string,
  key: string,
  value: number | null,
  completeness: 'COMPLETE' | 'PARTIAL' | 'UNAVAILABLE' | 'NOT_APPLICABLE',
  extras: Record<string, unknown> = {},
) {
  return {
    id,
    key,
    value,
    completeness,
    rankingEligible: completeness === 'COMPLETE' && value !== null,
    ...extras,
  };
}

const sampleBundle = {
  representativeId: 'rep-1',
  periodKey: '2026-08',
  periodTimezone: 'UTC',
  periodStart: '2026-08-01T00:00:00.000Z',
  periodEnd: '2026-09-01T00:00:00.000Z',
  sourceCutoffAt: '2026-08-11T12:00:00.000Z',
  metrics: [] as ReturnType<typeof metric>[],
  metricsByKey: {
    leads_created: metric('M01', 'leads_created', 10, 'COMPLETE'),
    activities: metric('M02', 'activities', 4, 'COMPLETE'),
    demos_scheduled: metric('M03', 'demos_scheduled', 2, 'COMPLETE'),
    demos_completed: metric('M04', 'demos_completed', 1, 'COMPLETE'),
    trials_created: metric('M05', 'trials_created', 0, 'COMPLETE'),
    won: metric('M06', 'won', 3, 'COMPLETE'),
    lost: metric('M07', 'lost', 1, 'COMPLETE'),
    paid_conversions: metric('M08', 'paid_conversions', 0, 'COMPLETE'),
    lead_to_won_rate: metric('M09', 'lead_to_won_rate', 0.3, 'COMPLETE', {
      numerator: 3,
      denominator: 10,
    }),
    trial_to_paid_rate: metric('M10', 'trial_to_paid_rate', null, 'NOT_APPLICABLE', {
      numerator: 0,
      denominator: 0,
      explanation: 'denominator_zero',
    }),
    time_to_convert_days: metric('M11', 'time_to_convert_days', null, 'NOT_APPLICABLE'),
    active_customers: metric('M12', 'active_customers', 5, 'COMPLETE'),
    cancellations: metric('M13', 'cancellations', 0, 'COMPLETE'),
    plan_version_mix: metric('M14', 'plan_version_mix', null, 'COMPLETE'),
    addon_sales: metric('M15', 'addon_sales', 1, 'COMPLETE'),
    target_progress: metric('M16', 'target_progress', null, 'NOT_APPLICABLE', {
      explanation: 'target_unit_unconfigured_for_money',
    }),
    converted_customers: metric('M17', 'converted_customers', 0, 'COMPLETE'),
    cancellation_attribution: metric('M18', 'cancellation_attribution', 0, 'PARTIAL'),
    period_source_completeness: metric('M19', 'period_source_completeness', null, 'COMPLETE'),
    reporting_completeness: metric('M20', 'reporting_completeness', null, 'PARTIAL'),
  },
  planVersionAttribution: [{ planVersionId: PV, count: 2 }],
  addOnAttribution: [{ addOnVersionId: ADDON, count: 1, basis: 'assignment_created' as const }],
  cancellationAttribution: {
    count: 0,
    basis: 'current_ownership_partial' as const,
    completeness: 'PARTIAL' as const,
  },
  completeness: {
    metrics: {},
    period_source_completeness: 'COMPLETE' as const,
    reporting_completeness: 'PARTIAL' as const,
  },
};

sampleBundle.metrics = Object.values(sampleBundle.metricsByKey);

const incompleteBundle = {
  ...sampleBundle,
  representativeId: 'rep-2',
  completeness: {
    ...sampleBundle.completeness,
    reporting_completeness: 'PARTIAL' as const,
  },
};

const sampleSnapshot = {
  id: 'snap-1',
  representativeId: 'rep-1',
  periodKey: '2026-08',
  periodTimezone: 'UTC',
  periodStart: '2026-08-01T00:00:00.000Z',
  periodEnd: '2026-09-01T00:00:00.000Z',
  sourceCutoffAt: '2026-08-11T12:00:00.000Z',
  formulaVersion: 'step26.unconfigured.v1',
  calculationStatus: 'UNCONFIGURED' as const,
  ruleReference: null,
  computedAmount: null,
  metrics: {},
  planVersionAttribution: [{ planVersionId: PV, count: 2 }],
  addOnAttribution: [{ addOnVersionId: ADDON, count: 1, basis: 'assignment_created' as const }],
  completeness: {
    metrics: {},
    period_source_completeness: 'COMPLETE' as const,
    reporting_completeness: 'PARTIAL' as const,
  },
  reconciliation: null,
  reviewStatus: 'NONE' as const,
  paidStatus: 'UNPAID' as const,
  paidReason: null,
  paidReference: null,
  paidAt: null,
  paidByPlatformUserId: null,
  status: 'DRAFT' as const,
  supersedesSnapshotId: null,
  rowVersion: 2,
  createdAt: '2026-08-11T12:00:00.000Z',
  updatedAt: '2026-08-11T12:00:00.000Z',
  finalizedAt: null,
};

function clientMocks(overrides: Record<string, unknown> = {}) {
  return {
    getSalesProductivitySelf: vi.fn().mockResolvedValue(sampleBundle),
    getSalesProductivityTeam: vi
      .fn()
      .mockResolvedValue({ items: [sampleBundle, incompleteBundle], periodKey: '2026-08' }),
    exportSalesProductivity: vi.fn().mockResolvedValue({
      body: 'representativeId,periodKey\nrep-1,2026-08\n',
      filename: 'sales-productivity-2026-08.csv',
      contentType: 'text/csv; charset=utf-8',
    }),
    listSalesCommissionSnapshots: vi.fn().mockResolvedValue({
      items: [sampleSnapshot],
      total: 1,
      page: 1,
      pageSize: 25,
    }),
    getSalesCommissionSnapshot: vi.fn().mockResolvedValue(sampleSnapshot),
    generateSalesCommissionSnapshot: vi.fn().mockResolvedValue({
      ...sampleSnapshot,
      id: 'snap-new',
      replayed: false,
      correlationId: 'corr-1',
    }),
    reviewSalesCommissionSnapshot: vi.fn().mockResolvedValue({
      ...sampleSnapshot,
      reviewStatus: 'REVIEWED',
      rowVersion: 3,
      replayed: false,
      correlationId: 'corr-2',
    }),
    markSalesCommissionSnapshotPaid: vi.fn().mockResolvedValue({
      ...sampleSnapshot,
      paidStatus: 'PAID',
      rowVersion: 3,
      replayed: false,
      correlationId: 'corr-3',
    }),
    ...overrides,
  };
}

const ALL_PERMS = [
  'sales-report.view',
  'sales-report.export',
  'commission-snapshot.view',
  'commission-snapshot.review',
  'commission-snapshot.generate',
  'commission-snapshot.mark-paid',
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

function renderSelf() {
  return render(
    <MemoryRouter>
      <SalesProductivitySelfPage />
    </MemoryRouter>,
  );
}

function renderTeam() {
  return render(
    <MemoryRouter>
      <SalesProductivityTeamPage />
    </MemoryRouter>,
  );
}

function renderSnapshots() {
  return render(
    <MemoryRouter>
      <SalesCommissionSnapshotsListPage />
    </MemoryRouter>,
  );
}

function renderSnapshotDetail(id = 'snap-1') {
  return render(
    <MemoryRouter initialEntries={[`/sales/commission-snapshots/${id}`]}>
      <Routes>
        <Route path="/sales/commission-snapshots/:id" element={<SalesCommissionSnapshotDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Step 26 Sales Productivity UI UI01–UI60', () => {
  beforeEach(() => {
    mockUseI18n.mockReturnValue(stableI18nEn);
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: vi.fn(() => 'blob:mock'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // ─── navigation and route policy ──────────────────────────────────────────

  it('UI01 authorized productivity nav visible for sales-report.view', () => {
    const route = getRouteById('sales-productivity');
    expect(route?.status).toBe('available');
    expect(route?.step).toBe(26);
    const nav = listNavRoutes({ permissions: ['sales-report.view'] });
    expect(nav.some((r) => r.id === 'sales-productivity')).toBe(true);
    expect(nav.some((r) => r.id === 'sales-productivity-team')).toBe(true);
  });

  it('UI02 unauthorized productivity nav hidden', () => {
    const nav = listNavRoutes({ permissions: ['sales-lead.view'] });
    expect(nav.some((r) => r.id === 'sales-productivity')).toBe(false);
    expect(nav.some((r) => r.id === 'sales-productivity-team')).toBe(false);
  });

  it('UI03 authorized commission snapshot nav for commission-snapshot.view', () => {
    const route = getRouteById('sales-commission-snapshots');
    expect(route?.status).toBe('available');
    expect(route?.step).toBe(26);
    const nav = listNavRoutes({ permissions: ['commission-snapshot.view'] });
    expect(nav.some((r) => r.id === 'sales-commission-snapshots')).toBe(true);
  });

  it('UI04 unauthorized commission snapshot nav hidden', () => {
    const nav = listNavRoutes({ permissions: ['sales-report.view'] });
    expect(nav.some((r) => r.id === 'sales-commission-snapshots')).toBe(false);
  });

  it('UI05 self productivity route policy requires sales-report.view', () => {
    const route = getRouteById('sales-productivity');
    expect(evaluatePermissionPolicy({ permissions: ['sales-report.view'] }, route!.policy)).toBe(
      true,
    );
    expect(evaluatePermissionPolicy({ permissions: [] }, route!.policy)).toBe(false);
  });

  it('UI06 team productivity route policy requires sales-report.view', () => {
    const route = getRouteById('sales-productivity-team');
    expect(evaluatePermissionPolicy({ permissions: ['sales-report.view'] }, route!.policy)).toBe(
      true,
    );
  });

  it('UI07 snapshot list route policy requires commission-snapshot.view', () => {
    const route = getRouteById('sales-commission-snapshots');
    expect(
      evaluatePermissionPolicy({ permissions: ['commission-snapshot.view'] }, route!.policy),
    ).toBe(true);
    expect(evaluatePermissionPolicy({ permissions: ['sales-report.view'] }, route!.policy)).toBe(
      false,
    );
  });

  it('UI08 snapshot detail route policy requires commission-snapshot.view', () => {
    const route = getRouteById('sales-commission-snapshots-detail');
    expect(
      evaluatePermissionPolicy({ permissions: ['commission-snapshot.view'] }, route!.policy),
    ).toBe(true);
  });

  it('UI09 trial permissions alone never unlock productivity or commission surfaces', () => {
    const nav = listNavRoutes({ permissions: ['trial.view', 'trial.create'] });
    expect(nav.some((r) => r.id === 'sales-productivity')).toBe(false);
    expect(nav.some((r) => r.id === 'sales-commission-snapshots')).toBe(false);
  });

  // ─── self productivity ────────────────────────────────────────────────────

  it('UI10 self page renders month selector', async () => {
    auth(['sales-report.view']);
    renderSelf();
    expect(await screen.findByLabelText('Month')).toBeTruthy();
    expect((screen.getByLabelText('Month') as HTMLInputElement).type).toBe('month');
  });

  it('UI11 self page loads productivity for the selected period', async () => {
    const client = auth(['sales-report.view']);
    renderSelf();
    await waitFor(() => expect(client.getSalesProductivitySelf).toHaveBeenCalled());
    const [, query] = client.getSalesProductivitySelf.mock.calls[0];
    expect(query.periodKey).toMatch(/^\d{4}-\d{2}$/);
  });

  it('UI12 self page shows KPI table with completeness markers', async () => {
    auth(['sales-report.view']);
    renderSelf();
    expect(await screen.findByText('Leads created')).toBeTruthy();
    expect(screen.getByTestId('metric-value-leads_created').textContent).toBe('10');
    const rateRow = screen.getByTestId('metric-value-trial_to_paid_rate');
    expect(rateRow.textContent).not.toMatch(/0%/);
    expect(rateRow.textContent).toMatch(/Incomplete|—/);
  });

  it('UI13 incomplete rates are never shown as zero percent', async () => {
    auth(['sales-report.view']);
    renderSelf();
    await screen.findByTestId('metric-value-trial_to_paid_rate');
    expect(screen.getByTestId('metric-value-trial_to_paid_rate').textContent).not.toContain('0.0%');
    expect(screen.getByTestId('metric-value-trial_to_paid_rate').textContent).not.toBe('0%');
  });

  it('UI14 conversion formula explains numerator and denominator', async () => {
    auth(['sales-report.view']);
    renderSelf();
    const formula = await screen.findByTestId('metric-formula-lead_to_won_rate');
    expect(formula.textContent).toMatch(/won \/ leads_created_in_period/);
    expect(formula.textContent).toMatch(/3 \/ 10/);
  });

  it('UI15 zero-denominator rate explains NOT_APPLICABLE', async () => {
    auth(['sales-report.view']);
    renderSelf();
    const formula = await screen.findByTestId('metric-formula-trial_to_paid_rate');
    expect(formula.textContent).toMatch(/Denominator is 0/);
  });

  it('UI16 Plan Version mix renders plan version ids', async () => {
    auth(['sales-report.view']);
    renderSelf();
    expect(await screen.findByText('Plan Version mix')).toBeTruthy();
    expect(screen.getByText(PV)).toBeTruthy();
  });

  it('UI17 Add-on attribution renders basis', async () => {
    auth(['sales-report.view']);
    renderSelf();
    expect(await screen.findByText('Add-on attribution')).toBeTruthy();
    expect(screen.getByText(ADDON)).toBeTruthy();
    expect(screen.getByText('assignment_created')).toBeTruthy();
  });

  it('UI18 target progress shows NOT_APPLICABLE instead of zero', async () => {
    auth(['sales-report.view']);
    renderSelf();
    const target = await screen.findByTestId('target-progress-value');
    expect(target.textContent).not.toMatch(/^0/);
    expect(target.textContent).toMatch(/Incomplete|—/);
  });

  it('UI19 incomplete reporting completeness marks UNRANKED', async () => {
    auth(['sales-report.view']);
    renderSelf();
    expect((await screen.findByTestId('productivity-rank-status')).textContent).toBe('UNRANKED');
  });

  it('UI20 self page has no ranking leaderboard UI', async () => {
    auth(['sales-report.view']);
    renderSelf();
    await screen.findByText('My productivity');
    expect(screen.queryByText(/leaderboard/i)).toBeNull();
    expect(screen.queryByText(/rank #/i)).toBeNull();
  });

  it('UI21 export button hidden without sales-report.export', async () => {
    auth(['sales-report.view']);
    renderSelf();
    await screen.findByText('My productivity');
    expect(screen.queryByRole('button', { name: 'Export CSV' })).toBeNull();
  });

  it('UI22 export button visible with sales-report.export', async () => {
    auth(['sales-report.view', 'sales-report.export']);
    renderSelf();
    expect(await screen.findByRole('button', { name: 'Export CSV' })).toBeTruthy();
  });

  it('UI23 export calls productivity export API', async () => {
    const client = auth(['sales-report.view', 'sales-report.export']);
    renderSelf();
    fireEvent.click(await screen.findByRole('button', { name: 'Export CSV' }));
    await waitFor(() => expect(client.exportSalesProductivity).toHaveBeenCalled());
  });

  it('UI24 self load error surfaces via Alert', async () => {
    auth(['sales-report.view'], {
      getSalesProductivitySelf: vi
        .fn()
        .mockRejectedValue(new PlatformAuthApiError('boom', 500)),
    });
    renderSelf();
    expect(await screen.findByText('boom')).toBeTruthy();
  });

  it('UI25 period apply re-queries self productivity', async () => {
    const client = auth(['sales-report.view']);
    renderSelf();
    await waitFor(() => expect(client.getSalesProductivitySelf).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText('Month'), { target: { value: '2026-07' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(client.getSalesProductivitySelf).toHaveBeenCalledTimes(2));
    expect(client.getSalesProductivitySelf.mock.calls.at(-1)?.[1]).toEqual({ periodKey: '2026-07' });
  });

  // ─── team productivity ────────────────────────────────────────────────────

  it('UI26 team page renders month selector and representative filter', async () => {
    auth(['sales-report.view']);
    renderTeam();
    expect(await screen.findByLabelText('Month')).toBeTruthy();
    expect(screen.getByText('Representative id')).toBeTruthy();
  });

  it('UI27 team page lists scoped representatives', async () => {
    const client = auth(['sales-report.view']);
    renderTeam();
    await waitFor(() => expect(client.getSalesProductivityTeam).toHaveBeenCalled());
    expect(screen.getAllByTestId('team-rep-row').length).toBe(2);
  });

  it('UI28 team incomplete rows stay UNRANKED', async () => {
    auth(['sales-report.view']);
    renderTeam();
    const ranks = await screen.findAllByTestId('productivity-rank-status');
    expect(ranks.some((el) => el.textContent === 'UNRANKED')).toBe(true);
  });

  it('UI29 team load forbidden surfaces via Alert', async () => {
    auth(['sales-report.view'], {
      getSalesProductivityTeam: vi
        .fn()
        .mockRejectedValue(
          new PlatformAuthApiError('Team productivity requires manager/review scope.', 403),
        ),
    });
    renderTeam();
    expect(await screen.findByText(/manager\/review scope/i)).toBeTruthy();
  });

  it('UI30 team empty state when no items', async () => {
    auth(['sales-report.view'], {
      getSalesProductivityTeam: vi.fn().mockResolvedValue({ items: [], periodKey: '2026-08' }),
    });
    renderTeam();
    expect(await screen.findByText('No team metrics')).toBeTruthy();
  });

  // ─── commission snapshots list ────────────────────────────────────────────

  it('UI31 snapshot list renders period and calculation UNCONFIGURED', async () => {
    auth(['commission-snapshot.view']);
    renderSnapshots();
    expect(await screen.findByText('2026-08')).toBeTruthy();
    expect(screen.getAllByText('UNCONFIGURED').length).toBeGreaterThan(0);
  });

  it('UI32 snapshot list states paid is administrative', async () => {
    auth(['commission-snapshot.view']);
    renderSnapshots();
    expect((await screen.findByTestId('commission-admin-notice')).textContent ?? '').toMatch(
      /administrative|does not execute payment/i,
    );
  });

  it('UI33 generate form hidden without commission-snapshot.generate', async () => {
    auth(['commission-snapshot.view']);
    renderSnapshots();
    await screen.findByRole('heading', { level: 1, name: 'Commission snapshots' });
    expect(screen.queryByRole('button', { name: 'Generate snapshot' })).toBeNull();
  });

  it('UI34 generate posts with idempotency key', async () => {
    const client = auth(['commission-snapshot.view', 'commission-snapshot.generate']);
    renderSnapshots();
    fireEvent.change(await screen.findByLabelText(/Representative id/i), {
      target: { value: 'rep-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Generate snapshot' }));
    await waitFor(() => expect(client.generateSalesCommissionSnapshot).toHaveBeenCalled());
    const [, body, key] = client.generateSalesCommissionSnapshot.mock.calls[0];
    expect(body.representativeId).toBe('rep-1');
    expect(typeof key).toBe('string');
    expect((key as string).length).toBeGreaterThan(10);
  });

  it('UI35 snapshot list status filter re-queries', async () => {
    const client = auth(['commission-snapshot.view']);
    renderSnapshots();
    await waitFor(() => expect(client.listSalesCommissionSnapshots).toHaveBeenCalled());
    fireEvent.change(screen.getByDisplayValue('All statuses'), {
      target: { value: 'DRAFT' },
    });
    await waitFor(() =>
      expect(
        client.listSalesCommissionSnapshots.mock.calls.some(
          (call: unknown[]) => (call[1] as { status?: string }).status === 'DRAFT',
        ),
      ).toBe(true),
    );
  });

  it('UI36 snapshot list empty state', async () => {
    auth(['commission-snapshot.view'], {
      listSalesCommissionSnapshots: vi
        .fn()
        .mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }),
    });
    renderSnapshots();
    expect(await screen.findByText('No snapshots found')).toBeTruthy();
  });

  it('UI37 snapshot list error surfaces via Alert', async () => {
    auth(['commission-snapshot.view'], {
      listSalesCommissionSnapshots: vi
        .fn()
        .mockRejectedValue(new PlatformAuthApiError('list failed', 500)),
    });
    renderSnapshots();
    expect(await screen.findByText('list failed')).toBeTruthy();
  });

  it('UI38 snapshot list pagination summary', async () => {
    auth(['commission-snapshot.view']);
    renderSnapshots();
    expect(await screen.findByText(/Page 1/)).toBeTruthy();
  });

  // ─── commission snapshot detail ───────────────────────────────────────────

  it('UI39 detail shows calculationStatus UNCONFIGURED', async () => {
    auth(['commission-snapshot.view']);
    renderSnapshotDetail();
    expect((await screen.findByTestId('calculation-status')).textContent).toContain('UNCONFIGURED');
  });

  it('UI40 detail shows computed amount as unconfigured not invented', async () => {
    auth(['commission-snapshot.view']);
    renderSnapshotDetail();
    expect((await screen.findByTestId('computed-amount')).textContent ?? '').toMatch(/UNCONFIGURED|—/);
    expect(screen.queryByText(/\$\d/)).toBeNull();
  });

  it('UI41 detail shows Plan Version mix and Add-on attribution', async () => {
    auth(['commission-snapshot.view']);
    renderSnapshotDetail();
    expect(await screen.findByText('Plan Version mix')).toBeTruthy();
    expect(screen.getByText('Add-on attribution')).toBeTruthy();
    expect(screen.getByText(PV)).toBeTruthy();
    expect(screen.getByText(ADDON)).toBeTruthy();
  });

  it('UI42 detail paid notice is clearly administrative', async () => {
    auth(['commission-snapshot.view']);
    renderSnapshotDetail();
    expect((await screen.findByTestId('commission-admin-notice')).textContent ?? '').toMatch(
      /administrative|does not execute payment/i,
    );
  });

  it('UI43 review section hidden without commission-snapshot.review', async () => {
    auth(['commission-snapshot.view']);
    renderSnapshotDetail();
    await screen.findByTestId('calculation-status');
    expect(screen.queryByRole('button', { name: 'Update review' })).toBeNull();
  });

  it('UI44 review posts status, rowVersion, and idempotency key', async () => {
    const client = auth(['commission-snapshot.view', 'commission-snapshot.review']);
    renderSnapshotDetail();
    fireEvent.click(await screen.findByRole('button', { name: 'Update review' }));
    await waitFor(() => expect(client.reviewSalesCommissionSnapshot).toHaveBeenCalled());
    const [, id, body, key] = client.reviewSalesCommissionSnapshot.mock.calls[0];
    expect(id).toBe('snap-1');
    expect(body.expectedRowVersion).toBe(2);
    expect(typeof key).toBe('string');
  });

  it('UI45 mark-paid section hidden without commission-snapshot.mark-paid', async () => {
    auth(['commission-snapshot.view']);
    renderSnapshotDetail();
    await screen.findByTestId('calculation-status');
    expect(screen.queryByRole('button', { name: 'Update paid status' })).toBeNull();
  });

  it('UI46 mark-paid posts administrative status with idempotency key', async () => {
    const client = auth(['commission-snapshot.view', 'commission-snapshot.mark-paid']);
    renderSnapshotDetail();
    fireEvent.click(await screen.findByRole('button', { name: 'Update paid status' }));
    await waitFor(() => expect(client.markSalesCommissionSnapshotPaid).toHaveBeenCalled());
    const [, id, body, key] = client.markSalesCommissionSnapshotPaid.mock.calls[0];
    expect(id).toBe('snap-1');
    expect(body.paidStatus).toBe('PAID');
    expect(body.expectedRowVersion).toBe(2);
    expect(typeof key).toBe('string');
  });

  it('UI47 mark-paid success states no money moved', async () => {
    auth(['commission-snapshot.view', 'commission-snapshot.mark-paid']);
    renderSnapshotDetail();
    fireEvent.click(await screen.findByRole('button', { name: 'Update paid status' }));
    expect(await screen.findByText(/No money was moved/i)).toBeTruthy();
  });

  it('UI48 detail load error surfaces via Alert', async () => {
    auth(['commission-snapshot.view'], {
      getSalesCommissionSnapshot: vi
        .fn()
        .mockRejectedValue(new PlatformAuthApiError('missing', 404)),
    });
    renderSnapshotDetail();
    expect(await screen.findByText('missing')).toBeTruthy();
  });

  it('UI49 detail links to Audit Center', async () => {
    auth(['commission-snapshot.view']);
    renderSnapshotDetail();
    const link = await screen.findByRole('link', { name: 'Open Audit Center' });
    expect(link.getAttribute('href')).toBe('/audit');
  });

  it('UI50 detail shows reporting completeness marker', async () => {
    auth(['commission-snapshot.view']);
    renderSnapshotDetail();
    expect(await screen.findByText('Reporting completeness')).toBeTruthy();
    expect(screen.getByText('PARTIAL')).toBeTruthy();
  });

  // ─── boundaries / a11y / i18n ─────────────────────────────────────────────

  it('UI51 no payroll UI copy', async () => {
    auth(ALL_PERMS);
    renderSelf();
    await screen.findByText('My productivity');
    expect(document.body.textContent).not.toMatch(/payslip|bank transfer|tax filing|payroll run/i);
  });

  it('UI52 no Step 27 notification UI', async () => {
    auth(ALL_PERMS);
    renderSnapshots();
    await screen.findByRole('heading', { level: 1, name: 'Commission snapshots' });
    expect(document.body.textContent).not.toMatch(/notification template/i);
  });

  it('UI53 no PHI prompts on productivity or commission pages', async () => {
    auth(ALL_PERMS);
    renderSnapshotDetail();
    await screen.findByTestId('calculation-status');
    expect(document.body.textContent).not.toMatch(/\bPHI\b.*enter|patient name|diagnosis/i);
  });

  it('UI54 boundary note present on self page', async () => {
    auth(['sales-report.view']);
    renderSelf();
    expect(await screen.findByText(/no payroll, bank, tax, PHI/i)).toBeTruthy();
  });

  it('UI55 one H1 focusable landmark on self page', async () => {
    auth(['sales-report.view']);
    renderSelf();
    const h1 = await screen.findByRole('heading', { level: 1 });
    expect(h1).toBeTruthy();
  });

  it('UI56 status is never color-only — StatusBadge text present', async () => {
    auth(['commission-snapshot.view']);
    renderSnapshots();
    expect(await screen.findByText('DRAFT')).toBeTruthy();
    expect(screen.getByText('UNPAID')).toBeTruthy();
    expect(screen.getByText('UNCONFIGURED')).toBeTruthy();
  });

  it('UI57 table wrap avoids horizontal overflow class usage', async () => {
    auth(['sales-report.view']);
    renderSelf();
    await screen.findByText('Leads created');
    expect(document.querySelector('.sa-table-wrap')).toBeTruthy();
  });

  it('UI58 en-US and ar-SY locale identities both render the surface', async () => {
    auth(['sales-report.view']);
    mockUseI18n.mockReturnValue(stableI18nEn);
    const { unmount } = renderSelf();
    expect(await screen.findByText('My productivity')).toBeTruthy();
    unmount();
    mockUseI18n.mockReturnValue(stableI18nAr);
    renderSelf();
    expect(await screen.findByText('My productivity')).toBeTruthy();
  });

  it('UI59 snapshot detail never invents commission rates or amounts', async () => {
    auth(ALL_PERMS);
    renderSnapshotDetail();
    await screen.findByTestId('computed-amount');
    expect(screen.queryByText(/configured rate table/i)).toBeNull();
    expect(screen.getByTestId('computed-amount').textContent).not.toMatch(/\d+\.\d{2}/);
    expect(screen.getByTestId('calculation-status').textContent).toContain('UNCONFIGURED');
  });

  it('UI60 no payroll / bank / tax / PHI / Step 27 surfaces across Step 26 pages', async () => {
    auth(ALL_PERMS);
    const { unmount } = renderSelf();
    await screen.findByText('My productivity');
    let body = document.body.textContent ?? '';
    expect(body).not.toMatch(/payslip|wire transfer|GL account|invoice ledger/i);
    unmount();

    renderTeam();
    await screen.findByText('Team productivity');
    body = document.body.textContent ?? '';
    expect(body).not.toMatch(/notification center|template editor/i);
    cleanup();

    renderSnapshots();
    await screen.findByRole('heading', { level: 1, name: 'Commission snapshots' });
    body = document.body.textContent ?? '';
    expect(body).toMatch(/administrative/);
    expect(body).not.toMatch(/payment gateway|bank account number/i);

    const table = screen.getByRole('table');
    expect(within(table).queryByText(/SSN|MRN|diagnosis/i)).toBeNull();
  });
});
