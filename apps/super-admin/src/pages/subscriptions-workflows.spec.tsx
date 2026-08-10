import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppProviders } from '../app/providers/AppProviders';
import {
  SubscriptionsListPage,
  SubscriptionDetailPage,
  SubscriptionPreviewPage,
} from './subscriptions/SubscriptionsPages';
import { STATIC_PREVIEW_WARNING } from './subscriptions/subscriptions-shared';

const listPlatformSubscriptions = vi.fn();
const getPlatformSubscription = vi.fn();
const getPlatformSubscriptionReadiness = vi.fn();
const previewPlatformSubscription = vi.fn();
const activatePlatformSubscription = vi.fn();

let permissions: string[] = ['subscription.view'];

vi.mock('../auth/PlatformAuthProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../auth/PlatformAuthProvider')>();
  return {
    ...actual,
    usePlatformAuth: () => ({
      client: {
        listPlatformSubscriptions,
        getPlatformSubscription,
        getPlatformSubscriptionReadiness,
        previewPlatformSubscription,
        activatePlatformSubscription,
      },
      withAccessToken: async (fn: (token: string) => Promise<unknown>) => fn('token'),
      principal: { permissions },
    }),
  };
});

const draftRow = {
  id: 'sub1',
  platformTenantId: 'tenant-1',
  platformSubscriptionId: null,
  lifecycle: 'DRAFT',
  isCurrent: true,
  rowVersion: 1,
  planVersionId: 'pv1',
  planCanonicalKey: 'plan.lite',
  planVersionNumber: 1,
  planPublicationFingerprint: 'fp',
  addonVersionIds: [],
  overrideIds: [],
  addonCount: 0,
  overrideCount: 0,
  commercialStart: null,
  commercialEnd: null,
  scheduledActivationAt: null,
  cancelledAt: null,
  cancellationEffectiveAt: null,
  commercialFingerprint: null,
  fingerprintSchemaVersion: null,
  predecessorId: null,
  hasSnapshot: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  runtimeEffective: false as const,
  disclaimer: 'Commercial configuration only.',
};

describe('Step 16 — Subscription workflows', () => {
  beforeEach(() => {
    permissions = ['subscription.view'];
    listPlatformSubscriptions.mockReset();
    getPlatformSubscription.mockReset();
    getPlatformSubscriptionReadiness.mockReset();
    previewPlatformSubscription.mockReset();
    activatePlatformSubscription.mockReset();

    listPlatformSubscriptions.mockResolvedValue({ items: [], page: 1, pageSize: 50, total: 0 });
    getPlatformSubscription.mockResolvedValue(draftRow);
    getPlatformSubscriptionReadiness.mockResolvedValue({
      status: 'ready',
      blockers: [],
      warnings: [],
      fingerprintAvailable: true,
      runtimeEffective: false,
      disclaimer: 'Commercial configuration only.',
    });
    previewPlatformSubscription.mockResolvedValue({
      readiness: { status: 'ready', blockers: [], warnings: [], fingerprintAvailable: true },
      composition: { entitlements: ['module.scheduling'] },
      runtimeEffective: false,
      disclaimer: STATIC_PREVIEW_WARNING,
    });
  });

  afterEach(() => cleanup());

  it('gates subscriptions list on subscription.view', async () => {
    permissions = [];
    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/subscriptions']}>
          <Routes>
            <Route path="/subscriptions" element={<SubscriptionsListPage />} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    expect(await screen.findByText(/subscription\.view permission/i)).toBeTruthy();
    expect(listPlatformSubscriptions).not.toHaveBeenCalled();
  });

  it('shows runtime unchanged warning and never offers runtime assignment', async () => {
    permissions = ['subscription.view'];
    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/subscriptions']}>
          <Routes>
            <Route path="/subscriptions" element={<SubscriptionsListPage />} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    expect((await screen.findAllByText(/Commercial configuration only/i)).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /Apply to Subscription/i })).toBeNull();
    expect(screen.queryByText(/Step 17|billing/i)).toBeNull();
  });

  it('requires subscription.migrate before showing activate control', async () => {
    permissions = ['subscription.view'];
    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/subscriptions/sub1']}>
          <Routes>
            <Route path="/subscriptions/:subscriptionId" element={<SubscriptionDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    await screen.findByText(/plan\.lite/i);
    expect(screen.queryByRole('button', { name: /^Activate$/i })).toBeNull();

    permissions = ['subscription.view', 'subscription.migrate'];
    cleanup();
    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/subscriptions/sub1']}>
          <Routes>
            <Route path="/subscriptions/:subscriptionId" element={<SubscriptionDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    expect(await screen.findByRole('button', { name: /^Activate$/i })).toBeTruthy();
  });

  it('opens confirmation dialog before activate (no immediate API call)', async () => {
    permissions = ['subscription.view', 'subscription.migrate'];
    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/subscriptions/sub1']}>
          <Routes>
            <Route path="/subscriptions/:subscriptionId" element={<SubscriptionDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /^Activate$/i }));
    expect(await screen.findByText(/Activate commercial configuration/i)).toBeTruthy();
    expect(activatePlatformSubscription).not.toHaveBeenCalled();
  });

  it('shows static preview warning on preview tab', async () => {
    permissions = ['subscription.view'];
    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/subscriptions/sub1/preview']}>
          <Routes>
            <Route path="/subscriptions/:subscriptionId/preview" element={<SubscriptionPreviewPage />} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    expect(await screen.findByTestId('static-commercial-preview-warning')).toBeTruthy();
    await waitFor(() => {
      expect(previewPlatformSubscription).toHaveBeenCalledWith('token', 'sub1');
    });
    expect(screen.queryByRole('button', { name: /Apply to Subscription/i })).toBeNull();
  });

  it('renders immutable notice for non-draft configurations', async () => {
    permissions = ['subscription.view', 'subscription.assign'];
    getPlatformSubscription.mockResolvedValue({ ...draftRow, lifecycle: 'ACTIVE_COMMERCIAL' });
    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/subscriptions/sub1/plan']}>
          <Routes>
            <Route path="/subscriptions/:subscriptionId/plan" element={<SubscriptionDetailPage panel="plan" />} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    expect(await screen.findByText(/Historical configuration/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Save plan/i })).toBeNull();
  });
});
