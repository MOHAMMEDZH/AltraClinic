import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getRouteById } from '../routing/route-registry';

const mockUsePlatformAuth = vi.fn();
const mockUseI18n = vi.fn();

vi.mock('../auth/PlatformAuthProvider', () => ({
  usePlatformAuth: () => mockUsePlatformAuth(),
}));

vi.mock('@booking/i18n/react', () => ({
  useI18n: () => mockUseI18n(),
}));

import { AuditCenterPage } from './AuditCenterPages';

/** Stable identity — production I18nProvider memoizes `t`; unstable mocks re-trigger load effects. */
const stableT = (_key: string, fallback?: string) => fallback ?? _key;
const stableI18n = { t: stableT, locale: 'en-US' as const };

describe('Audit Center UI', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('audit route is available for Step 21', () => {
    const route = getRouteById('audit');
    expect(route?.status).toBe('available');
    expect(route?.step).toBe(21);
  });

  it('renders AuditCenterPage with empty results from searchAuditEntries', async () => {
    mockUseI18n.mockReturnValue(stableI18n);
    mockUsePlatformAuth.mockReturnValue({
      getAccessToken: () => 'tok',
      principal: { id: 'u1', permissions: ['audit.view', 'audit.export'] },
      client: {
        searchAuditEntries: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
      },
    });
    render(
      <MemoryRouter>
        <AuditCenterPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText('pages.auditCenter.empty')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /edit/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
  });

  it('shows unauthorized when audit.view is missing', () => {
    mockUseI18n.mockReturnValue(stableI18n);
    mockUsePlatformAuth.mockReturnValue({
      getAccessToken: () => 'tok',
      principal: { id: 'u1', permissions: [] },
      client: { searchAuditEntries: vi.fn() },
    });
    render(
      <MemoryRouter>
        <AuditCenterPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('pages.auditCenter.unauthorized')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /edit/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
  });
});
