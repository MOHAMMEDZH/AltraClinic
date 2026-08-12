/**
 * Flexible Step 27 — Super Admin Notifications / Templates UI matrix UI01–UI60.
 * Contract: docs/NOTIFICATIONS_AND_TEMPLATES.md
 * Stable i18n identity (audit-center / sales-productivity pattern). Mock PlatformAuth + client.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
};

const sampleTemplateOptional = {
  key: 'platform.trial.approaching_expiry',
  category: 'commercial',
  mandatory: false,
  version: 'step27.v1',
};

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
  channel: 'email',
};

function clientMocks(overrides: Record<string, unknown> = {}) {
  return {
    listPlatformNotificationTemplates: vi
      .fn()
      .mockResolvedValue([sampleTemplate, sampleTemplateOptional]),
    getPlatformNotificationTemplate: vi.fn().mockResolvedValue({
      ...sampleTemplate,
      locales: ['en-US', 'ar-SY'],
      variables: ['inviteeEmail'],
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

describe('Step 27 Notifications UI UI01–UI60', () => {
  beforeEach(() => {
    mockUseI18n.mockReturnValue(stableI18nEn);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // ─── navigation and route policy ──────────────────────────────────────────

  it('UI01 authorized templates nav visible for notifications.templates.view', () => {
    const route = getRouteById('notification-templates');
    expect(route?.status).toBe('available');
    expect(route?.step).toBe(27);
    expect(route?.navGroup).toBe('operations');
    const nav = listNavRoutes({ permissions: ['notifications.templates.view'] });
    expect(nav.some((r) => r.id === 'notification-templates')).toBe(true);
  });

  it('UI02 unauthorized templates nav hidden', () => {
    const nav = listNavRoutes({ permissions: ['audit.view'] });
    expect(nav.some((r) => r.id === 'notification-templates')).toBe(false);
  });

  it('UI03 authorized preferences nav for notifications.preferences.view', () => {
    const route = getRouteById('notification-preferences');
    expect(route?.status).toBe('available');
    expect(route?.step).toBe(27);
    const nav = listNavRoutes({ permissions: ['notifications.preferences.view'] });
    expect(nav.some((r) => r.id === 'notification-preferences')).toBe(true);
  });

  it('UI04 unauthorized preferences nav hidden', () => {
    const nav = listNavRoutes({ permissions: ['notifications.templates.view'] });
    expect(nav.some((r) => r.id === 'notification-preferences')).toBe(false);
  });

  it('UI05 authorized deliveries nav for notifications.deliveries.view', () => {
    const route = getRouteById('notification-deliveries');
    expect(route?.status).toBe('available');
    expect(route?.step).toBe(27);
    const nav = listNavRoutes({ permissions: ['notifications.deliveries.view'] });
    expect(nav.some((r) => r.id === 'notification-deliveries')).toBe(true);
  });

  it('UI06 unauthorized deliveries nav hidden', () => {
    const nav = listNavRoutes({ permissions: ['notifications.preferences.view'] });
    expect(nav.some((r) => r.id === 'notification-deliveries')).toBe(false);
  });

  it('UI07 template detail is not shown in nav', () => {
    const route = getRouteById('notification-templates-detail');
    expect(route?.showInNav).toBe(false);
    expect(route?.path).toBe('/notifications/templates/:key');
    const nav = listNavRoutes({ permissions: ALL_PERMS });
    expect(nav.some((r) => r.id === 'notification-templates-detail')).toBe(false);
  });

  it('UI08 templates route policy requires notifications.templates.view', () => {
    const route = getRouteById('notification-templates');
    expect(
      evaluatePermissionPolicy({ permissions: ['notifications.templates.view'] }, route!.policy),
    ).toBe(true);
    expect(evaluatePermissionPolicy({ permissions: [] }, route!.policy)).toBe(false);
  });

  it('UI09 preferences route policy requires notifications.preferences.view', () => {
    const route = getRouteById('notification-preferences');
    expect(
      evaluatePermissionPolicy(
        { permissions: ['notifications.preferences.view'] },
        route!.policy,
      ),
    ).toBe(true);
    expect(
      evaluatePermissionPolicy({ permissions: ['notifications.templates.view'] }, route!.policy),
    ).toBe(false);
  });

  it('UI10 deliveries route policy requires notifications.deliveries.view', () => {
    const route = getRouteById('notification-deliveries');
    expect(
      evaluatePermissionPolicy({ permissions: ['notifications.deliveries.view'] }, route!.policy),
    ).toBe(true);
  });

  it('UI11 template detail route policy requires notifications.templates.view', () => {
    const route = getRouteById('notification-templates-detail');
    expect(
      evaluatePermissionPolicy({ permissions: ['notifications.templates.view'] }, route!.policy),
    ).toBe(true);
  });

  it('UI12 sales permissions alone never unlock notification surfaces', () => {
    const nav = listNavRoutes({
      permissions: ['sales-report.view', 'commission-snapshot.view', 'trial.view'],
    });
    expect(nav.some((r) => r.id === 'notification-templates')).toBe(false);
    expect(nav.some((r) => r.id === 'notification-preferences')).toBe(false);
    expect(nav.some((r) => r.id === 'notification-deliveries')).toBe(false);
  });

  // ─── templates list ───────────────────────────────────────────────────────

  it('UI13 templates page renders H1 title', async () => {
    auth(['notifications.templates.view']);
    renderTemplates();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Notification templates' }),
    ).toBeTruthy();
  });

  it('UI14 templates page loads catalog via API', async () => {
    const client = auth(['notifications.templates.view']);
    renderTemplates();
    await waitFor(() => expect(client.listPlatformNotificationTemplates).toHaveBeenCalled());
    expect(await screen.findByText('platform.invitation.sent')).toBeTruthy();
    expect(screen.getByText('platform.trial.approaching_expiry')).toBeTruthy();
  });

  it('UI15 templates page shows mandatory StatusBadge text (not color-only)', async () => {
    auth(['notifications.templates.view']);
    renderTemplates();
    expect(await screen.findByText('mandatory')).toBeTruthy();
    expect(screen.getByText('optional')).toBeTruthy();
  });

  it('UI16 templates page links to detail, preferences, and deliveries', async () => {
    auth(['notifications.templates.view']);
    renderTemplates();
    const detail = await screen.findByRole('link', { name: 'platform.invitation.sent' });
    expect(detail.getAttribute('href')).toBe(
      '/notifications/templates/platform.invitation.sent',
    );
    expect(screen.getByRole('link', { name: 'Preferences' }).getAttribute('href')).toBe(
      '/notifications/preferences',
    );
    expect(screen.getByRole('link', { name: 'Deliveries' }).getAttribute('href')).toBe(
      '/notifications/deliveries',
    );
  });

  it('UI17 preview calls preview API with locale', async () => {
    const client = auth(['notifications.templates.view']);
    renderTemplates();
    const buttons = await screen.findAllByRole('button', { name: 'Preview' });
    fireEvent.click(buttons[0]!);
    await waitFor(() => expect(client.previewPlatformNotificationTemplate).toHaveBeenCalled());
    const [, key, body] = client.previewPlatformNotificationTemplate.mock.calls[0];
    expect(key).toBe('platform.invitation.sent');
    expect(body).toEqual({ locale: 'en-US' });
  });

  it('UI18 preview surfaces synthetic subject/body via Alert', async () => {
    auth(['notifications.templates.view']);
    renderTemplates();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Preview' }))[0]!);
    expect(await screen.findByText('Invitation preview subject')).toBeTruthy();
    expect(screen.getByText(/Synthetic preview body/i)).toBeTruthy();
  });

  it('UI19 templates empty state when catalog empty', async () => {
    auth(['notifications.templates.view'], {
      listPlatformNotificationTemplates: vi.fn().mockResolvedValue([]),
    });
    renderTemplates();
    expect(await screen.findByText('No templates')).toBeTruthy();
  });

  it('UI20 templates load error surfaces via Alert', async () => {
    auth(['notifications.templates.view'], {
      listPlatformNotificationTemplates: vi
        .fn()
        .mockRejectedValue(new PlatformAuthApiError('templates boom', 500)),
    });
    renderTemplates();
    expect(await screen.findByText('templates boom')).toBeTruthy();
  });

  it('UI21 preview error surfaces via Alert', async () => {
    auth(['notifications.templates.view'], {
      previewPlatformNotificationTemplate: vi
        .fn()
        .mockRejectedValue(new PlatformAuthApiError('preview failed', 400)),
    });
    renderTemplates();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Preview' }))[0]!);
    expect(await screen.findByText('preview failed')).toBeTruthy();
  });

  it('UI22 templates page has no CMS editor / create-template surface', async () => {
    auth(['notifications.templates.view']);
    renderTemplates();
    await screen.findByRole('heading', { level: 1, name: 'Notification templates' });
    expect(screen.queryByRole('button', { name: /create template/i })).toBeNull();
    expect(document.body.textContent).not.toMatch(/WYSIWYG|drag.?and.?drop editor/i);
  });

  // ─── template detail ──────────────────────────────────────────────────────

  it('UI23 template detail loads by key', async () => {
    const client = auth(['notifications.templates.view']);
    renderTemplateDetail();
    await waitFor(() => expect(client.getPlatformNotificationTemplate).toHaveBeenCalled());
    expect(client.getPlatformNotificationTemplate.mock.calls[0]?.[1]).toBe(
      'platform.invitation.sent',
    );
    expect(await screen.findByText(/inviteeEmail/)).toBeTruthy();
  });

  it('UI24 template detail error surfaces via Alert', async () => {
    auth(['notifications.templates.view'], {
      getPlatformNotificationTemplate: vi
        .fn()
        .mockRejectedValue(new PlatformAuthApiError('missing template', 404)),
    });
    renderTemplateDetail('missing.key');
    expect(await screen.findByText('missing template')).toBeTruthy();
  });

  it('UI25 template detail has no mutable CMS save surface', async () => {
    auth(['notifications.templates.view']);
    renderTemplateDetail();
    await screen.findByRole('heading', { level: 1, name: 'Template detail' });
    expect(screen.queryByRole('button', { name: /save/i })).toBeNull();
  });

  // ─── preferences ──────────────────────────────────────────────────────────

  it('UI26 preferences page renders H1 title', async () => {
    auth(['notifications.preferences.view']);
    renderPrefs();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Notification preferences' }),
    ).toBeTruthy();
  });

  it('UI27 preferences page loads list via API', async () => {
    const client = auth(['notifications.preferences.view']);
    renderPrefs();
    await waitFor(() => expect(client.listPlatformNotificationPreferences).toHaveBeenCalled());
    expect(await screen.findByText(/commercial\/email:\s*on/i)).toBeTruthy();
  });

  it('UI28 preference save form hidden without notifications.preferences.manage', async () => {
    auth(['notifications.preferences.view']);
    renderPrefs();
    await screen.findByRole('heading', { level: 1, name: 'Notification preferences' });
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  });

  it('UI29 preference save form visible with notifications.preferences.manage', async () => {
    auth(['notifications.preferences.view', 'notifications.preferences.manage']);
    renderPrefs();
    expect(await screen.findByRole('button', { name: 'Save' })).toBeTruthy();
  });

  it('UI30 preference save posts with idempotency key', async () => {
    const client = auth([
      'notifications.preferences.view',
      'notifications.preferences.manage',
    ]);
    renderPrefs();
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
    await waitFor(() => expect(client.patchPlatformNotificationPreference).toHaveBeenCalled());
    const [, body, key] = client.patchPlatformNotificationPreference.mock.calls[0];
    expect(body.category).toBe('commercial');
    expect(body.channel).toBe('email');
    expect(typeof key).toBe('string');
    expect((key as string).length).toBeGreaterThan(10);
  });

  it('UI31 preference save success notice', async () => {
    auth(['notifications.preferences.view', 'notifications.preferences.manage']);
    renderPrefs();
    fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Preference saved.')).toBeTruthy();
  });

  it('UI32 preferences empty state', async () => {
    auth(['notifications.preferences.view'], {
      listPlatformNotificationPreferences: vi.fn().mockResolvedValue([]),
    });
    renderPrefs();
    expect(await screen.findByText('No saved preferences')).toBeTruthy();
  });

  it('UI33 preferences load error surfaces via Alert', async () => {
    auth(['notifications.preferences.view'], {
      listPlatformNotificationPreferences: vi
        .fn()
        .mockRejectedValue(new PlatformAuthApiError('prefs boom', 500)),
    });
    renderPrefs();
    expect(await screen.findByText('prefs boom')).toBeTruthy();
  });

  it('UI34 preferences page states mandatory categories cannot be disabled', async () => {
    auth(['notifications.preferences.view']);
    renderPrefs();
    expect(await screen.findByText(/cannot be disabled/i)).toBeTruthy();
  });

  // ─── deliveries ───────────────────────────────────────────────────────────

  it('UI35 deliveries page renders H1 title and total', async () => {
    auth(['notifications.deliveries.view']);
    renderDeliveries();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Notification deliveries' }),
    ).toBeTruthy();
    expect(screen.getByText(/Total:\s*1/)).toBeTruthy();
  });

  it('UI36 deliveries page loads list via API', async () => {
    const client = auth(['notifications.deliveries.view']);
    renderDeliveries();
    await waitFor(() => expect(client.listPlatformNotificationDeliveries).toHaveBeenCalled());
    expect(await screen.findByText('del-1')).toBeTruthy();
    expect(screen.getByText('FAILED')).toBeTruthy();
  });

  it('UI37 retry controls hidden without notifications.deliveries.retry', async () => {
    auth(['notifications.deliveries.view']);
    renderDeliveries();
    await screen.findByText('del-1');
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(screen.queryByLabelText(/Retry reason/i)).toBeNull();
  });

  it('UI38 retry controls visible with notifications.deliveries.retry', async () => {
    auth(['notifications.deliveries.view', 'notifications.deliveries.retry']);
    renderDeliveries();
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(screen.getByText('Retry reason')).toBeTruthy();
  });

  it('UI39 retry posts reason and idempotency key', async () => {
    const client = auth(['notifications.deliveries.view', 'notifications.deliveries.retry']);
    renderDeliveries();
    const reasonInput = (await screen.findByText('Retry reason')).parentElement?.querySelector(
      'input',
    );
    expect(reasonInput).toBeTruthy();
    fireEvent.change(reasonInput!, { target: { value: 'ops_retry' } });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(client.retryPlatformNotificationDelivery).toHaveBeenCalled());
    const [, id, body, key] = client.retryPlatformNotificationDelivery.mock.calls[0];
    expect(id).toBe('del-1');
    expect(body.reason).toBe('ops_retry');
    expect(typeof key).toBe('string');
  });

  it('UI40 retry success notice', async () => {
    auth(['notifications.deliveries.view', 'notifications.deliveries.retry']);
    renderDeliveries();
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Retry requested.')).toBeTruthy();
  });

  it('UI41 deliveries empty state', async () => {
    auth(['notifications.deliveries.view'], {
      listPlatformNotificationDeliveries: vi
        .fn()
        .mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 25 }),
    });
    renderDeliveries();
    expect(await screen.findByText('No deliveries')).toBeTruthy();
  });

  it('UI42 deliveries load error surfaces via Alert', async () => {
    auth(['notifications.deliveries.view'], {
      listPlatformNotificationDeliveries: vi
        .fn()
        .mockRejectedValue(new PlatformAuthApiError('deliveries boom', 500)),
    });
    renderDeliveries();
    expect(await screen.findByText('deliveries boom')).toBeTruthy();
  });

  it('UI43 delivery status uses StatusBadge text label', async () => {
    auth(['notifications.deliveries.view']);
    renderDeliveries();
    expect(await screen.findByText('FAILED')).toBeTruthy();
  });

  // ─── boundaries / a11y / i18n ─────────────────────────────────────────────

  it('UI44 no PHI prompts on notification pages', async () => {
    auth(ALL_PERMS);
    renderTemplates();
    await screen.findByRole('heading', { level: 1, name: 'Notification templates' });
    expect(document.body.textContent).not.toMatch(/\bPHI\b.*enter|patient name|diagnosis|MRN/i);
  });

  it('UI45 no provider secrets / SMTP password UI', async () => {
    auth(ALL_PERMS);
    renderDeliveries();
    await screen.findByRole('heading', { level: 1, name: 'Notification deliveries' });
    expect(document.body.textContent).not.toMatch(
      /smtp password|api secret|provider token|webhook secret/i,
    );
  });

  it('UI46 no SMS / WhatsApp / push channel configuration surface', async () => {
    // N/A as standalone channel admin — Step 27 platform events are email-first; pages omit SMS/push config.
    auth(ALL_PERMS);
    renderTemplates();
    await screen.findByRole('heading', { level: 1, name: 'Notification templates' });
    expect(document.body.textContent).not.toMatch(/WhatsApp|SMS gateway|push certificate/i);
  });

  it('UI47 no Step 28/29 hardening / release surfaces', async () => {
    auth(ALL_PERMS);
    renderPrefs();
    await screen.findByRole('heading', { level: 1, name: 'Notification preferences' });
    expect(document.body.textContent).not.toMatch(/Step 28|Step 29|release freeze/i);
  });

  it('UI48 no payroll / bank / commission rate invention on notification pages', async () => {
    auth(ALL_PERMS);
    renderDeliveries();
    await screen.findByRole('heading', { level: 1, name: 'Notification deliveries' });
    expect(document.body.textContent).not.toMatch(/payslip|wire transfer|commission rate table/i);
  });

  it('UI49 templates page exposes focusable main heading landmark', async () => {
    auth(['notifications.templates.view']);
    renderTemplates();
    const h1 = await screen.findByRole('heading', {
      level: 1,
      name: 'Notification templates',
    });
    expect(h1.id).toBe('main-heading');
  });

  it('UI50 preferences page exposes focusable main heading landmark', async () => {
    auth(['notifications.preferences.view']);
    renderPrefs();
    const h1 = await screen.findByRole('heading', {
      level: 1,
      name: 'Notification preferences',
    });
    expect(h1.id).toBe('main-heading');
  });

  it('UI51 deliveries page exposes focusable main heading landmark', async () => {
    auth(['notifications.deliveries.view']);
    renderDeliveries();
    const h1 = await screen.findByRole('heading', {
      level: 1,
      name: 'Notification deliveries',
    });
    expect(h1.id).toBe('main-heading');
  });

  it('UI52 route paths match registry contract', () => {
    expect(getRouteById('notification-templates')?.path).toBe('/notifications/templates');
    expect(getRouteById('notification-templates-detail')?.path).toBe(
      '/notifications/templates/:key',
    );
    expect(getRouteById('notification-preferences')?.path).toBe('/notifications/preferences');
    expect(getRouteById('notification-deliveries')?.path).toBe('/notifications/deliveries');
  });

  it('UI53 all Step 27 nav routes are operations group + available', () => {
    for (const id of [
      'notification-templates',
      'notification-preferences',
      'notification-deliveries',
    ] as const) {
      const route = getRouteById(id);
      expect(route?.navGroup).toBe('operations');
      expect(route?.status).toBe('available');
      expect(route?.step).toBe(27);
      expect(route?.showInNav).toBe(true);
    }
  });

  it('UI54 en-US and ar-SY locale identities both render templates surface', async () => {
    auth(['notifications.templates.view']);
    mockUseI18n.mockReturnValue(stableI18nEn);
    const { unmount } = renderTemplates();
    expect(await screen.findByText('Notification templates')).toBeTruthy();
    unmount();
    mockUseI18n.mockReturnValue(stableI18nAr);
    renderTemplates();
    expect(await screen.findByText('Notification templates')).toBeTruthy();
  });

  it('UI55 en-US and ar-SY locale identities both render preferences surface', async () => {
    auth(['notifications.preferences.view']);
    mockUseI18n.mockReturnValue(stableI18nEn);
    const { unmount } = renderPrefs();
    expect(await screen.findByText('Notification preferences')).toBeTruthy();
    unmount();
    mockUseI18n.mockReturnValue(stableI18nAr);
    renderPrefs();
    expect(await screen.findByText('Notification preferences')).toBeTruthy();
  });

  it('UI56 en-US and ar-SY locale identities both render deliveries surface', async () => {
    auth(['notifications.deliveries.view']);
    mockUseI18n.mockReturnValue(stableI18nEn);
    const { unmount } = renderDeliveries();
    expect(await screen.findByText('Notification deliveries')).toBeTruthy();
    unmount();
    mockUseI18n.mockReturnValue(stableI18nAr);
    renderDeliveries();
    expect(await screen.findByText('Notification deliveries')).toBeTruthy();
  });

  it('UI57 preview does not require a separate manage permission (view suffices)', async () => {
    const client = auth(['notifications.templates.view']);
    renderTemplates();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Preview' }))[0]!);
    await waitFor(() => expect(client.previewPlatformNotificationTemplate).toHaveBeenCalled());
  });

  it('UI58 preference manage alone does not unlock templates or deliveries nav', () => {
    const nav = listNavRoutes({ permissions: ['notifications.preferences.manage'] });
    expect(nav.some((r) => r.id === 'notification-templates')).toBe(false);
    expect(nav.some((r) => r.id === 'notification-deliveries')).toBe(false);
    expect(nav.some((r) => r.id === 'notification-preferences')).toBe(false);
  });

  it('UI59 deliveries retry alone does not unlock deliveries nav', () => {
    const nav = listNavRoutes({ permissions: ['notifications.deliveries.retry'] });
    expect(nav.some((r) => r.id === 'notification-deliveries')).toBe(false);
  });

  it('UI60 no second notification engine / clinic CMS copy on Step 27 pages', async () => {
    auth(ALL_PERMS);
    const { unmount } = renderTemplates();
    await screen.findByRole('heading', { level: 1, name: 'Notification templates' });
    let body = document.body.textContent ?? '';
    expect(body).toMatch(/Code-defined/);
    expect(body).not.toMatch(/clinic notification center CMS|forked delivery engine/i);
    unmount();

    renderDeliveries();
    await screen.findByRole('heading', { level: 1, name: 'Notification deliveries' });
    body = document.body.textContent ?? '';
    expect(body).toMatch(/sanitized|no provider secrets/i);
    expect(body).not.toMatch(/raw stack trace|SMTP credentials/i);
  });
});
