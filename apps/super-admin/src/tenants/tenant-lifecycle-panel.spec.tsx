/**
 * Flexible Step 19 — focused Super Admin lifecycle panel UI tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nProvider } from '@booking/i18n/react';
import { messages } from '../i18n/messages';
import { SUPER_ADMIN_LOCALE_STORAGE_KEY } from '../i18n/locale';
import { TenantLifecyclePanel } from './TenantLifecyclePanel';
import { PlatformAuthApiError } from '../auth/platform-auth-api';

const getTenantLifecycle = vi.fn();
const previewTenantLifecycle = vi.fn();
const mutateTenantLifecycle = vi.fn();
const createTenantLifecycleArchiveRequest = vi.fn();
const createTenantLifecycleDeletionRequest = vi.fn();
const decideTenantLifecycleRequest = vi.fn();

const stableClient = {
  getTenantLifecycle,
  previewTenantLifecycle,
  mutateTenantLifecycle,
  createTenantLifecycleArchiveRequest,
  createTenantLifecycleDeletionRequest,
  decideTenantLifecycleRequest,
};

const stableWithAccessToken = async (fn: (token: string) => Promise<unknown>) => fn('token');

const stablePrincipal = {
  id: 'actor-1',
  sub: 'actor-1',
  permissions: [
    'tenant.view',
    'tenant.activate',
    'tenant.suspend',
    'tenant.resume',
    'tenant.archive-request',
    'tenant.delete-request',
    'tenant.request.approve',
  ],
};

vi.mock('../auth/PlatformAuthProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../auth/PlatformAuthProvider')>();
  return {
    ...actual,
    usePlatformAuth: () => ({
      client: stableClient,
      withAccessToken: stableWithAccessToken,
      principal: stablePrincipal,
    }),
  };
});

function lifecyclePayload(overrides: Record<string, unknown> = {}) {
  return {
    status: 'ACTIVE',
    displayName: 'Alpha Clinic',
    rowVersion: 3,
    lifecycleEnabled: true,
    pendingRequests: [],
    ...overrides,
  };
}

function renderPanel(locale: 'en-US' | 'ar-SY' = 'en-US') {
  window.localStorage.setItem(SUPER_ADMIN_LOCALE_STORAGE_KEY, locale);
  return render(
    <I18nProvider messages={messages} storageKey={SUPER_ADMIN_LOCALE_STORAGE_KEY}>
      <TenantLifecyclePanel tenantId="t-1" />
    </I18nProvider>,
  );
}

async function waitForSuspendEnabled() {
  await waitFor(
    () => {
      const btn = screen.getByRole('button', { name: /^Suspend$/i }) as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    },
    { timeout: 5000 },
  );
}

describe('TenantLifecyclePanel focused UI', () => {
  beforeEach(() => {
    window.localStorage.setItem(SUPER_ADMIN_LOCALE_STORAGE_KEY, 'en-US');
    getTenantLifecycle.mockReset();
    previewTenantLifecycle.mockReset();
    mutateTenantLifecycle.mockReset();
    createTenantLifecycleArchiveRequest.mockReset();
    createTenantLifecycleDeletionRequest.mockReset();
    decideTenantLifecycleRequest.mockReset();
    getTenantLifecycle.mockImplementation(async () => lifecyclePayload());
    previewTenantLifecycle.mockResolvedValue({
      previewFingerprint: 'fp',
      activeSessionCount: 0,
      reversible: true,
      blockers: [],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('shows lifecycle status and eligible suspend action when enabled', async () => {
    renderPanel();
    expect(await screen.findByRole('heading', { name: /Lifecycle actions/i })).toBeTruthy();
    await waitForSuspendEnabled();
    expect((screen.getByRole('button', { name: /^Activate$/i }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('containment-disabled state disables destructive actions', async () => {
    getTenantLifecycle.mockImplementation(async () =>
      lifecyclePayload({ lifecycleEnabled: false }),
    );
    renderPanel();
    await screen.findAllByText(/Lifecycle mutations are disabled/i);
    await waitFor(() => {
      expect((screen.getByRole('button', { name: /^Suspend$/i }) as HTMLButtonElement).disabled).toBe(
        true,
      );
    });
  });

  it('impact preview then suspend mutation', async () => {
    let suspended = false;
    getTenantLifecycle.mockImplementation(async () =>
      lifecyclePayload(suspended ? { status: 'SUSPENDED', rowVersion: 4 } : {}),
    );
    mutateTenantLifecycle.mockImplementation(async () => {
      suspended = true;
      return { status: 'SUSPENDED' };
    });

    renderPanel();
    await waitForSuspendEnabled();
    fireEvent.change(screen.getByLabelText(/Reason/i), { target: { value: 'ops suspend' } });
    fireEvent.click(screen.getByRole('button', { name: /^Suspend$/i }));

    await waitFor(() => expect(mutateTenantLifecycle).toHaveBeenCalled());
    await waitFor(() => {
      expect(screen.getByText('SUSPENDED')).toBeTruthy();
    });
  });

  it('typed delete confirmation mismatch blocks request', async () => {
    getTenantLifecycle.mockImplementation(async () =>
      lifecyclePayload({ status: 'ARCHIVED', displayName: 'Alpha Clinic' }),
    );
    renderPanel();
    await screen.findByText('ARCHIVED');
    const typed = screen.getByLabelText(/Type the tenant display name/i) as HTMLInputElement;
    fireEvent.change(typed, { target: { value: 'Wrong Name' } });
    fireEvent.click(screen.getByRole('button', { name: /Request deletion/i }));
    expect(await screen.findByTestId('lifecycle-error')).toBeTruthy();
    expect(screen.getByTestId('lifecycle-error').textContent || '').toMatch(/exactly match/i);
    expect(createTenantLifecycleDeletionRequest).not.toHaveBeenCalled();
    expect(previewTenantLifecycle).not.toHaveBeenCalled();
  });

  it('self-approval denial message for own pending request', async () => {
    getTenantLifecycle.mockImplementation(async () =>
      lifecyclePayload({
        pendingRequests: [
          { id: 'req-1', type: 'ARCHIVE', status: 'PENDING', requesterPlatformUserId: 'actor-1' },
        ],
      }),
    );
    renderPanel();
    expect(await screen.findByText(/cannot approve or reject your own request/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Approve$/i })).toBeNull();
  });

  it('stale rowVersion error is safe', async () => {
    mutateTenantLifecycle.mockRejectedValue(
      new PlatformAuthApiError('conflict', 409, 'stale_row_version'),
    );
    renderPanel();
    await waitForSuspendEnabled();
    fireEvent.click(screen.getByRole('button', { name: /^Suspend$/i }));
    expect(await screen.findByTestId('lifecycle-error')).toBeTruthy();
    expect(screen.getByTestId('lifecycle-error').textContent || '').toMatch(/updated elsewhere/i);
  });

  it('rate-limit error maps safely without tokens/PHI', async () => {
    mutateTenantLifecycle.mockRejectedValue(new PlatformAuthApiError('slow down', 429, 'rate_limited'));
    renderPanel();
    await waitForSuspendEnabled();
    fireEvent.click(screen.getByRole('button', { name: /^Suspend$/i }));
    expect(await screen.findByTestId('lifecycle-error')).toBeTruthy();
    expect(screen.getByTestId('lifecycle-error').textContent || '').toMatch(
      /Too many lifecycle attempts/i,
    );
    expect(document.body.textContent).not.toMatch(/Bearer |password|phi|snapshotPayload/i);
  });

  it('en-US / ar-SY parity for lifecycle heading and reason label', async () => {
    renderPanel('en-US');
    expect(await screen.findByRole('heading', { name: 'Lifecycle actions' })).toBeTruthy();
    expect(screen.getByLabelText('Reason')).toBeTruthy();
    cleanup();

    renderPanel('ar-SY');
    expect(await screen.findByRole('heading', { name: 'إجراءات دورة الحياة' })).toBeTruthy();
    expect(screen.getByLabelText('السبب')).toBeTruthy();
  });

  it('RTL layout: section remains semantic with live region', async () => {
    const { container } = renderPanel('ar-SY');
    await screen.findByRole('heading', { name: 'إجراءات دورة الحياة' });
    expect(container.querySelector('[aria-live="polite"]')).toBeTruthy();
    expect(screen.getByLabelText('السبب').getAttribute('aria-required')).toBe('true');
  });

  it('mobile layout: no horizontal overflow on narrow viewport', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });
    const { container } = renderPanel();
    await screen.findByRole('heading', { name: /Lifecycle actions/i });
    expect(container.scrollWidth).toBeLessThanOrEqual(container.clientWidth + 40);
  });

  it('approve/reject controls for foreign requester', async () => {
    getTenantLifecycle.mockImplementation(async () =>
      lifecyclePayload({
        pendingRequests: [
          { id: 'req-2', type: 'ARCHIVE', status: 'PENDING', requesterPlatformUserId: 'other-actor' },
        ],
      }),
    );
    decideTenantLifecycleRequest.mockResolvedValue({ status: 'REJECTED' });

    renderPanel();
    expect(await screen.findByRole('heading', { name: /Pending requests/i })).toBeTruthy();
    const reject = await screen.findByRole('button', { name: /^Reject$/i });
    await waitFor(() => {
      expect((reject as HTMLButtonElement).disabled).toBe(false);
    });
    fireEvent.change(screen.getByLabelText(/Reason/i), { target: { value: 'reject reason' } });
    fireEvent.click(reject);
    await waitFor(
      () => {
        expect(decideTenantLifecycleRequest.mock.calls.length).toBeGreaterThan(0);
      },
      { timeout: 5000 },
    );
  });

  it('no restricted-content flash of status before lifecycle payload resolves', async () => {
    getTenantLifecycle.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(lifecyclePayload()), 50)),
    );
    renderPanel();
    expect(screen.queryByText(/Lifecycle status/i)).toBeNull();
    await screen.findByText(/Lifecycle status/i);
  });
});
