import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProviders } from '../app/providers/AppProviders';
import { TenantDirectoryPage } from '../pages/TenantDirectoryPage';
import { SUPER_ADMIN_LOCALE_STORAGE_KEY } from '../i18n/locale';

const listPlatformTenants = vi.fn();
let mockPermissions = ['tenant.view', 'plan.view', 'subscription.view'];

vi.mock('../auth/PlatformAuthProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../auth/PlatformAuthProvider')>();
  return {
    ...actual,
    usePlatformAuth: () => ({
      client: { listPlatformTenants },
      withAccessToken: async (fn: (token: string) => Promise<unknown>) => fn('token'),
      principal: { permissions: mockPermissions },
    }),
  };
});

function directoryPayload(overrides: Record<string, unknown> = {}) {
  return {
    generatedAt: new Date().toISOString(),
    items: [
      {
        platformTenantId: 'pt-1',
        tenantId: 't-1',
        displayName: 'Alpha Clinic',
        slug: 'alpha',
        status: 'ACTIVE',
        region: 'ME_SOUTH',
        trialEndsAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        facilityType: 'medical',
        legacyPlan: 'LITE',
        legacyPlanAvailability: 'available',
        subscriptionSummary: { status: 'ACTIVE', plan: 'LITE' },
        subscriptionAvailability: 'available',
      },
    ],
    pagination: { page: 1, pageSize: 25, total: 1, hasNextPage: false },
    appliedFilters: {},
    sort: { field: 'createdAt', direction: 'desc' },
    availableFilters: ['status'],
    warnings: [],
    ...overrides,
  };
}

function renderDirectory() {
  return render(
    <AppProviders>
      <MemoryRouter>
        <TenantDirectoryPage />
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('TenantDirectoryPage', () => {
  beforeEach(() => {
    mockPermissions = ['tenant.view', 'plan.view', 'subscription.view'];
    listPlatformTenants.mockResolvedValue(directoryPayload());
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    document.documentElement.lang = 'en-US';
    document.documentElement.dir = 'ltr';
  });

  it('renders read-only banner and tenant row', async () => {
    renderDirectory();
    expect(await screen.findByText('Alpha Clinic')).toBeTruthy();
    expect(screen.getByText(/Read-only directory/i)).toBeTruthy();
  });

  it('submits allowlisted search and status params', async () => {
    renderDirectory();
    await screen.findByText('Alpha Clinic');
    fireEvent.change(screen.getByLabelText(/Search/i), { target: { value: 'alpha' } });
    fireEvent.change(screen.getByLabelText(/Status/i), { target: { value: 'ACTIVE' } });
    fireEvent.click(screen.getByRole('button', { name: /Search/i }));
    await waitFor(() => {
      expect(listPlatformTenants).toHaveBeenLastCalledWith(
        'token',
        expect.objectContaining({ search: 'alpha', status: 'ACTIVE', page: 1 }),
      );
    });
  });

  it('caps search input length at 64 characters', () => {
    renderDirectory();
    const input = screen.getByLabelText(/Search/i) as HTMLInputElement;
    expect(input.maxLength).toBe(64);
  });

  it('clears status filter when All statuses is selected', async () => {
    renderDirectory();
    await screen.findByText('Alpha Clinic');
    fireEvent.change(screen.getByLabelText(/Status/i), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /Search/i }));
    await waitFor(() => {
      expect(listPlatformTenants).toHaveBeenLastCalledWith(
        'token',
        expect.objectContaining({ status: '', page: 1 }),
      );
    });
  });

  it('shows legacy plan and subscription when permissions are granted', async () => {
    renderDirectory();
    await screen.findByText('Alpha Clinic');
    expect(screen.getByText('LITE')).toBeTruthy();
    expect(screen.getByText(/ACTIVE \/ LITE/)).toBeTruthy();
  });

  it('masks legacy plan and subscription without extra permissions', async () => {
    mockPermissions = ['tenant.view'];
    listPlatformTenants.mockResolvedValue(
      directoryPayload({
        items: [
          {
            ...directoryPayload().items[0],
            displayName: 'Beta Clinic',
            legacyPlan: null,
            legacyPlanAvailability: 'permission_limited',
            subscriptionSummary: null,
            subscriptionAvailability: 'permission_limited',
          },
        ],
      }),
    );
    renderDirectory();
    expect(await screen.findByText('Beta Clinic')).toBeTruthy();
    expect(screen.getAllByText(/Permission limited/i).length).toBeGreaterThan(0);
  });

  it('does not render contact fields in directory rows', async () => {
    renderDirectory();
    await screen.findByText('Alpha Clinic');
    expect(screen.queryByText(/contact/i)).toBeNull();
    expect(screen.queryByText(/phone/i)).toBeNull();
    expect(screen.queryByText(/email/i)).toBeNull();
  });

  it('paginates forward when Next is clicked', async () => {
    listPlatformTenants.mockResolvedValue(
      directoryPayload({ pagination: { page: 1, pageSize: 25, total: 50, hasNextPage: true } }),
    );
    renderDirectory();
    await screen.findByText('Alpha Clinic');
    listPlatformTenants.mockResolvedValue(
      directoryPayload({ pagination: { page: 2, pageSize: 25, total: 50, hasNextPage: false } }),
    );
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    await waitFor(() => {
      expect(listPlatformTenants).toHaveBeenLastCalledWith('token', expect.objectContaining({ page: 2 }));
    });
  });

  it('does not expose show-all pagination control', async () => {
    renderDirectory();
    await screen.findByText('Alpha Clinic');
    expect(screen.queryByText(/show all/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /all tenants/i })).toBeNull();
  });

  it('renders Arabic copy when locale is ar-SY', async () => {
    localStorage.setItem(SUPER_ADMIN_LOCALE_STORAGE_KEY, 'ar-SY');
    renderDirectory();
    const matches = await screen.findAllByText(/المستأجرون|دليل/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('sets document dir rtl when locale is ar-SY', async () => {
    localStorage.setItem(SUPER_ADMIN_LOCALE_STORAGE_KEY, 'ar-SY');
    renderDirectory();
    await screen.findByText(/Alpha Clinic|عيادة/i);
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar-SY');
  });

  it('ignores older resolved requests when a newer query is in flight', async () => {
    let resolveFirst: ((value: unknown) => void) | undefined;
    const first = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    listPlatformTenants.mockReturnValueOnce(first);
    listPlatformTenants.mockResolvedValue(
      directoryPayload({
        items: [{ ...directoryPayload().items[0], displayName: 'Newer Clinic' }],
      }),
    );
    renderDirectory();
    await waitFor(() => expect(listPlatformTenants).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText(/Search/i), { target: { value: 'beta' } });
    fireEvent.click(screen.getByRole('button', { name: /Search/i }));
    expect(await screen.findByText('Newer Clinic')).toBeTruthy();
    resolveFirst?.(
      directoryPayload({ items: [{ ...directoryPayload().items[0], displayName: 'Stale Clinic' }] }),
    );
    expect(screen.queryByText('Stale Clinic')).toBeNull();
  });
});
