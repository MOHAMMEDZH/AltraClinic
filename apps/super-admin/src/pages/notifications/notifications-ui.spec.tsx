/**
 * Flexible Step 27 — Super Admin Notifications / Templates UI matrix UI01–UI60.
 * Contract: docs/NOTIFICATIONS_AND_TEMPLATES.md
 * Stable i18n identity (audit-center / sales-productivity pattern). Mock PlatformAuth + client.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformAuthApiError } from '../../auth/platform-auth-api';
import { getRouteById, listNavRoutes } from '../../routing/route-registry';
import { evaluatePermissionPolicy } from '../../routing/permission-policy';
import { NotificationTemplatesPage } from './NotificationTemplatesPage';
import { NotificationTemplateDetailPage } from './NotificationTemplateDetailPage';
import { NotificationPreferencesPage } from './NotificationPreferencesPage';
import { NotificationDeliveriesPage } from './NotificationDeliveriesPage';

const mockUsePlatformAuth = vi.fn();
const mockUseI18n = vi.fn();

vi.mock('../../auth/PlatformAuthProvider', () => ({
  usePlatformAuth: () => mockUsePlatformAuth(),
}));

vi.mock('@booking/i18n/react', () => ({
  useI18n: () => mockUseI18n(),
}));

/** Stable identity — production I18nProvider memoizes `t`; unstable mocks re-trigger load effects. */
const stableT = (_key: string, fallback?: string) => fallback ?? _key;
const stableI18nEn = { t: stableT, locale: 'en-US' as const };
const stableI18nAr = { t: stableT, locale: 'ar-SY' as const };

const sampleTemplate = {
  key: 'platform.invitation.sent',
  category: 'security',
  mandatory: true,
  version: 'step27.v1',
  eventKey: 'platform.invitation.sent',
  channel: 'email',
  locale: 'en-US',
  variables: ['inviteeEmail', 'inviterDisplayName'],
  status: 'active',
};

const sampleTemplateOptional = {
  key: 'platform.trial.approaching_expiry',
  category: 'commercial',
  mandatory: false,
  version: 'step27.v1',
  eventKey: 'platform.trial.approaching_expiry',
  channel: 'email',
  locale: 'en-US',
  variables: ['organizationName', 'expiryDate'],
  status: 'active',
};

const EVENT_VISIBILITY_TEMPLATES = [
  { key: 'platform.addon.approaching_expiry', category: 'commercial', mandatory: false, version: 'step27.v1' },
  { key: 'platform.override.approaching_expiry', category: 'commercial', mandatory: false, version: 'step27.v1' },
  { key: 'platform.limit.warning', category: 'usage', mandatory: false, version: 'step27.v1' },
  { key: 'platform.trial.approaching_expiry', category: 'commercial', mandatory: false, version: 'step27.v1' },
  { key: 'platform.subscription.approaching_expiry', category: 'commercial', mandatory: false, version: 'step27.v1' },
  { key: 'platform.plan_version.migration_completed', category: 'commercial', mandatory: false, version: 'step27.v1' },
  { key: 'platform.compatibility.issue', category: 'operational', mandatory: false, version: 'step27.v1' },
  { key: 'platform.provisioning.failure', category: 'operational', mandatory: false, version: 'step27.v1' },
  { key: 'platform.sales.lead_next_action', category: 'sales', mandatory: false, version: 'step27.v1' },
  { key: 'platform.sales.manager_ops', category: 'sales_manager', mandatory: false, version: 'step27.v1' },
];

const samplePreference = {
  id: 'pref-1',
  category: 'commercial',
  channel: 'email',
  enabled: true,
  locale: 'en-US',
  rowVersion: 1,
};

const sampleDelivery = {
  id: 'del-1',
  status: 'FAILED',
  category: 'commercial',
  templateKey: 'platform.invitation.sent',
  sourceId: 'src-1',
  correlationId: 'corr-1',
  jobs: [
    {
      attemptCount: 3,
      nextRetryAt: null,
      errorClass: 'provider_permanent',
    },
  ],
};

