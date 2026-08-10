import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProviders } from '../app/providers/AppProviders';
import { AppRouter } from '../app/router';
import { __resetPlatformAccessTokenForTests } from '../auth/PlatformAuthProvider';
import type { DashboardMetric, PlatformDashboard } from './types';

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  };
}

function renderApp(initialPath: string) {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[initialPath]}>
        <AppRouter />
      </MemoryRouter>
    </AppProviders>,
  );
}

function metric(overrides: Partial<DashboardMetric> & Pick<DashboardMetric, 'id' | 'section'>): DashboardMetric {
  return {
    labelKey: `dashboard.metrics.${overrides.id}.label`,
    descriptionKey: `dashboard.metrics.${overrides.id}.description`,
    definitionKey: `dashboard.metrics.${overrides.id}.definition`,
    value: null,
    unit: 'tenants',
    status: 'available',
    asOf: '2026-07-23T00:00:00.000Z',
    sourceKey: 'platform_tenants',
    sourceLabelKey: 'dashboard.sources.platformTenants',
    timeWindow: 'snapshot',
    staleAfterSeconds: 120,
    isStale: false,
    availability: 'available',
    quality: 'exact',
    requiredPermissions: ['tenant.view'],
    scope: 'platform',
    ...overrides,
  } as DashboardMetric;
}

function dashboardPayload(): PlatformDashboard {
  const footprint: DashboardMetric[] = [
    metric({ id: 'tenant.total', section: 'footprint', value: 42, status: 'available' }),
    metric({
      id: 'tenant.byStatus',
      section: 'footprint',
      value: 42,
      status: 'available',
      breakdown: [
        { key: 'ACTIVE', labelKey: 'dashboard.breakdown.tenantStatus.active', count: 30 },
        { key: 'ARCHIVED', labelKey: 'dashboard.breakdown.tenantStatus.archived', count: 0 },
      ],
    }),
    metric({
      id: 'planVersion.distribution',
      section: 'footprint',
      value: null,
      status: 'unavailable',
      availability: 'unavailable',
      quality: 'none',
      requiredPermissions: ['plan-version.view'],
      reasonCode: 'no_plan_version_source',
    }),
  ];
  const commercial: DashboardMetric[] = [
    metric({
      id: 'subscription.byStatus',
      section: 'commercial',
      unit: 'subscriptions',
      value: null,
      status: 'permission_limited',
      requiredPermissions: ['subscription.view'],
    }),
  ];
  return {
    generatedAt: '2026-07-23T00:00:00.000Z',
    sections: [
      { id: 'footprint', availability: 'available', metrics: footprint },
      { id: 'commercial', availability: 'available', metrics: commercial },
    ],
    metrics: [...footprint, ...commercial],
    attentionItems: [],
    warnings: [],
  };
}

function baseHandler(state: { dashboardGets: string[]; dashboardRefreshPosts: number }) {
  return async (url: string, init?: RequestInit) => {
    const path = String(url);
    const method = init?.method ?? 'GET';
    if (path.includes('/platform/auth/refresh') && method === 'POST') {
      return jsonResponse(200, {
        accessToken: 'access-1',
        accessExpiresIn: 900,
        sessionId: 's1',
        tokenType: 'Bearer',
        principalType: 'platform',
      });
    }
    if (path.includes('/platform/auth/me')) {
      return jsonResponse(200, {
        id: 'pu1',
        email: 'ops@example.com',
        displayName: 'Ops',
        principalType: 'platform',
        accountStatus: 'active',
        status: 'active',
        sessionId: 's1',
        mfaEnabled: true,
        roleKeys: ['auditor'],
        permissions: ['tenant.view'],
        authzRevision: 1,
      });
    }
    if (path.includes('/platform/dashboard/refresh') && method === 'POST') {
      state.dashboardRefreshPosts += 1;
      return jsonResponse(200, dashboardPayload());
    }
    if (path.includes('/platform/dashboard') && method === 'GET') {
      state.dashboardGets.push(path);
      return jsonResponse(200, dashboardPayload());
    }
    return jsonResponse(404, {});
  };
}

