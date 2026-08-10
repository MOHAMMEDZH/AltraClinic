/**
 * Step 15 Super Admin route matrix — permission gates, H1, no Step 16 actions.
 * Route-level RTL + a11y for every Step 15 route family: see addons-rtl-a11y.spec.tsx.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppProviders } from '../app/providers/AppProviders';
import { AddOnsListPage } from './addons/AddOnsListPage';
import { AddOnCreatePage } from './addons/AddOnCreatePage';
import { OverridesListPage, OverrideDetailPage, OverrideCreatePage } from './addons/OverridesPages';
import { CompositionPreviewPage } from './addons/CompositionPreviewPage';

const listPlatformAddOns = vi.fn();
const listPlatformCommercialOverrides = vi.fn();
const getPlatformCommercialOverride = vi.fn();
const getPlatformCommercialOverrideReadiness = vi.fn();
const listHealthcareCatalogItems = vi.fn();
const previewPlatformCommercialComposition = vi.fn();

let permissions: string[] = [];

vi.mock('../auth/PlatformAuthProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../auth/PlatformAuthProvider')>();
  return {
    ...actual,
    usePlatformAuth: () => ({
      client: {
        listPlatformAddOns,
        listPlatformCommercialOverrides,
        getPlatformCommercialOverride,
        getPlatformCommercialOverrideReadiness,
        listHealthcareCatalogItems,
        previewPlatformCommercialComposition,
      },
      withAccessToken: async (fn: (token: string) => Promise<unknown>) => fn('token'),
      principal: { permissions },
    }),
  };
});

describe('Step 15 route matrix — gates, H1, no assignment actions', () => {
  beforeEach(() => {
    permissions = [];
    listPlatformAddOns.mockResolvedValue({ items: [], page: 1, pageSize: 50, total: 0, emptyCatalog: true });
    listPlatformCommercialOverrides.mockResolvedValue({ items: [], page: 1, pageSize: 50, total: 0 });
    listHealthcareCatalogItems.mockResolvedValue({ items: [] });
    getPlatformCommercialOverride.mockResolvedValue({
      id: 'ov1',
      lifecycle: 'DRAFT',
      rowVersion: 1,
      reasonCode: 'OTHER',
      reasonNote: 'n',
      effects: [],
      runtimeEffective: false,
    });
    getPlatformCommercialOverrideReadiness.mockResolvedValue({
      status: 'ready',
      blockers: [],
      submitReady: false,
      runtimeEffective: false,
    });
  });

  afterEach(() => cleanup());

  const cases: Array<{
    name: string;
    path: string;
    element: React.ReactElement;
    need: string[];
    denyText: RegExp;
  }> = [
    {
      name: 'add-ons list',
      path: '/add-ons',
      element: <AddOnsListPage />,
      need: ['addon.view'],
      denyText: /addon\.view/i,
    },
    {
      name: 'add-ons create',
      path: '/add-ons/new',
      element: <AddOnCreatePage />,
      need: ['addon.manage'],
      denyText: /addon\.manage|permission/i,
    },
    {
      name: 'overrides list',
      path: '/commercial-overrides',
      element: <OverridesListPage />,
      need: ['override.view'],
      denyText: /override\.view/i,
    },
    {
      name: 'overrides create',
      path: '/commercial-overrides/new',
      element: <OverrideCreatePage />,
      need: ['override.request'],
      denyText: /override\.request|permission/i,
    },
    {
      name: 'composition preview',
      path: '/commercial-composition/preview',
      element: <CompositionPreviewPage />,
      need: ['addon.view', 'plan.view'],
      denyText: /permission|plan\.view|addon\.view/i,
    },
  ];

  for (const c of cases) {
    it(`${c.name}: denies without permission and does not flash restricted content`, async () => {
      permissions = [];
      render(
        <AppProviders>
          <MemoryRouter initialEntries={[c.path]}>
            <Routes>
              <Route path={c.path} element={c.element} />
            </Routes>
          </MemoryRouter>
        </AppProviders>,
      );
      expect(await screen.findByText(c.denyText)).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Apply to Subscription|Save to Tenant/i })).toBeNull();
    });

    it(`${c.name}: renders one H1 when permitted`, async () => {
      permissions = c.need;
      render(
        <AppProviders>
          <MemoryRouter initialEntries={[c.path]}>
            <Routes>
              <Route path={c.path} element={c.element} />
            </Routes>
          </MemoryRouter>
        </AppProviders>,
      );
      const h1s = await screen.findAllByRole('heading', { level: 1 });
      expect(h1s.length).toBe(1);
      expect(screen.queryByRole('button', { name: /Apply to Subscription|Save to Tenant/i })).toBeNull();
    });
  }

  it('override detail deep-link without view is gated', async () => {
    permissions = [];
    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/commercial-overrides/ov1']}>
          <Routes>
            <Route path="/commercial-overrides/:overrideId" element={<OverrideDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );
    expect(await screen.findByText(/override\.view/i)).toBeTruthy();
    expect(getPlatformCommercialOverride).not.toHaveBeenCalled();
  });
});