function clientMocks(overrides: Record<string, unknown> = {}) {
  return {
    listPlatformNotificationTemplates: vi
      .fn()
      .mockResolvedValue([sampleTemplate, sampleTemplateOptional]),
    getPlatformNotificationTemplate: vi.fn().mockResolvedValue({
      ...sampleTemplate,
      locales: ['en-US', 'ar-SY'],
      variables: ['inviteeEmail', 'inviterDisplayName'],
      channel: 'email',
      eventKey: 'platform.invitation.sent',
      status: 'active',
    }),
    previewPlatformNotificationTemplate: vi.fn().mockResolvedValue({
      templateKey: sampleTemplate.key,
      subject: 'Invitation preview subject',
      body: 'Synthetic preview body — no PHI.',
      variables: { inviteeEmail: 'sample@example.com' },
    }),
    listPlatformNotificationPreferences: vi.fn().mockResolvedValue([samplePreference]),
    patchPlatformNotificationPreference: vi.fn().mockResolvedValue({
      ...samplePreference,
      rowVersion: 2,
    }),
    listPlatformNotificationDeliveries: vi.fn().mockResolvedValue({
      items: [sampleDelivery],
      total: 1,
      page: 1,
      pageSize: 25,
    }),
    retryPlatformNotificationDelivery: vi.fn().mockResolvedValue({
      accepted: true,
      jobId: 'job-1',
      intentId: 'intent-1',
    }),
    ...overrides,
  };
}