describe('Release 47 Step 10 — DashboardPage', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPER_ADMIN_APP_NAME', 'Super Admin');
    vi.stubEnv('VITE_SUPER_ADMIN_ENV', 'test');
    vi.stubEnv('VITE_API_BASE_URL', '/api');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    __resetPlatformAccessTokenForTests();
  });

  it('renders the dashboard with real aggregate values and a breakdown', async () => {
    const state = { dashboardGets: [] as string[], dashboardRefreshPosts: 0 };
    fetchMock.mockReset();
    fetchMock.mockImplementation(baseHandler(state));
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/overview');

    await waitFor(() => expect(screen.getByTestId('metric-value-tenant.total')).toBeTruthy());
    expect(screen.getByTestId('metric-value-tenant.total').textContent).toContain('42');
    // Section heading localized from the message catalog.
    expect(screen.getByRole('heading', { name: 'Platform footprint' })).toBeTruthy();
    // Breakdown row labels are localized and counts (including 0) are shown.
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText('Archived')).toBeTruthy();
  });

  it('never renders a fake number for an unavailable metric — shows the reason instead', async () => {
    const state = { dashboardGets: [] as string[], dashboardRefreshPosts: 0 };
    fetchMock.mockReset();
    fetchMock.mockImplementation(baseHandler(state));
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/overview');

    await waitFor(() => expect(screen.getByTestId('metric-unavailable-planVersion.distribution')).toBeTruthy());
    // No numeric value node exists for the unavailable metric.
    expect(screen.queryByTestId('metric-value-planVersion.distribution')).toBeNull();
    expect(screen.getByText('No Plan Version source of record exists yet.')).toBeTruthy();
  });

  it('renders a permission-limited metric without exposing any number', async () => {
    const state = { dashboardGets: [] as string[], dashboardRefreshPosts: 0 };
    fetchMock.mockReset();
    fetchMock.mockImplementation(baseHandler(state));
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/overview');

    await waitFor(() => expect(screen.getByTestId('metric-permission-subscription.byStatus')).toBeTruthy());
    expect(screen.queryByTestId('metric-value-subscription.byStatus')).toBeNull();
    expect(screen.getByText('You do not have permission to view this metric.')).toBeTruthy();
  });

  it('manual refresh POSTs to /platform/dashboard/refresh (never GET with refresh query)', async () => {
    const state = { dashboardGets: [] as string[], dashboardRefreshPosts: 0 };
    fetchMock.mockReset();
    fetchMock.mockImplementation(baseHandler(state));
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/overview');
    await waitFor(() => expect(screen.getByTestId('metric-value-tenant.total')).toBeTruthy());
    expect(state.dashboardGets.some((p) => p.includes('refresh'))).toBe(false);
    expect(state.dashboardRefreshPosts).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(state.dashboardRefreshPosts).toBe(1));
    expect(state.dashboardGets.some((p) => p.includes('refresh'))).toBe(false);
  });

  it('double refresh click issues only one POST while refresh is in flight', async () => {
    const state = { dashboardGets: [] as string[], dashboardRefreshPosts: 0 };
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const path = String(url);
      const method = init?.method ?? 'GET';
      if (path.includes('/platform/dashboard/refresh') && method === 'POST') {
        state.dashboardRefreshPosts += 1;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return jsonResponse(200, dashboardPayload());
      }
      return baseHandler(state)(url, init);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/overview');
    await waitFor(() => expect(screen.getByTestId('metric-value-tenant.total')).toBeTruthy());

    const refreshButton = screen.getByRole('button', { name: 'Refresh' });
    fireEvent.click(refreshButton);
    fireEvent.click(refreshButton);
    await waitFor(() => expect(state.dashboardRefreshPosts).toBe(1));
  });

  it('surfaces a load error without crashing the shell', async () => {
    const state = { dashboardGets: [] as string[], dashboardRefreshPosts: 0 };
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const path = String(url);
      if (path.includes('/platform/dashboard')) {
        return jsonResponse(500, { message: 'Server error' });
      }
      return baseHandler(state)(url, init);
    });
    vi.stubGlobal('fetch', fetchMock);

    renderApp('/overview');
    // Shell + page header still render; an error alert is shown.
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeTruthy());
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  });
});
