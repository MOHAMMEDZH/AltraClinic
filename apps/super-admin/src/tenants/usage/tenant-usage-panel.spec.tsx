import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { AppProviders } from '../../app/providers/AppProviders';
import { TenantUsagePanel } from './TenantUsagePanel';

const listTenantUsage = vi.fn();

vi.mock('../../auth/PlatformAuthProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../auth/PlatformAuthProvider')>();
  return {
    ...actual,
    usePlatformAuth: () => ({
      client: { listTenantUsage },
      withAccessToken: async (fn: (token: string) => Promise<unknown>) => fn('token'),
      principal: mockPrincipal,
    }),
  };
});

let mockPrincipal: { permissions: string[] } = { permissions: [] };

function renderPanel() {
  return render(
    <AppProviders>
      <TenantUsagePanel tenantId="t-1" />
    </AppProviders>,
  );
}

describe('TenantUsagePanel', () => {
  afterEach(() => {
    cleanup();
    listTenantUsage.mockReset();
    mockPrincipal = { permissions: [] };
  });

  it('shows usage.view forbidden when permission missing', () => {
    mockPrincipal = { permissions: ['tenant.view'] };
    renderPanel();
    expect(screen.getByText(/Usage and Limits/i)).toBeTruthy();
    expect(screen.getByText(/usage\.view permission required/i)).toBeTruthy();
    expect(listTenantUsage).not.toHaveBeenCalled();
  });

  it('renders translated Limit states when usage.view is granted', async () => {
    mockPrincipal = { permissions: ['usage.view'] };
    listTenantUsage.mockResolvedValue({
      tenantId: 't-1',
      meters: [
        {
          meterKey: 'meter.max_users',
          limitKey: 'limit.max_users',
          currentValue: '1',
          projectedValue: '1',
          limitState: 'CONFIGURED',
          limitValue: '10',
          thresholdState: 'ok',
          staleClass: 'FRESH',
          enforcementMode: 'HARD',
          periodType: 'LIFETIME',
          privacyClass: 'OPERATIONAL_AGGREGATE',
        },
        {
          meterKey: 'meter.max_branches',
          limitKey: 'limit.max_branches',
          currentValue: '0',
          projectedValue: '0',
          limitState: 'UNLIMITED',
          staleClass: 'FRESH',
          enforcementMode: 'HARD',
          periodType: 'LIFETIME',
          privacyClass: 'OPERATIONAL_AGGREGATE',
        },
        {
          meterKey: 'meter.max_patients',
          limitKey: 'limit.max_patients',
          currentValue: '0',
          projectedValue: '0',
          limitState: 'UNCONFIGURED',
          staleClass: 'SOURCE_UNAVAILABLE',
          enforcementMode: 'HARD',
          periodType: 'LIFETIME',
          privacyClass: 'OPERATIONAL_AGGREGATE',
        },
      ],
    });
    renderPanel();
    await waitFor(() => expect(listTenantUsage).toHaveBeenCalled());
    expect(await screen.findByText('Configured')).toBeTruthy();
    expect(screen.getByText('Unlimited')).toBeTruthy();
    expect(screen.getByText('Unconfigured')).toBeTruthy();
  });
});