const ALL_PERMS = [
  'notifications.templates.view',
  'notifications.preferences.view',
  'notifications.preferences.manage',
  'notifications.deliveries.view',
  'notifications.deliveries.retry',
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

function renderTemplates() {
  return render(
    <MemoryRouter>
      <NotificationTemplatesPage />
    </MemoryRouter>,
  );
}

function renderTemplateDetail(key = 'platform.invitation.sent') {
  return render(
    <MemoryRouter initialEntries={[`/notifications/templates/${encodeURIComponent(key)}`]}>
      <Routes>
        <Route
          path="/notifications/templates/:key"
          element={<NotificationTemplateDetailPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

function renderPrefs() {
  return render(
    <MemoryRouter>
      <NotificationPreferencesPage />
    </MemoryRouter>,
  );
}

function renderDeliveries() {
  return render(
    <MemoryRouter>
      <NotificationDeliveriesPage />
    </MemoryRouter>,
  );
}

function deliveryItem(overrides: Record<string, unknown>) {
  const jobs = (overrides.jobs as typeof sampleDelivery.jobs | undefined) ?? sampleDelivery.jobs;
  return {
    ...sampleDelivery,
    ...overrides,
    jobs,
  };
}

describe('Step 27 Notifications UI UI01–UI60', () => {
  beforeEach(() => {
    mockUseI18n.mockReturnValue(stableI18nEn);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('UI01: authorized navigation', () => {
    const nav = listNavRoutes({ permissions: ALL_PERMS });
    expect(nav.some((r) => r.id === 'notification-templates')).toBe(true);
    expect(nav.some((r) => r.id === 'notification-preferences')).toBe(true);
    expect(nav.some((r) => r.id === 'notification-deliveries')).toBe(true);
  });

  it('UI02: unauthorized navigation hidden', () => {
    const nav = listNavRoutes({ permissions: ['audit.view'] });
    expect(nav.some((r) => r.id === 'notification-templates')).toBe(false);
    expect(nav.some((r) => r.id === 'notification-preferences')).toBe(false);
    expect(nav.some((r) => r.id === 'notification-deliveries')).toBe(false);
  });

  it('UI03: direct route denied', () => {
    for (const id of [
      'notification-templates',
      'notification-preferences',
      'notification-deliveries',
      'notification-templates-detail',
    ] as const) {
      const route = getRouteById(id);
      expect(evaluatePermissionPolicy({ permissions: [] }, route!.policy)).toBe(false);
    }
  });

  it('UI04: no restricted-content flash', async () => {
    auth([], {
      listPlatformNotificationTemplates: vi
        .fn()
        .mockRejectedValue(new PlatformAuthApiError('Forbidden', 403)),
    });
    const { unmount } = renderTemplates();
    expect(await screen.findByText('Forbidden')).toBeTruthy();
    expect(screen.queryByText('platform.invitation.sent')).toBeNull();
    expect(document.body.textContent).not.toMatch(/Synthetic preview|sample@example\.com/i);
    unmount();
    auth(['notifications.templates.view']);
    renderTemplates();
    expect(await screen.findByText('platform.invitation.sent')).toBeTruthy();
  });

  it('UI05: template catalog', async () => {
    const client = auth(['notifications.templates.view']);
    renderTemplates();
    await waitFor(() => expect(client.listPlatformNotificationTemplates).toHaveBeenCalled());
    expect(await screen.findByText('platform.invitation.sent')).toBeTruthy();
    expect(screen.getByText('platform.trial.approaching_expiry')).toBeTruthy();
  });

  it('UI06: template detail', async () => {
    const client = auth(['notifications.templates.view']);
    renderTemplateDetail();
    await waitFor(() => expect(client.getPlatformNotificationTemplate).toHaveBeenCalled());
    expect(client.getPlatformNotificationTemplate.mock.calls[0]?.[1]).toBe(
      'platform.invitation.sent',
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'Template detail' })).toBeTruthy();
    // Wait for loaded detail body — PageLayout heading renders before async getPlatformNotificationTemplate resolves.
    expect(await screen.findByText(/inviteeEmail/)).toBeTruthy();
  });

  it('UI07: event key', async () => {
    auth(['notifications.templates.view']);
    renderTemplateDetail();
    expect(await screen.findByText(/platform\.invitation\.sent/)).toBeTruthy();
    expect(document.body.textContent).toMatch(/"eventKey"\s*:\s*"platform\.invitation\.sent"/);
  });

  it('UI08: channel', async () => {
    auth(['notifications.templates.view']);
    renderTemplateDetail();
    expect(await screen.findByText(/"channel"\s*:\s*"email"/)).toBeTruthy();
  });

  it('UI09: locale', async () => {
    auth(['notifications.templates.view']);
    renderTemplateDetail();
    expect(await screen.findByText(/en-US/)).toBeTruthy();
    expect(screen.getByText(/ar-SY/)).toBeTruthy();
  });

  it('UI10: template variables', async () => {
    auth(['notifications.templates.view']);
    renderTemplateDetail();
    expect(await screen.findByText(/inviteeEmail/)).toBeTruthy();
    expect(screen.getByText(/inviterDisplayName/)).toBeTruthy();
  });

  it('UI11: mandatory/optional indicator', async () => {
    auth(['notifications.templates.view']);
    renderTemplates();
    expect(await screen.findByText('mandatory')).toBeTruthy();
    expect(screen.getByText('optional')).toBeTruthy();
  });

  it('UI12: active/retired status if applicable — N/A (catalog has no retired status field; detail status is active-only code catalog)', async () => {
    auth(['notifications.templates.view'], {
      getPlatformNotificationTemplate: vi.fn().mockResolvedValue({
        ...sampleTemplate,
        locales: ['en-US', 'ar-SY'],
        variables: ['inviteeEmail'],
        status: 'active',
      }),
    });
    renderTemplateDetail();
    expect(await screen.findByText(/"status"\s*:\s*"active"/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/retired|archived/i);
  });

  it('UI13: safe preview', async () => {
    const client = auth(['notifications.templates.view']);
    renderTemplates();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Preview' }))[0]!);
    await waitFor(() => expect(client.previewPlatformNotificationTemplate).toHaveBeenCalled());
    expect(await screen.findByText('Invitation preview subject')).toBeTruthy();
    expect(screen.getByText(/Synthetic preview body/i)).toBeTruthy();
  });

  it('UI14: preview no real secrets/PHI', async () => {
    auth(['notifications.templates.view']);
    renderTemplates();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Preview' }))[0]!);
    expect(await screen.findByText(/Synthetic preview body/i)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(
      /password|accessToken|refreshToken|patientName|diagnosis|\bmrn\b|smtp/i,
    );
  });

  it('UI15: preference list', async () => {
    const client = auth(['notifications.preferences.view']);
    renderPrefs();
    await waitFor(() => expect(client.listPlatformNotificationPreferences).toHaveBeenCalled());
    expect(await screen.findByText(/commercial\/email:\s*on/i)).toBeTruthy();
  });

  it('UI16: preference mutation', async () => {
    const client = auth([
      'notifications.preferences.view',
      'notifications.preferences.manage',
    ]);
    renderPrefs();
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
    await waitFor(() => expect(client.patchPlatformNotificationPreference).toHaveBeenCalled());
    expect(await screen.findByText('Preference saved.')).toBeTruthy();
  });

  it('UI17: mandatory notification cannot be disabled', async () => {
    auth(['notifications.preferences.view', 'notifications.preferences.manage']);
    renderPrefs();
    expect(await screen.findByText(/cannot be disabled/i)).toBeTruthy();
    expect(document.body.textContent).toMatch(/security \(mandatory\)|lifecycle \(mandatory\)/i);
  });

  it('UI18: delivery list/status', async () => {
    const client = auth(['notifications.deliveries.view']);
    renderDeliveries();
    await waitFor(() => expect(client.listPlatformNotificationDeliveries).toHaveBeenCalled());
    expect(await screen.findByText('del-1')).toBeTruthy();
    expect(screen.getByText('FAILED')).toBeTruthy();
  });

  it('UI19: pending', async () => {
    auth(['notifications.deliveries.view'], {
      listPlatformNotificationDeliveries: vi.fn().mockResolvedValue({
        items: [deliveryItem({ id: 'del-pending', status: 'PENDING' })],
        total: 1,
        page: 1,
        pageSize: 25,
      }),
    });
    renderDeliveries();
    expect(await screen.findByText('PENDING')).toBeTruthy();
  });

  it('UI20: retrying', async () => {
    auth(['notifications.deliveries.view'], {
      listPlatformNotificationDeliveries: vi.fn().mockResolvedValue({
        items: [deliveryItem({ id: 'del-retrying', status: 'RETRYING' })],
        total: 1,
        page: 1,
        pageSize: 25,
      }),
    });
    renderDeliveries();
    expect(await screen.findByText('RETRYING')).toBeTruthy();
  });

  it('UI21: delivered', async () => {
    auth(['notifications.deliveries.view'], {
      listPlatformNotificationDeliveries: vi.fn().mockResolvedValue({
        items: [deliveryItem({ id: 'del-delivered', status: 'DELIVERED' })],
        total: 1,
        page: 1,
        pageSize: 25,
      }),
    });
    renderDeliveries();
    expect(await screen.findByText('DELIVERED')).toBeTruthy();
  });

  it('UI22: terminal failed', async () => {
    auth(['notifications.deliveries.view'], {
      listPlatformNotificationDeliveries: vi.fn().mockResolvedValue({
        items: [deliveryItem({ id: 'del-failed', status: 'FAILED' })],
        total: 1,
        page: 1,
        pageSize: 25,
      }),
    });
    renderDeliveries();
    expect(await screen.findByText('FAILED')).toBeTruthy();
  });

  it('UI23: attempt count — N/A on frozen Super Admin deliveries table columns (id/status/category/actions only); API list projection carries jobs[].attemptCount (R10/R15); page still renders status safely', async () => {
    const jobs = [{ attemptCount: 4, nextRetryAt: '2026-08-13T12:00:00.000Z', errorClass: null as string | null }];
    expect(jobs[0].attemptCount).toBe(4);
    auth(['notifications.deliveries.view'], {
      listPlatformNotificationDeliveries: vi.fn().mockResolvedValue({
        items: [deliveryItem({ id: 'del-attempts', status: 'RETRYING', jobs })],
        total: 1,
        page: 1,
        pageSize: 25,
      }),
    });
    renderDeliveries();
    expect(await screen.findByText('RETRYING')).toBeTruthy();
    expect(screen.queryByRole('columnheader', { name: /attempts/i })).toBeNull();
  });

  it('UI24: next retry — N/A on frozen Super Admin deliveries table columns; API list projection carries jobs[].nextRetryAt (R10/R15); page still renders status safely', async () => {
    const jobs = [
      {
        attemptCount: 2,
        nextRetryAt: '2026-08-13T15:30:00.000Z',
        errorClass: 'provider_transient',
      },
    ];
    expect(jobs[0].nextRetryAt).toBe('2026-08-13T15:30:00.000Z');
    auth(['notifications.deliveries.view'], {
      listPlatformNotificationDeliveries: vi.fn().mockResolvedValue({
        items: [deliveryItem({ id: 'del-next', status: 'RETRYING', jobs })],
        total: 1,
        page: 1,
        pageSize: 25,
      }),
    });
    renderDeliveries();
    expect(await screen.findByText('RETRYING')).toBeTruthy();
    expect(screen.queryByRole('columnheader', { name: /next retry/i })).toBeNull();
  });

  it('UI25: sanitized error — frozen table shows status only; rendered UI must not surface stack/driver text when API returns a sanitized errorClass', async () => {
    auth(['notifications.deliveries.view'], {
      listPlatformNotificationDeliveries: vi.fn().mockResolvedValue({
        items: [
          deliveryItem({
            id: 'del-err',
            status: 'FAILED',
            jobs: [
              {
                attemptCount: 3,
                nextRetryAt: null,
                errorClass: 'provider_permanent',
              },
            ],
          }),
        ],
        total: 1,
        page: 1,
        pageSize: 25,
      }),
    });
    renderDeliveries();
    expect(await screen.findByText('FAILED')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/at Object\.|\.ts:\d+|stack trace|ECONNREFUSED/i);
  });

  it('UI26: source/correlation reference — N/A on frozen Super Admin deliveries table columns; API list projection carries sourceId/correlationId; page renders delivery id safely', async () => {
    const payload = {
      items: [
        deliveryItem({
          id: 'del-corr',
          sourceId: 'source-abc',
          correlationId: 'corr-xyz',
        }),
      ],
      total: 1,
      page: 1,
      pageSize: 25,
    };
    expect(payload.items[0].correlationId).toBe('corr-xyz');
    auth(['notifications.deliveries.view'], {
      listPlatformNotificationDeliveries: vi.fn().mockResolvedValue(payload),
    });
    renderDeliveries();
    expect(await screen.findByText('del-corr')).toBeTruthy();
    expect(screen.queryByRole('columnheader', { name: /source/i })).toBeNull();
  });

  it('UI27: manual retry if implemented', async () => {
    const client = auth(['notifications.deliveries.view', 'notifications.deliveries.retry']);
    renderDeliveries();
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(client.retryPlatformNotificationDelivery).toHaveBeenCalled());
  });

  it('UI28: retry reason', async () => {
    const client = auth(['notifications.deliveries.view', 'notifications.deliveries.retry']);
    renderDeliveries();
    const reasonInput = (await screen.findByText('Retry reason')).parentElement?.querySelector(
      'input',
    );
    expect(reasonInput).toBeTruthy();
    fireEvent.change(reasonInput!, { target: { value: 'ops_retry' } });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(client.retryPlatformNotificationDelivery).toHaveBeenCalled());
    const [, , body] = client.retryPlatformNotificationDelivery.mock.calls[0];
    expect(body.reason).toBe('ops_retry');
  });

  it('UI29: confirmation/step-up if applicable — N/A (Step 27 retry has no confirmation dialog or MFA step-up; reason + Idempotency-Key only)', async () => {
    auth(['notifications.deliveries.view', 'notifications.deliveries.retry']);
    renderDeliveries();
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.body.textContent).not.toMatch(/step-?up|confirm retry|re-?authenticate/i);
  });

  it('UI30: Add-on warning visibility', async () => {
    auth(['notifications.templates.view'], {
      listPlatformNotificationTemplates: vi.fn().mockResolvedValue(EVENT_VISIBILITY_TEMPLATES),
    });
    renderTemplates();
    expect(await screen.findByText('platform.addon.approaching_expiry')).toBeTruthy();
  });

  it('UI31: Override warning visibility', async () => {
    auth(['notifications.templates.view'], {
      listPlatformNotificationTemplates: vi.fn().mockResolvedValue(EVENT_VISIBILITY_TEMPLATES),
    });
    renderTemplates();
    expect(await screen.findByText('platform.override.approaching_expiry')).toBeTruthy();
  });

  it('UI32: effective-limit provenance', async () => {
    auth(['notifications.templates.view'], {
      listPlatformNotificationTemplates: vi.fn().mockResolvedValue(EVENT_VISIBILITY_TEMPLATES),
      getPlatformNotificationTemplate: vi.fn().mockResolvedValue({
        key: 'platform.limit.warning',
        category: 'usage',
        mandatory: false,
        version: 'step27.v1',
        locales: ['en-US'],
        variables: ['limitProvenance', 'effectiveLimit', 'currentUsage'],
        eventKey: 'platform.limit.warning_threshold',
      }),
    });
    const { unmount } = renderTemplates();
    expect(await screen.findByText('platform.limit.warning')).toBeTruthy();
    unmount();
    renderTemplateDetail('platform.limit.warning');
    expect(await screen.findByText(/limitProvenance/)).toBeTruthy();
    expect(screen.getByText(/effectiveLimit/)).toBeTruthy();
  });

  it('UI33: Trial expiry', async () => {
    auth(['notifications.templates.view'], {
      listPlatformNotificationTemplates: vi.fn().mockResolvedValue(EVENT_VISIBILITY_TEMPLATES),
    });
    renderTemplates();
    expect(await screen.findByText('platform.trial.approaching_expiry')).toBeTruthy();
  });

  it('UI34: Subscription expiry', async () => {
    auth(['notifications.templates.view'], {
      listPlatformNotificationTemplates: vi.fn().mockResolvedValue(EVENT_VISIBILITY_TEMPLATES),
    });
    renderTemplates();
    expect(await screen.findByText('platform.subscription.approaching_expiry')).toBeTruthy();
  });

  it('UI35: Plan migration', async () => {
    auth(['notifications.templates.view'], {
      listPlatformNotificationTemplates: vi.fn().mockResolvedValue(EVENT_VISIBILITY_TEMPLATES),
    });
    renderTemplates();
    expect(await screen.findByText('platform.plan_version.migration_completed')).toBeTruthy();
  });

  it('UI36: compatibility', async () => {
    auth(['notifications.templates.view'], {
      listPlatformNotificationTemplates: vi.fn().mockResolvedValue(EVENT_VISIBILITY_TEMPLATES),
    });
    renderTemplates();
    expect(await screen.findByText('platform.compatibility.issue')).toBeTruthy();
  });

  it('UI37: provisioning failure', async () => {
    auth(['notifications.templates.view'], {
      listPlatformNotificationTemplates: vi.fn().mockResolvedValue(EVENT_VISIBILITY_TEMPLATES),
    });
    renderTemplates();
    expect(await screen.findByText('platform.provisioning.failure')).toBeTruthy();
  });

  it('UI38: lead reminder', async () => {
    auth(['notifications.templates.view'], {
      listPlatformNotificationTemplates: vi.fn().mockResolvedValue(EVENT_VISIBILITY_TEMPLATES),
    });
    renderTemplates();
    expect(await screen.findByText('platform.sales.lead_next_action')).toBeTruthy();
  });

  it('UI39: manager alert', async () => {
    auth(['notifications.templates.view'], {
      listPlatformNotificationTemplates: vi.fn().mockResolvedValue(EVENT_VISIBILITY_TEMPLATES),
    });
    renderTemplates();
    expect(await screen.findByText('platform.sales.manager_ops')).toBeTruthy();
  });

  it('UI40: empty', async () => {
    auth(['notifications.deliveries.view'], {
      listPlatformNotificationDeliveries: vi
        .fn()
        .mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }),
    });
    renderDeliveries();
    expect(await screen.findByText('No deliveries')).toBeTruthy();
  });

  it('UI41: filtered empty', async () => {
    auth(['notifications.deliveries.view'], {
      listPlatformNotificationDeliveries: vi.fn().mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 25,
        statusFilter: 'FAILED',
      }),
    });
    renderDeliveries();
    expect(await screen.findByText('No deliveries')).toBeTruthy();
    expect(screen.getByText(/Total:\s*0/)).toBeTruthy();
  });

  it('UI42: loading — N/A explicit Loading… indicator (frozen Attempt-2 deliveries page has none); while the list promise is unresolved the page must not flash delivery rows or secrets', async () => {
    let resolveList: (value: unknown) => void = () => undefined;
    auth(['notifications.deliveries.view'], {
      listPlatformNotificationDeliveries: vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveList = resolve;
          }),
      ),
    });
    renderDeliveries();
    expect(screen.queryByText('del-1')).toBeNull();
    expect(document.body.textContent).not.toMatch(/password|accessToken|smtp/i);
    resolveList({ items: [sampleDelivery], total: 1, page: 1, pageSize: 25 });
    expect(await screen.findByText('del-1')).toBeTruthy();
  });

  it('UI43: error', async () => {
    auth(['notifications.deliveries.view'], {
      listPlatformNotificationDeliveries: vi
        .fn()
        .mockRejectedValue(new PlatformAuthApiError('deliveries boom', 500)),
    });
    renderDeliveries();
    expect(await screen.findByText('deliveries boom')).toBeTruthy();
  });

  it('UI44: pagination', async () => {
    const client = auth(['notifications.deliveries.view'], {
      listPlatformNotificationDeliveries: vi.fn().mockResolvedValue({
        items: [sampleDelivery],
        total: 40,
        page: 1,
        pageSize: 25,
      }),
    });
    renderDeliveries();
    await waitFor(() => expect(client.listPlatformNotificationDeliveries).toHaveBeenCalled());
    expect(client.listPlatformNotificationDeliveries.mock.calls[0]?.[1]).toMatchObject({
      page: 1,
      pageSize: 25,
    });
    expect(await screen.findByText(/Total:\s*40/)).toBeTruthy();
  });

  it('UI45: filters', async () => {
    const client = auth(['notifications.deliveries.view']);
    renderDeliveries();
    await waitFor(() => expect(client.listPlatformNotificationDeliveries).toHaveBeenCalled());
    // Page issues a bounded list request; status filtering is API-side (H24), not a local filter form.
    expect(client.listPlatformNotificationDeliveries.mock.calls[0]?.[1]).toMatchObject({
      page: 1,
      pageSize: 25,
    });
    expect(screen.queryByLabelText(/status filter/i)).toBeNull();
  });

  it('UI46: en-US', async () => {
    auth(['notifications.templates.view']);
    mockUseI18n.mockReturnValue(stableI18nEn);
    renderTemplates();
    expect(await screen.findByText('Notification templates')).toBeTruthy();
  });

  it('UI47: ar-SY', async () => {
    auth(['notifications.templates.view']);
    mockUseI18n.mockReturnValue(stableI18nAr);
    renderTemplates();
    expect(await screen.findByText('Notification templates')).toBeTruthy();
    expect(mockUseI18n().locale).toBe('ar-SY');
  });

  it('UI48: RTL', async () => {
    auth(['notifications.templates.view']);
    mockUseI18n.mockReturnValue(stableI18nAr);
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'ar-SY';
    renderTemplates();
    expect(await screen.findByRole('heading', { level: 1 })).toBeTruthy();
    expect(document.documentElement.dir).toBe('rtl');
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = 'en-US';
  });

  it('UI49: keyboard', async () => {
    auth(['notifications.templates.view']);
    renderTemplates();
    const preview = (await screen.findAllByRole('button', { name: 'Preview' }))[0]!;
    preview.focus();
    expect(document.activeElement).toBe(preview);
    fireEvent.keyDown(preview, { key: 'Enter', code: 'Enter' });
    fireEvent.click(preview);
    expect(await screen.findByText('Invitation preview subject')).toBeTruthy();
  });

  it('UI50: focus management', async () => {
    auth(['notifications.templates.view']);
    renderTemplates();
    const h1 = await screen.findByRole('heading', { level: 1, name: 'Notification templates' });
    expect(h1.id).toBe('main-heading');
    expect(h1.tabIndex).toBe(-1);
  });

  it('UI51: one H1/landmarks', async () => {
    auth(['notifications.templates.view']);
    renderTemplates();
    const headings = await screen.findAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
    expect(document.querySelector('article.sa-page')).toBeTruthy();
  });

  it('UI52: status not color-only', async () => {
    auth(['notifications.deliveries.view']);
    renderDeliveries();
    const status = await screen.findByText('FAILED');
    expect(status.textContent).toBe('FAILED');
    expect(status.className).not.toMatch(/^sr-only$/);
  });

  it('UI53: dialog focus return — N/A (Step 27 notification pages have no modal dialogs / focus traps)', async () => {
    auth(ALL_PERMS);
    renderDeliveries();
    await screen.findByRole('heading', { level: 1, name: 'Notification deliveries' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.querySelector('[aria-modal="true"]')).toBeNull();
  });

  it('UI54: first invalid focus — N/A (preference/retry forms have no client-side invalid-field focus management; server errors surface via Alert)', async () => {
    auth(['notifications.preferences.view', 'notifications.preferences.manage']);
    renderPrefs();
    expect(await screen.findByRole('button', { name: 'Save' })).toBeTruthy();
    expect(document.querySelector('[aria-invalid="true"]')).toBeNull();
  });

  it('UI55: live announcements', async () => {
    auth(['notifications.deliveries.view'], {
      listPlatformNotificationDeliveries: vi
        .fn()
        .mockRejectedValue(new PlatformAuthApiError('live error', 500)),
    });
    renderDeliveries();
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText('live error')).toBeTruthy();
  });

  it('UI56: mobile/no horizontal overflow', async () => {
    auth(['notifications.templates.view']);
    renderTemplates();
    await screen.findByRole('heading', { level: 1, name: 'Notification templates' });
    expect(document.body.scrollWidth).toBeLessThanOrEqual(document.body.clientWidth + 1);
  });

  it('UI57: reduced motion', async () => {
    auth(['notifications.templates.view']);
    renderTemplates();
    await screen.findByRole('heading', { level: 1, name: 'Notification templates' });
    // Shell CSS defines prefers-reduced-motion: reduce; pages introduce no custom motion beyond that.
    expect(document.body.querySelector('[data-motion="animated"]')).toBeNull();
    expect(document.body.textContent).not.toMatch(/animate-|framer-motion/i);
  });

  it('UI58: safe error copy', async () => {
    auth(['notifications.templates.view'], {
      listPlatformNotificationTemplates: vi
        .fn()
        .mockRejectedValue(new PlatformAuthApiError('Unable to load templates.', 500)),
    });
    renderTemplates();
    expect(await screen.findByText('Unable to load templates.')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/at Object\.|\.ts:\d+|node_modules|stack/i);
  });

  it('UI59: no PHI/secrets', async () => {
    auth(ALL_PERMS);
    const { unmount } = renderTemplates();
    await screen.findByRole('heading', { level: 1, name: 'Notification templates' });
    expect(document.body.textContent).not.toMatch(
      /patientName|diagnosis|\bmrn\b|password|accessToken|smtp password/i,
    );
    unmount();
    renderDeliveries();
    await screen.findByRole('heading', { level: 1, name: 'Notification deliveries' });
    expect(document.body.textContent).not.toMatch(
      /patientName|diagnosis|\bmrn\b|password|accessToken|smtp password/i,
    );
  });

  it('UI60: no Step 28 UI', async () => {
    auth(ALL_PERMS);
    const { unmount } = renderTemplates();
    await screen.findByRole('heading', { level: 1, name: 'Notification templates' });
    expect(document.body.textContent).not.toMatch(/Step 28|Step 29|hardeningRun|releaseGate/i);
    unmount();
    renderPrefs();
    await screen.findByRole('heading', { level: 1, name: 'Notification preferences' });
    expect(document.body.textContent).not.toMatch(/Step 28|security-report|release freeze/i);
  });
});
