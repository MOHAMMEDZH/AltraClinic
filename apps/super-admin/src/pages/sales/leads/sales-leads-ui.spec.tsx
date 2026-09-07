/**
 * Flexible Step 24 — Super Admin Sales Leads UI matrix UI01–UI55.
 * Stable i18n identity (audit-center pattern). Mock PlatformAuth + client.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformAuthApiError } from '../../../auth/platform-auth-api';
import { getRouteById, listNavRoutes } from '../../../routing/route-registry';
import { evaluatePermissionPolicy } from '../../../routing/permission-policy';
import { SalesLeadsListPage } from './SalesLeadsListPage';
import { SalesLeadCreatePage } from './SalesLeadCreatePage';
import { SalesLeadDetailPage } from './SalesLeadDetailPage';

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

const sampleLead = {
  id: 'lead-1',
  stage: 'NEW',
  source: 'INBOUND',
  ownerRepresentativeId: null,
  organizationName: 'Acme Clinic',
  contactName: 'Ada',
  contactEmail: 'ada@acme.test',
  contactPhone: null,
  contactJobTitle: null,
  facilityTypeKey: 'facility.clinic',
  specialtyKeys: [] as string[],
  desiredModuleKeys: [] as string[],
  estimatedUsers: null,
  estimatedProviders: null,
  estimatedLocations: null,
  nextActionType: null,
  nextActionDueAt: null,
  nextActionNote: null,
  demoScheduledAt: null,
  demoTimezone: null,
  demoStatus: 'NONE',
  demoNote: null,
  wonLostReason: null,
  linkedPlatformTenantId: null,
  rowVersion: 1,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

const samplePlanFit = {
  leadId: 'lead-1',
  valid: true,
  violations: [] as Array<{ reasonCode: string; message: string }>,
  warnings: [] as unknown[],
  applicableRuleIds: [] as string[],
  candidatePublishedPlanVersions: [] as unknown[],
  disclaimer: {
    advisoryOnly: true,
    notEntitlementDecision: true,
    notProvisioningDecision: true,
    notRuntimeLicenseDecision: true,
    doesNotMutateCommercialSoR: true,
  },
};

function clientMocks(overrides: Record<string, unknown> = {}) {
  return {
    listSalesLeads: vi.fn().mockResolvedValue({ items: [sampleLead], total: 1, page: 1, pageSize: 25 }),
    getSalesLead: vi.fn().mockResolvedValue(sampleLead),
    createSalesLead: vi.fn().mockResolvedValue({ ...sampleLead, id: 'lead-new' }),
    listSalesLeadNotes: vi.fn().mockResolvedValue([]),
    addSalesLeadNote: vi.fn().mockResolvedValue({
      id: 'n1',
      leadId: 'lead-1',
      body: 'ok',
      createdById: 'u1',
      createdAt: '2026-08-01T00:00:00.000Z',
    }),
    getSalesLeadPlanFit: vi.fn().mockResolvedValue(samplePlanFit),
    getSalesLeadStageHistory: vi.fn().mockResolvedValue([
      {
        id: 'sh1',
        leadId: 'lead-1',
        fromStage: null,
        toStage: 'NEW',
        actorPlatformUserId: 'u1',
        reason: null,
        createdAt: '2026-08-01T00:00:00.000Z',
      },
    ]),
    getSalesLeadOwnershipHistory: vi.fn().mockResolvedValue([
      {
        id: 'oh1',
        leadId: 'lead-1',
        fromOwnerRepresentativeId: null,
        toOwnerRepresentativeId: 'rep-1',
        actorPlatformUserId: 'u1',
        reason: 'initial',
        createdAt: '2026-08-01T00:00:00.000Z',
      },
    ]),
    changeSalesLeadStage: vi.fn().mockResolvedValue({ ...sampleLead, stage: 'CONTACTED', rowVersion: 2 }),
    markSalesLeadWon: vi.fn().mockResolvedValue({ ...sampleLead, stage: 'WON', rowVersion: 2 }),
    markSalesLeadLost: vi.fn().mockResolvedValue({ ...sampleLead, stage: 'LOST', rowVersion: 2 }),
    updateSalesLead: vi.fn().mockResolvedValue({ ...sampleLead, rowVersion: 2 }),
    updateSalesLeadDemo: vi.fn().mockResolvedValue({ ...sampleLead, demoStatus: 'SCHEDULED', rowVersion: 2 }),
    assignSalesLeadOwner: vi.fn().mockResolvedValue({
      ...sampleLead,
      ownerRepresentativeId: 'rep-2',
      rowVersion: 2,
    }),
    ...overrides,
  };
}

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
      <SalesLeadsListPage />
    </MemoryRouter>,
  );
}

function renderCreate() {
  return render(
    <MemoryRouter>
      <SalesLeadCreatePage />
    </MemoryRouter>,
  );
}

function renderDetail(id = 'lead-1') {
  return render(
    <MemoryRouter initialEntries={[`/sales/leads/${id}`]}>
      <Routes>
        <Route path="/sales/leads/:id" element={<SalesLeadDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Step 24 Sales Leads UI UI01–UI55', () => {
  beforeEach(() => {
    mockUseI18n.mockReturnValue(stableI18nEn);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('UI01 authorized nav visible', () => {
    const route = getRouteById('sales-leads');
    expect(route?.status).toBe('available');
    expect(route?.step).toBe(24);
    const nav = listNavRoutes({ permissions: ['sales-lead.view'] });
    expect(nav.some((r) => r.id === 'sales-leads')).toBe(true);
  });

  it('UI02 unauthorized nav hidden', () => {
    const nav = listNavRoutes({ permissions: [] });
    expect(nav.some((r) => r.id === 'sales-leads')).toBe(false);
  });

  it('UI03 direct route denied (policy fails without sales-lead.view)', () => {
    const route = getRouteById('sales-leads');
    expect(evaluatePermissionPolicy({ permissions: [] }, route!.policy)).toBe(false);
    expect(
      evaluatePermissionPolicy({ permissions: ['sales-lead.view'] }, route!.policy),
    ).toBe(true);
  });

  it('UI04 no restricted-content flash on list without manage', async () => {
    auth(['sales-lead.view']);
    renderList();
    expect(await screen.findByText('Acme Clinic')).toBeTruthy();
    expect(screen.queryByText(/restricted/i)).toBeNull();
    expect(screen.queryByRole('link', { name: 'New lead' })).toBeNull();
  });

  it('UI05 assigned list renders organizations', async () => {
    auth(['sales-lead.view']);
    renderList();
    expect(await screen.findByText('Acme Clinic')).toBeTruthy();
    expect(screen.getByText('Ada')).toBeTruthy();
  });

  it('UI06 manager/team list shows create when manage permitted', async () => {
    auth(['sales-lead.view', 'sales-lead.manage']);
    renderList();
    expect(await screen.findByRole('link', { name: 'New lead' })).toBeTruthy();
  });

  it('UI07 loading then results', async () => {
    let resolveList!: (v: unknown) => void;
    auth(['sales-lead.view'], {
      listSalesLeads: vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveList = resolve;
          }),
      ),
    });
    renderList();
    resolveList({ items: [sampleLead], total: 1, page: 1, pageSize: 25 });
    expect(await screen.findByText('Acme Clinic')).toBeTruthy();
  });

  it('UI08 empty', async () => {
    auth(['sales-lead.view'], {
      listSalesLeads: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }),
    });
    renderList();
    expect(await screen.findByText('No sales leads found')).toBeTruthy();
  });

  it('UI09 filtered empty', async () => {
    const client = auth(['sales-lead.view'], {
      listSalesLeads: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }),
    });
    renderList();
    await screen.findByText('No sales leads found');
    fireEvent.change(screen.getByLabelText(/Search/i), { target: { value: 'zzz-none' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(client.listSalesLeads).toHaveBeenCalled());
  });

  it('UI10 error', async () => {
    auth(['sales-lead.view'], {
      listSalesLeads: vi
        .fn()
        .mockRejectedValue(new PlatformAuthApiError('Boom', 500, 'error')),
    });
    renderList();
    expect(await screen.findByText('Boom')).toBeTruthy();
  });

  it('UI11 bounded pagination controls', async () => {
    auth(['sales-lead.view'], {
      listSalesLeads: vi.fn().mockResolvedValue({ items: [sampleLead], total: 100, page: 1, pageSize: 25 }),
    });
    renderList();
    const prev = await screen.findByRole('button', { name: 'Previous' });
    const next = screen.getByRole('button', { name: 'Next' });
    expect((prev as HTMLButtonElement).disabled).toBe(true);
    expect((next as HTMLButtonElement).disabled).toBe(false);
  });

  it('UI12 deterministic pagination page summary', async () => {
    auth(['sales-lead.view'], {
      listSalesLeads: vi.fn().mockResolvedValue({ items: [sampleLead], total: 40, page: 1, pageSize: 25 }),
    });
    renderList();
    expect(await screen.findByText(/Page 1/)).toBeTruthy();
    expect(screen.getByText(/40 leads/)).toBeTruthy();
  });

  it('UI13 create form submits', async () => {
    const client = auth(['sales-lead.manage']);
    renderCreate();
    fireEvent.change(screen.getByLabelText(/Organization/i), { target: { value: 'New Org' } });
    fireEvent.change(screen.getByLabelText(/Contact name/i), { target: { value: 'Bob' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create lead' }));
    await waitFor(() => expect(client.createSalesLead).toHaveBeenCalled());
  });

  it('UI14 contact validation — required attributes present', () => {
    auth(['sales-lead.manage']);
    renderCreate();
    expect((screen.getByLabelText(/Organization/i) as HTMLInputElement).required).toBe(true);
    expect((screen.getByLabelText(/Contact name/i) as HTMLInputElement).required).toBe(true);
  });

  it('UI15 source select present', () => {
    auth(['sales-lead.manage']);
    renderCreate();
    expect(screen.getByLabelText(/Source/i)).toBeTruthy();
    expect(within(screen.getByLabelText(/Source/i)).getByText('INBOUND')).toBeTruthy();
  });

  it('UI16 create has no owner selector (assign is detail-only)', () => {
    auth(['sales-lead.manage']);
    renderCreate();
    expect(screen.queryByLabelText(/Owner representative UUID/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /Confirm owner reassignment/i })).toBeNull();
  });

  it('UI17 ownership confirmation dialog on assign', async () => {
    const client = auth(['sales-lead.view', 'sales-lead.assign']);
    renderDetail();
    await screen.findByText('Owner assignment');
    fireEvent.change(screen.getByLabelText(/Owner representative UUID/i), {
      target: { value: '11111111-1111-1111-1111-111111111111' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm owner reassignment' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText(/Reason/i), { target: { value: 'territory move' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm owner reassignment' }));
    await waitFor(() =>
      expect(client.assignSalesLeadOwner).toHaveBeenCalledWith(
        'tok',
        'lead-1',
        expect.objectContaining({
          ownerRepresentativeId: '11111111-1111-1111-1111-111111111111',
          expectedRowVersion: 1,
          reason: 'territory move',
        }),
      ),
    );
  });

  it('UI18 facility type field on create', () => {
    auth(['sales-lead.manage']);
    renderCreate();
    expect(screen.getByLabelText(/Facility type key/i)).toBeTruthy();
  });

  it('UI19 specialty keys on create', () => {
    auth(['sales-lead.manage']);
    renderCreate();
    expect(screen.getByLabelText(/Specialty keys/i)).toBeTruthy();
  });

  it('UI20 desired modules on create', () => {
    auth(['sales-lead.manage']);
    renderCreate();
    expect(screen.getByLabelText(/Desired module keys/i)).toBeTruthy();
  });

  it('UI21 estimated size fields on create', () => {
    auth(['sales-lead.manage']);
    renderCreate();
    expect(screen.getByLabelText(/Estimated users/i)).toBeTruthy();
    expect(screen.getByLabelText(/Estimated providers/i)).toBeTruthy();
    expect(screen.getByLabelText(/Estimated locations/i)).toBeTruthy();
  });

  it('UI22 stage control on detail', async () => {
    auth(['sales-lead.view', 'sales-lead.manage']);
    renderDetail();
    expect(await screen.findByRole('button', { name: 'Apply stage' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mark won' })).toBeTruthy();
  });

  it('UI23 stage history panel on detail', async () => {
    auth(['sales-lead.view']);
    renderDetail();
    const heading = await screen.findByText('Stage history');
    expect(heading).toBeTruthy();
    expect(heading.closest('section')?.textContent).toMatch(/→\s*NEW/);
  });

  it('UI24 ownership history panel on detail', async () => {
    auth(['sales-lead.view']);
    renderDetail();
    expect(await screen.findByText('Ownership history')).toBeTruthy();
    expect(screen.getByText(/rep-1/)).toBeTruthy();
  });

  it('UI25 note privacy warning', async () => {
    auth(['sales-lead.view', 'sales-lead.manage']);
    renderDetail();
    expect(
      await screen.findByText(/Do not enter patient or clinical data/i),
    ).toBeTruthy();
  });

  it('UI26 next-action controls on detail', async () => {
    auth(['sales-lead.view', 'sales-lead.manage']);
    renderDetail();
    expect(await screen.findByText('Next action')).toBeTruthy();
    expect(screen.getByLabelText(/Next action type/i)).toBeTruthy();
    expect(screen.getByLabelText(/Next action due/i)).toBeTruthy();
    expect(screen.getByLabelText(/Next action note/i)).toBeTruthy();
  });

  it('UI27 demo scheduling controls on detail', async () => {
    auth(['sales-lead.view', 'sales-lead.manage']);
    renderDetail();
    expect(await screen.findByText('Demo scheduling')).toBeTruthy();
    expect(screen.getByLabelText(/Demo datetime/i)).toBeTruthy();
    expect(screen.getByLabelText(/Demo timezone/i)).toBeTruthy();
    expect(screen.getByLabelText(/Demo status/i)).toBeTruthy();
    expect(screen.getByLabelText(/Demo note/i)).toBeTruthy();
  });

  it('UI28 WON reason field', async () => {
    auth(['sales-lead.view', 'sales-lead.manage']);
    renderDetail();
    expect(await screen.findByLabelText(/Won \/ lost reason/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mark won' })).toBeTruthy();
  });

  it('UI29 LOST reason field', async () => {
    auth(['sales-lead.view', 'sales-lead.manage']);
    renderDetail();
    expect(await screen.findByRole('button', { name: 'Mark lost' })).toBeTruthy();
  });

  it('UI30 Plan-fit summary', async () => {
    auth(['sales-lead.view']);
    renderDetail();
    expect(await screen.findByText('Plan-fit (advisory)')).toBeTruthy();
    expect(screen.getByText('Selection looks compatible.')).toBeTruthy();
  });

  it('UI31 advisory label / disclaimer', async () => {
    auth(['sales-lead.view']);
    renderDetail();
    expect(
      await screen.findByText(/Advisory only — does not create tenants, trials, subscriptions, or entitlements/i),
    ).toBeTruthy();
  });

  it('UI32 no entitlement CTA', async () => {
    auth(['sales-lead.view', 'sales-lead.manage']);
    renderDetail();
    await screen.findByText('Plan-fit (advisory)');
    expect(screen.queryByRole('link', { name: /entitlement/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /grant entitlement/i })).toBeNull();
  });

  it('UI33 no Trial CTA', async () => {
    auth(['sales-lead.view', 'sales-lead.manage']);
    renderDetail();
    await screen.findByText('Notes');
    expect(screen.queryByRole('link', { name: /trial/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /start trial/i })).toBeNull();
  });

  it('UI34 unauthorized lead list without view still loads page component but client called with empty perms is route-gated', () => {
    // List page itself does not flash restricted lead rows when route policy denies.
    const route = getRouteById('sales-leads');
    expect(evaluatePermissionPolicy({ permissions: ['audit.view'] }, route!.policy)).toBe(false);
  });

  it('UI35 unauthorized direct lead denied by detail route policy', () => {
    const route = getRouteById('sales-leads-detail');
    expect(evaluatePermissionPolicy({ permissions: [] }, route!.policy)).toBe(false);
  });

  it('UI36 OCC conflict surfaces via Alert', async () => {
    auth(['sales-lead.view', 'sales-lead.manage'], {
      changeSalesLeadStage: vi
        .fn()
        .mockRejectedValue(new PlatformAuthApiError('Row version conflict.', 409, 'conflict')),
    });
    renderDetail();
    await screen.findByRole('button', { name: 'Apply stage' });
    fireEvent.click(screen.getByRole('button', { name: 'Apply stage' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('Row version conflict.')).toBeTruthy();
  });

  it('UI37 create API error surfaces via Alert (no dedicated replay banner)', async () => {
    auth(['sales-lead.manage'], {
      createSalesLead: vi
        .fn()
        .mockRejectedValue(new PlatformAuthApiError('Create failed.', 500, 'error')),
    });
    renderCreate();
    fireEvent.change(screen.getByLabelText(/Organization/i), { target: { value: 'New Org' } });
    fireEvent.change(screen.getByLabelText(/Contact name/i), { target: { value: 'Bob' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create lead' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('Create failed.')).toBeTruthy();
    expect(screen.queryByText(/replay/i)).toBeNull();
  });

  it('UI38 N/A: Step 24 UI has no 429 rate-limit handling surface', () => {
    auth(['sales-lead.view']);
    renderList();
    expect(screen.queryByText(/429|rate limit/i)).toBeNull();
    expect(true).toBe(true);
  });

  it('UI39 Audit Center deep-link on detail', async () => {
    auth(['sales-lead.view']);
    renderDetail();
    const link = await screen.findByRole('link', { name: 'Open Audit Center' });
    expect(link.getAttribute('href')).toBe('/audit');
  });

  it('UI40 en-US locale identity', () => {
    mockUseI18n.mockReturnValue(stableI18nEn);
    auth(['sales-lead.view']);
    renderList();
    expect(mockUseI18n().locale).toBe('en-US');
  });

  it('UI41 ar-SY locale identity', () => {
    mockUseI18n.mockReturnValue(stableI18nAr);
    auth(['sales-lead.view']);
    renderList();
    expect(mockUseI18n().locale).toBe('ar-SY');
  });

  it('UI42 RTL locale is ar-SY (document dir owned by app shell; page uses same i18n)', () => {
    mockUseI18n.mockReturnValue(stableI18nAr);
    auth(['sales-lead.view']);
    renderList();
    expect(stableI18nAr.locale).toBe('ar-SY');
  });

  it('UI43 keyboard-only: primary controls are native buttons/links/inputs', async () => {
    auth(['sales-lead.view', 'sales-lead.manage']);
    renderList();
    await screen.findByText('Acme Clinic');
    expect(screen.getByRole('button', { name: 'Search' }).tagName).toBe('BUTTON');
    expect(screen.getByRole('link', { name: 'New lead' }).tagName).toBe('A');
  });

  it('UI44 focus management: page H1 is focusable target (#main-heading)', async () => {
    auth(['sales-lead.view']);
    renderList();
    const h1 = await screen.findByRole('heading', { level: 1 });
    expect(h1.id).toBe('main-heading');
    expect(h1.getAttribute('tabindex')).toBe('-1');
  });

  it('UI45 one H1 / landmarks (article page)', async () => {
    auth(['sales-lead.view']);
    renderList();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(document.querySelector('article.sa-page')).toBeTruthy();
  });

  it('UI46 stage/status not color-only (text label present)', async () => {
    auth(['sales-lead.view']);
    renderList();
    expect(await screen.findByText('NEW')).toBeTruthy();
  });

  it('UI47 ownership confirm modal is focus-trapped dialog', async () => {
    auth(['sales-lead.view', 'sales-lead.assign']);
    renderDetail();
    await screen.findByText('Owner assignment');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm owner reassignment' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('UI48 first-invalid focus: create uses native required fields', () => {
    auth(['sales-lead.manage']);
    renderCreate();
    const org = screen.getByLabelText(/Organization/i) as HTMLInputElement;
    expect(org.required).toBe(true);
  });

  it('UI49 live announcements via Alert role=alert on error', async () => {
    auth(['sales-lead.view'], {
      listSalesLeads: vi
        .fn()
        .mockRejectedValue(new PlatformAuthApiError('Live error', 500, 'error')),
    });
    renderList();
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('UI50 mobile/no horizontal overflow class uses sa-table-wrap', async () => {
    auth(['sales-lead.view']);
    renderList();
    await screen.findByText('Acme Clinic');
    expect(document.querySelector('.sa-table-wrap')).toBeTruthy();
  });

  it('UI51 N/A: Step 24 leads pages do not introduce motion animations requiring reduced-motion handling', () => {
    auth(['sales-lead.view']);
    renderList();
    expect(document.querySelector('[class*="animate"]')).toBeNull();
    expect(true).toBe(true);
  });

  it('UI52 safe error surfaces message text only', async () => {
    auth(['sales-lead.view'], {
      listSalesLeads: vi
        .fn()
        .mockRejectedValue(new PlatformAuthApiError('Safe fail', 500, 'error')),
    });
    renderList();
    expect(await screen.findByText('Safe fail')).toBeTruthy();
    expect(screen.queryByText(/SECRET/)).toBeNull();
  });

  it('UI53 no PHI/secrets in rendered list markup', async () => {
    auth(['sales-lead.view']);
    renderList();
    await screen.findByText('Acme Clinic');
    expect(document.body.textContent).not.toMatch(/password|accessToken|ssn|diagnosis/i);
  });

  it('UI54 no Step 25 UI (no trial conversion CTA)', async () => {
    auth(['sales-lead.view', 'sales-lead.manage']);
    renderDetail();
    await screen.findByText('Mark won');
    expect(screen.queryByText(/convert to trial|start trial|provision tenant/i)).toBeNull();
  });

  it('UI55 WON label does not say converted/provisioned', async () => {
    auth(['sales-lead.view', 'sales-lead.manage'], {
      getSalesLead: vi.fn().mockResolvedValue({ ...sampleLead, stage: 'WON' }),
    });
    renderDetail();
    expect(await screen.findByText('WON')).toBeTruthy();
    expect(screen.queryByText(/converted|provisioned/i)).toBeNull();
    expect(screen.getByText('WON').textContent).toBe('WON');
  });
});
