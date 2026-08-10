import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProviders } from '../app/providers/AppProviders';
import { TenantDirectoryPage } from '../pages/TenantDirectoryPage';
import { evaluatePermissionPolicy } from '../routing/permission-policy';
import { getRouteById } from '../routing/route-registry';

const listPlatformTenants = vi.fn();

vi.mock('../auth/PlatformAuthProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../auth/PlatformAuthProvider')>();
  return {
    ...actual,
    usePlatformAuth: () => ({
      client: { listPlatformTenants },
      withAccessToken: async (fn: (token: string) => Promise<unknown>) => fn('token'),
      principal: { permissions: ['tenant.view'] },
    }),
  };
});

describe('TenantDirectoryPage', () => {
  beforeEach(() => {
    listPlatformTenants.mockResolvedValue({
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
          legacyPlan: null,
          legacyPlanAvailability: 'permission_limited',
          subscriptionSummary: null,
          subscriptionAvailability: 'permission_limited',
        },
      ],
      pagination: { page: 1, pageSize: 25, total: 1, hasNextPage: false },
      appliedFilters: {},
      sort: { field: 'createdAt', direction: 'desc' },
      availableFilters: ['status'],
      warnings: [],
    });
  });

  it('renders read-only banner and tenant row', async () => {
    render(
      <AppProviders>
        <MemoryRouter>
          <TenantDirectoryPage />
        </MemoryRouter>
      </AppProviders>,
    );
    expect(await screen.findByText('Alpha Clinic')).toBeTruthy();
    expect(screen.getByText(/Read-only directory/i)).toBeTruthy();
  });
});

describe('Tenant routes permissions', () => {
  it('tenants routes require tenant.view', () => {
    const tenants = getRouteById('tenants');
    const detail = getRouteById('tenants-detail');
    expect(tenants?.status).toBe('available');
    expect(detail?.status).toBe('available');
    expect(evaluatePermissionPolicy({ permissions: ['tenant.view'] }, tenants!.policy)).toBe(true);
    expect(evaluatePermissionPolicy({ permissions: [] }, tenants!.policy)).toBe(false);
  });
});
