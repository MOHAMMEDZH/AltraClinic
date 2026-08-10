/**
 * Flexible Step 22 — Operations Console UI matrix (UI01–UI40 focused).
 * Full AppRouter nav gates: permission-nav.spec.tsx (Operations link).
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformAuthApiError } from '../auth/platform-auth-api';
import { getRouteById, listNavRoutes } from '../routing/route-registry';
import {
  OperationsConsolePage,
  OperationsSectionPage,
} from './OperationsConsolePages';

const mockUsePlatformAuth = vi.fn();
const mockUseI18n = vi.fn();

vi.mock('../auth/PlatformAuthProvider', () => ({
  usePlatformAuth: () => mockUsePlatformAuth(),
}));

vi.mock('@booking/i18n/react', () => ({
  useI18n: () => mockUseI18n(),
}));

function defaultI18n(locale = 'en-US') {
  return {
    t: (_key: string, fallback?: string) => fallback ?? _key,
    locale,
  };
}

function authorizedClient(overrides: Record<string, unknown> = {}) {
  return {
    getOperationsOverview: vi.fn().mockResolvedValue({ cards: [] }),
    listOperationsJobs: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    listOperationsProvisioning: vi.fn().mockResolvedValue([]),
    retryOperationsProvisioning: vi.fn().mockResolvedValue({
      accepted: true,
      replayed: false,
      action: 'operations.provisioning.retry',
      targetId: 'prov-req-1',
      correlationId: 'corr-1',
      result: 'accepted',
      sourceEffect: 'delegated',
    }),
    getOperationsEntitlementHealth: vi.fn().mockResolvedValue({
      localCacheAdapterStatus: 'HEALTHY',
      note: 'process-local only',
    }),
    listOperationsIntegrations: vi.fn().mockResolvedValue([]),
    listOperationsBackups: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

const retryableProvisioningRow = {
  requestId: 'prov-req-1',
  tenantId: 'tenant-abc',
  status: 'FAILED_RETRYABLE',
  normalizedStatus: 'RETRYABLE',
  failureCode: 'TRANSIENT_DB',
  retryable: true,
  stale: false,
  rowVersion: 2,
};

const nonRetryableProvisioningRow = {
  requestId: 'prov-req-2',
  tenantId: 'tenant-def',
  status: 'FAILED_FINAL',
  normalizedStatus: 'NON_RETRYABLE',
  failureCode: 'VALIDATION',
  retryable: false,
  stale: false,
  rowVersion: 1,
};

function renderProvisioningSection(
  permissions: string[],
  clientOverrides: Record<string, unknown> = {},
) {
  mockUsePlatformAuth.mockReturnValue({
    getAccessToken: () => 'tok',
    principal: { id: 'u1', permissions },
    client: authorizedClient(clientOverrides),
  });
  return render(
    <MemoryRouter>
      <OperationsSectionPage section="provisioning" />
    </MemoryRouter>,
  );
}

describe('Operations Console UI', () => {
  beforeEach(() => {
    mockUseI18n.mockReturnValue(defaultI18n());
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('operations route is available for Step 22', () => {
    const route = getRouteById('operations');
    expect(route?.status).toBe('available');
    expect(route?.step).toBe(22);
    expect(route?.policy).toEqual({ type: 'permission', permission: 'operations.view' });
  });

  it('shows unauthorized when operations.view is missing (no restricted flash)', () => {
    const getOperationsOverview = vi.fn();
    mockUsePlatformAuth.mockReturnValue({
      getAccessToken: () => 'tok',
      principal: { id: 'u1', permissions: [] },
      client: { getOperationsOverview },
    });
    render(
      <MemoryRouter>
        <OperationsConsolePage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('pages.operationsConsole.unauthorized')).toBeTruthy();
    expect(screen.queryByText('pages.operationsConsole.healthHeading')).toBeNull();
    expect(screen.queryByRole('link', { name: 'pages.operationsConsole.nav.provisioning' })).toBeNull();
    expect(getOperationsOverview).not.toHaveBeenCalled();
  });

  it('renders loading then empty overview without restricted flash', async () => {
    const getOperationsOverview = vi.fn().mockResolvedValue({ cards: [] });
    mockUsePlatformAuth.mockReturnValue({
      getAccessToken: () => 'tok',
      principal: { id: 'u1', permissions: ['operations.view'] },
      client: { getOperationsOverview },
    });
    render(
      <MemoryRouter>
        <OperationsConsolePage />
      </MemoryRouter>,
    );
    expect(screen.getByText('pages.operationsConsole.loading')).toBeTruthy();
    expect(await screen.findByText('pages.operationsConsole.emptyTitle')).toBeTruthy();
    expect(screen.getByText('pages.operationsConsole.emptyBody')).toBeTruthy();
    expect(getOperationsOverview).toHaveBeenCalledWith('tok');
  });

  it('renders normalized status labels as visible text (not color-only)', async () => {
    const cards = [
      {
        id: 'O01',
        title: 'Platform/API health',
        normalizedStatus: 'HEALTHY',
        stale: false,
        message: null,
      },
      {
        id: 'O02',
        title: 'PostgreSQL readiness',
        normalizedStatus: 'UNHEALTHY',
        stale: false,
        message: null,
      },
      {
        id: 'O03',
        title: 'Cache/Redis health',
        normalizedStatus: 'DEGRADED',
        stale: false,
        message: null,
      },
      {
        id: 'O08',
        title: 'Local API cache state',
        normalizedStatus: 'STALE',
        stale: true,
        message: 'Local API cache state only (process-local Map).',
      },
      {
        id: 'O09',
        title: 'Compatibility validation',
        normalizedStatus: 'UNKNOWN',
        stale: false,
        message: 'No background validation job.',
      },
      {
        id: 'O10',
        title: 'Integrations foundation',
        normalizedStatus: 'DISABLED',
        stale: false,
        message: 'Feature disabled.',
      },
    ];
    mockUsePlatformAuth.mockReturnValue({
      getAccessToken: () => 'tok',
      principal: { id: 'u1', permissions: ['operations.view'] },
      client: {
        getOperationsOverview: vi.fn().mockResolvedValue({ cards }),
      },
    });
    render(
      <MemoryRouter>
        <OperationsConsolePage />
      </MemoryRouter>,
    );
    await screen.findByText('pages.operationsConsole.healthHeading');
    for (const status of ['HEALTHY', 'UNHEALTHY', 'DEGRADED', 'STALE', 'UNKNOWN', 'DISABLED']) {
      expect(screen.getByText(status)).toBeTruthy();
    }
    expect(screen.getByText(/\(pages\.operationsConsole\.stale\)/)).toBeTruthy();
    expect(screen.getByText(/Local API cache state only/)).toBeTruthy();
  });

  it('survives long status messages and correlation-style IDs without layout breakage', async () => {
    const longId =
      'corr-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const longMessage = `Evidence pointer ${longId} — process-local cache only; no global SoR.`;
    mockUsePlatformAuth.mockReturnValue({
      getAccessToken: () => 'tok',
      principal: { id: 'u1', permissions: ['operations.view'] },
      client: {
        getOperationsOverview: vi.fn().mockResolvedValue({
          cards: [
            {
              id: 'O08',
              title: 'Local API cache state',
              normalizedStatus: 'UNKNOWN',
              stale: true,
              message: longMessage,
            },
          ],
        }),
      },
    });
    render(
      <MemoryRouter>
        <OperationsConsolePage />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Evidence pointer corr-/)).toBeTruthy();
    expect(document.body.textContent).toContain(longId);
    expect(screen.getByText('UNKNOWN')).toBeTruthy();
  });

  it('shows generic error when overview load fails', async () => {
    mockUsePlatformAuth.mockReturnValue({
      getAccessToken: () => 'tok',
      principal: { id: 'u1', permissions: ['operations.view'] },
      client: {
        getOperationsOverview: vi.fn().mockRejectedValue(new Error('network')),
      },
    });
    render(
      <MemoryRouter>
        <OperationsConsolePage />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('pages.operationsConsole.errorGeneric')).toBeTruthy();
    expect(screen.queryByText('HEALTHY')).toBeNull();
  });

  it('includes Audit Center deep link and exactly one H1', async () => {
    mockUsePlatformAuth.mockReturnValue({
      getAccessToken: () => 'tok',
      principal: { id: 'u1', permissions: ['operations.view'] },
      client: authorizedClient(),
    });
    render(
      <MemoryRouter>
        <OperationsConsolePage />
      </MemoryRouter>,
    );
    await screen.findByText('pages.operationsConsole.emptyTitle');
    const auditLink = screen.getByRole('link', { name: 'pages.operationsConsole.linkAudit' });
    expect(auditLink.getAttribute('href')).toBe('/audit');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('pages.operationsConsole.title');
  });

  it('sets dir=rtl when locale is ar-SY', async () => {
    mockUseI18n.mockReturnValue(defaultI18n('ar-SY'));
    mockUsePlatformAuth.mockReturnValue({
      getAccessToken: () => 'tok',
      principal: { id: 'u1', permissions: ['operations.view'] },
      client: authorizedClient(),
    });
    const { container } = render(
      <MemoryRouter>
        <OperationsConsolePage />
      </MemoryRouter>,
    );
    await screen.findByText('pages.operationsConsole.emptyTitle');
    const rtlRoot = container.querySelector('[dir="rtl"]');
    expect(rtlRoot).toBeTruthy();
  });

  it('does not render forbidden secret or PHI-like strings from API payloads', async () => {
    mockUsePlatformAuth.mockReturnValue({
      getAccessToken: () => 'tok',
      principal: { id: 'u1', permissions: ['operations.view'] },
      client: authorizedClient({
        getOperationsOverview: vi.fn().mockResolvedValue({
          cards: [
            {
              id: 'O01',
              title: 'Platform/API health',
              normalizedStatus: 'HEALTHY',
              stale: false,
              message: 'All probes nominal.',
            },
          ],
        }),
        listOperationsJobs: vi.fn().mockResolvedValue({
          items: [
            {
              ref: 'job-1',
              normalizedStatus: 'RETRYABLE',
              retryable: true,
              tenantSummary: 'tenant:abcd1234',
            },
          ],
          nextCursor: null,
        }),
      }),
    });
    render(
      <MemoryRouter initialEntries={['/operations/jobs']}>
        <OperationsSectionPage section="jobs" />
      </MemoryRouter>,
    );
    await screen.findByText(/RETRYABLE/);
    const body = document.body.textContent ?? '';
    expect(body).not.toMatch(/sk_live_/i);
    expect(body).not.toMatch(/postgresql:\/\//i);
    expect(body).not.toMatch(/patient@example\.com/i);
    expect(body).not.toMatch(/\+1-555-/);
  });

  it('section page shows retryable job status as visible text', async () => {
    mockUsePlatformAuth.mockReturnValue({
      getAccessToken: () => 'tok',
      principal: { id: 'u1', permissions: ['operations.view'] },
      client: authorizedClient({
        listOperationsJobs: vi.fn().mockResolvedValue({
          items: [
            {
              ref: 'prov-req-1',
              normalizedStatus: 'RETRYABLE',
              retryable: true,
              failureCategory: 'TRANSIENT',
            },
          ],
          nextCursor: null,
        }),
      }),
    });
    render(
      <MemoryRouter>
        <OperationsSectionPage section="jobs" />
      </MemoryRouter>,
    );
    const pre = await screen.findByLabelText('pages.operationsConsole.rawSafeList');
    expect(within(pre).getByText(/RETRYABLE/)).toBeTruthy();
    expect(within(pre).getByText(/"retryable": true/)).toBeTruthy();
  });

  it('integrations section renders DISABLED and UNKNOWN union statuses', async () => {
    mockUsePlatformAuth.mockReturnValue({
      getAccessToken: () => 'tok',
      principal: { id: 'u1', permissions: ['operations.view'] },
      client: authorizedClient({
        listOperationsIntegrations: vi.fn().mockResolvedValue([
          {
            type: 'integrations_webhook_engine',
            normalizedStatus: 'DISABLED',
            classification: 'I-B',
          },
          {
            type: 'integrations_foundation',
            normalizedStatus: 'UNKNOWN',
            failureCategory: 'config',
            classification: 'I-C',
          },
        ]),
      }),
    });
    render(
      <MemoryRouter>
        <OperationsSectionPage section="integrations" />
      </MemoryRouter>,
    );
    const pre = await screen.findByLabelText('pages.operationsConsole.rawSafeList');
    expect(within(pre).getByText(/DISABLED/)).toBeTruthy();
    expect(within(pre).getByText(/UNKNOWN/)).toBeTruthy();
    expect(within(pre).queryByText(/UNAVAILABLE/)).toBeNull();
    expect(within(pre).queryByText(/NOT_AVAILABLE/)).toBeNull();
  });

  it('backups section never exposes storage paths (storagePathExposed false)', async () => {
    mockUsePlatformAuth.mockReturnValue({
      getAccessToken: () => 'tok',
      principal: { id: 'u1', permissions: ['operations.view'] },
      client: authorizedClient({
        listOperationsBackups: vi.fn().mockResolvedValue([
          {
            ref: 'backup_scheduler',
            normalizedStatus: 'HEALTHY',
            storagePathExposed: false,
          },
        ]),
      }),
    });
    render(
      <MemoryRouter>
        <OperationsSectionPage section="backups" />
      </MemoryRouter>,
    );
    const pre = await screen.findByLabelText('pages.operationsConsole.rawSafeList');
    expect(within(pre).getByText(/"storagePathExposed": false/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/s3:\/\//i);
    expect(document.body.textContent).not.toMatch(/\/var\/backups/i);
  });

  it('section page denies without operations.view', () => {
    mockUsePlatformAuth.mockReturnValue({
      getAccessToken: () => 'tok',
      principal: { id: 'u1', permissions: [] },
      client: authorizedClient(),
    });
    render(
      <MemoryRouter>
        <OperationsSectionPage section="integrations" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByLabelText('pages.operationsConsole.rawSafeList')).toBeNull();
  });

  describe('navigation visibility (operations.view)', () => {
    it('includes Operations in nav when operations.view is granted', () => {
      const nav = listNavRoutes({ permissions: ['operations.view'] });
      expect(nav.some((route) => route.id === 'operations')).toBe(true);
    });

    it('excludes Operations from nav without operations.view', () => {
      const nav = listNavRoutes({ permissions: [] });
      expect(nav.some((route) => route.id === 'operations')).toBe(false);
    });

    it('operations route policy denies unauthenticated principals', () => {
      const route = getRouteById('operations');
      expect(route?.policy.type).toBe('permission');
      expect(listNavRoutes(null).some((entry) => entry.id === 'operations')).toBe(false);
    });
  });

  describe('provisioning retry UI (UIA01–UIA18)', () => {
    beforeEach(() => {
      vi.stubGlobal('crypto', { randomUUID: () => 'test-idempotency-key-001' });
    });

    it('UIA01 unauthorized without tenant.provision.retry — no retry button', async () => {
      renderProvisioningSection(['operations.view'], {
        listOperationsProvisioning: vi.fn().mockResolvedValue([retryableProvisioningRow]),
      });
      await screen.findByTestId('provisioning-row-prov-req-1');
      expect(screen.queryByRole('button', { name: 'pages.operationsConsole.retryButton' })).toBeNull();
    });

    it('UIA02 with permission — retry control visible for retryable row', async () => {
      renderProvisioningSection(['operations.view', 'tenant.provision.retry'], {
        listOperationsProvisioning: vi.fn().mockResolvedValue([retryableProvisioningRow]),
      });
      await screen.findByTestId('provisioning-row-prov-req-1');
      expect(screen.getByRole('button', { name: 'pages.operationsConsole.retryButton' })).toBeTruthy();
    });

    it('UIA03 non-retryable hidden/disabled', async () => {
      renderProvisioningSection(['operations.view', 'tenant.provision.retry'], {
        listOperationsProvisioning: vi.fn().mockResolvedValue([nonRetryableProvisioningRow]),
      });
      await screen.findByTestId('provisioning-row-prov-req-2');
      expect(screen.queryByRole('button', { name: 'pages.operationsConsole.retryButton' })).toBeNull();
      expect(screen.getByTestId('retry-non-retryable-prov-req-2')).toBeTruthy();
      expect(screen.getByText('pages.operationsConsole.retryNonRetryable')).toBeTruthy();
    });

    it('UIA04 reason required (submit blocked/validation)', async () => {
      const retryOperationsProvisioning = vi.fn();
      renderProvisioningSection(['operations.view', 'tenant.provision.retry'], {
        listOperationsProvisioning: vi.fn().mockResolvedValue([retryableProvisioningRow]),
        retryOperationsProvisioning,
      });
      await screen.findByRole('button', { name: 'pages.operationsConsole.retryButton' });
      fireEvent.click(screen.getByRole('button', { name: 'pages.operationsConsole.retryButton' }));
      const form = await screen.findByTestId('retry-form-prov-req-1');
      fireEvent.submit(form);
      expect(await screen.findByText('pages.operationsConsole.retryReasonRequired')).toBeTruthy();
      expect(retryOperationsProvisioning).not.toHaveBeenCalled();
    });

    it('UIA05 success path calls API with idempotency key', async () => {
      const retryOperationsProvisioning = vi.fn().mockResolvedValue({
        accepted: true,
        replayed: false,
        action: 'operations.provisioning.retry',
        targetId: 'prov-req-1',
        correlationId: 'corr-1',
        result: 'accepted',
        sourceEffect: 'delegated',
      });
      renderProvisioningSection(['operations.view', 'tenant.provision.retry'], {
        listOperationsProvisioning: vi.fn().mockResolvedValue([retryableProvisioningRow]),
        retryOperationsProvisioning,
      });
      await screen.findByRole('button', { name: 'pages.operationsConsole.retryButton' });
      fireEvent.click(screen.getByRole('button', { name: 'pages.operationsConsole.retryButton' }));
      const form = await screen.findByTestId('retry-form-prov-req-1');
      fireEvent.change(within(form).getByLabelText('pages.operationsConsole.retryReasonLabel'), {
        target: { value: 'Transient failure cleared upstream' },
      });
      fireEvent.submit(form);
      await waitFor(() => expect(retryOperationsProvisioning).toHaveBeenCalledWith(
        'tok',
        'prov-req-1',
        { expectedRowVersion: 2, reason: 'Transient failure cleared upstream' },
        'test-idempotency-key-001',
      ));
      expect(await screen.findByText('pages.operationsConsole.retrySuccess')).toBeTruthy();
    });

    it('UIA06 replayed state message', async () => {
      renderProvisioningSection(['operations.view', 'tenant.provision.retry'], {
        listOperationsProvisioning: vi.fn().mockResolvedValue([retryableProvisioningRow]),
        retryOperationsProvisioning: vi.fn().mockResolvedValue({
          accepted: true,
          replayed: true,
          action: 'operations.provisioning.retry',
          targetId: 'prov-req-1',
          correlationId: 'corr-1',
          result: 'accepted',
          sourceEffect: 'delegated',
        }),
      });
      await screen.findByRole('button', { name: 'pages.operationsConsole.retryButton' });
      fireEvent.click(screen.getByRole('button', { name: 'pages.operationsConsole.retryButton' }));
      const form = await screen.findByTestId('retry-form-prov-req-1');
      fireEvent.change(within(form).getByLabelText('pages.operationsConsole.retryReasonLabel'), {
        target: { value: 'Replay test' },
      });
      fireEvent.submit(form);
      expect(await screen.findByText('pages.operationsConsole.retryReplayed')).toBeTruthy();
    });

    it('UIA07 conflict state', async () => {
      renderProvisioningSection(['operations.view', 'tenant.provision.retry'], {
        listOperationsProvisioning: vi.fn().mockResolvedValue([retryableProvisioningRow]),
        retryOperationsProvisioning: vi.fn().mockRejectedValue(
          new PlatformAuthApiError('conflict', 409, 'conflict'),
        ),
      });
      await screen.findByRole('button', { name: 'pages.operationsConsole.retryButton' });
      fireEvent.click(screen.getByRole('button', { name: 'pages.operationsConsole.retryButton' }));
      const form = await screen.findByTestId('retry-form-prov-req-1');
      fireEvent.change(within(form).getByLabelText('pages.operationsConsole.retryReasonLabel'), {
        target: { value: 'Conflict test' },
      });
      fireEvent.submit(form);
      expect(await screen.findByText('pages.operationsConsole.retryConflict')).toBeTruthy();
    });

    it('UIA08 rate limit / safe error', async () => {
      renderProvisioningSection(['operations.view', 'tenant.provision.retry'], {
        listOperationsProvisioning: vi.fn().mockResolvedValue([retryableProvisioningRow]),
        retryOperationsProvisioning: vi.fn().mockRejectedValue(
          new PlatformAuthApiError('Too many requests.', 429, 'rate_limited'),
        ),
      });
      await screen.findByRole('button', { name: 'pages.operationsConsole.retryButton' });
      fireEvent.click(screen.getByRole('button', { name: 'pages.operationsConsole.retryButton' }));
      const form = await screen.findByTestId('retry-form-prov-req-1');
      fireEvent.change(within(form).getByLabelText('pages.operationsConsole.retryReasonLabel'), {
        target: { value: 'Rate limit test' },
      });
      fireEvent.submit(form);
      expect(await screen.findByText('pages.operationsConsole.retryRateLimited')).toBeTruthy();
      expect(document.body.textContent).not.toMatch(/sk_live_/i);
    });

    it('UIA09 audit link present', async () => {
      renderProvisioningSection(['operations.view', 'tenant.provision.retry'], {
        listOperationsProvisioning: vi.fn().mockResolvedValue([retryableProvisioningRow]),
      });
      const auditLink = await screen.findByRole('link', { name: 'pages.operationsConsole.linkAudit' });
      expect(auditLink.getAttribute('href')).toBe('/audit');
    });

    it('UIA10 no cache invalidate UI (UI-CACHE-B)', async () => {
      renderProvisioningSection(['operations.view', 'tenant.provision.retry'], {
        listOperationsProvisioning: vi.fn().mockResolvedValue([retryableProvisioningRow]),
      });
      await screen.findByTestId('provisioning-row-prov-req-1');
      const body = document.body.textContent ?? '';
      expect(body).not.toMatch(/invalidate.*cache/i);
      expect(body).not.toMatch(/cacheApiOnlyNote/i);
      expect(screen.queryByRole('button', { name: /invalidate/i })).toBeNull();
    });

    it('UIA11 RTL dir', async () => {
      mockUseI18n.mockReturnValue(defaultI18n('ar-SY'));
      const { container } = renderProvisioningSection(
        ['operations.view', 'tenant.provision.retry'],
        { listOperationsProvisioning: vi.fn().mockResolvedValue([retryableProvisioningRow]) },
      );
      await screen.findByTestId('provisioning-row-prov-req-1');
      expect(container.querySelector('[dir="rtl"]')).toBeTruthy();
    });

    it('UIA12 no secrets/PHI in rendered text from mock payloads', async () => {
      renderProvisioningSection(['operations.view', 'tenant.provision.retry'], {
        listOperationsProvisioning: vi.fn().mockResolvedValue([
          {
            ...retryableProvisioningRow,
            adminEmail: 'patient@example.com',
            dbUrl: 'postgresql://secret:pass@host/db',
            apiKey: 'sk_live_abc123',
          },
        ]),
      });
      await screen.findByTestId('provisioning-row-prov-req-1');
      const body = document.body.textContent ?? '';
      expect(body).not.toMatch(/patient@example\.com/i);
      expect(body).not.toMatch(/postgresql:\/\//i);
      expect(body).not.toMatch(/sk_live_/i);
      expect(body).toContain('RETRYABLE');
    });

    it('UIA13 keyboard-focusable retry button', async () => {
      renderProvisioningSection(['operations.view', 'tenant.provision.retry'], {
        listOperationsProvisioning: vi.fn().mockResolvedValue([retryableProvisioningRow]),
      });
      const retryButton = await screen.findByRole('button', {
        name: 'pages.operationsConsole.retryButton',
      });
      retryButton.focus();
      expect(document.activeElement).toBe(retryButton);
    });

    it('UIA14 mobile: form still renders', async () => {
      renderProvisioningSection(['operations.view', 'tenant.provision.retry'], {
        listOperationsProvisioning: vi.fn().mockResolvedValue([retryableProvisioningRow]),
      });
      await screen.findByRole('button', { name: 'pages.operationsConsole.retryButton' });
      fireEvent.click(screen.getByRole('button', { name: 'pages.operationsConsole.retryButton' }));
      expect(await screen.findByTestId('retry-form-prov-req-1')).toBeTruthy();
      expect(screen.getByLabelText('pages.operationsConsole.retryReasonLabel')).toBeTruthy();
    });

    it('UIA15 pending/disabled while in-flight', async () => {
      let resolveRetry!: (value: unknown) => void;
      const retryOperationsProvisioning = vi.fn(
        () =>
          new Promise((resolve) => {
            resolveRetry = resolve;
          }),
      );
      renderProvisioningSection(['operations.view', 'tenant.provision.retry'], {
        listOperationsProvisioning: vi.fn().mockResolvedValue([retryableProvisioningRow]),
        retryOperationsProvisioning,
      });
      await screen.findByRole('button', { name: 'pages.operationsConsole.retryButton' });
      fireEvent.click(screen.getByRole('button', { name: 'pages.operationsConsole.retryButton' }));
      const form = await screen.findByTestId('retry-form-prov-req-1');
      fireEvent.change(within(form).getByLabelText('pages.operationsConsole.retryReasonLabel'), {
        target: { value: 'Pending test' },
      });
      fireEvent.submit(form);
      expect(await screen.findByText('pages.operationsConsole.retryPending')).toBeTruthy();
      const submit = within(form).getByRole('button', { name: 'pages.operationsConsole.retryPending' });
      expect((submit as HTMLButtonElement).disabled).toBe(true);
      resolveRetry({
        accepted: true,
        replayed: false,
        action: 'operations.provisioning.retry',
        targetId: 'prov-req-1',
        correlationId: 'corr-1',
        result: 'accepted',
        sourceEffect: 'delegated',
      });
      await waitFor(() =>
        expect(screen.getByText('pages.operationsConsole.retrySuccess')).toBeTruthy(),
      );
    });

    it('UIA16 empty provisioning list empty state', async () => {
      renderProvisioningSection(['operations.view'], {
        listOperationsProvisioning: vi.fn().mockResolvedValue([]),
      });
      expect(await screen.findByText('pages.operationsConsole.emptyTitle')).toBeTruthy();
      expect(screen.getByText('pages.operationsConsole.emptyBody')).toBeTruthy();
      expect(screen.queryByTestId(/provisioning-row-/)).toBeNull();
    });

    it('UIA17 step-up/forbidden error surfaces safe message (mock 403)', async () => {
      renderProvisioningSection(['operations.view', 'tenant.provision.retry'], {
        listOperationsProvisioning: vi.fn().mockResolvedValue([retryableProvisioningRow]),
        retryOperationsProvisioning: vi.fn().mockRejectedValue(
          new PlatformAuthApiError('Fresh step-up required.', 403, 'PLATFORM_STEP_UP_REQUIRED'),
        ),
      });
      await screen.findByRole('button', { name: 'pages.operationsConsole.retryButton' });
      fireEvent.click(screen.getByRole('button', { name: 'pages.operationsConsole.retryButton' }));
      const form = await screen.findByTestId('retry-form-prov-req-1');
      fireEvent.change(within(form).getByLabelText('pages.operationsConsole.retryReasonLabel'), {
        target: { value: 'Step-up test' },
      });
      fireEvent.submit(form);
      expect(await screen.findByText('pages.operationsConsole.retryStepUpRequired')).toBeTruthy();
    });

    it('UIA18 restricted content no flash when missing operations.view', () => {
      const listOperationsProvisioning = vi.fn();
      mockUsePlatformAuth.mockReturnValue({
        getAccessToken: () => 'tok',
        principal: { id: 'u1', permissions: [] },
        client: authorizedClient({ listOperationsProvisioning }),
      });
      render(
        <MemoryRouter>
          <OperationsSectionPage section="provisioning" />
        </MemoryRouter>,
      );
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.getByText('pages.operationsConsole.unauthorized')).toBeTruthy();
      expect(screen.queryByTestId(/provisioning-row-/)).toBeNull();
      expect(screen.queryByText('pages.operationsConsole.provisioningList')).toBeNull();
      expect(listOperationsProvisioning).not.toHaveBeenCalled();
    });
  });
});
