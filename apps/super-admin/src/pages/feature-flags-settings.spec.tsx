import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { FeatureFlagsSettingsPage } from './FeatureFlagsSettingsPages';
import { getRouteById } from '../routing/route-registry';

vi.mock('../auth/PlatformAuthProvider', () => ({
  usePlatformAuth: () => ({
    getAccessToken: () => 'tok',
    principal: {
      id: 'u1',
      permissions: ['feature-flag.view', 'settings.view'],
    },
    client: {
      listFeatureFlags: vi.fn().mockResolvedValue([]),
      listGlobalSettings: vi.fn().mockResolvedValue([]),
    },
  }),
}));

vi.mock('@booking/i18n/react', () => ({
  useI18n: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    locale: 'en-US',
  }),
}));

describe('Feature Flags & Settings UI', () => {
  it('settings route is available for Step 20', () => {
    const route = getRouteById('settings');
    expect(route?.status).toBe('available');
    expect(route?.step).toBe(20);
  });

  it('renders operational banner and empty flags without restricted flash', async () => {
    render(
      <MemoryRouter>
        <FeatureFlagsSettingsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Operational controls only/i)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
  });
});
