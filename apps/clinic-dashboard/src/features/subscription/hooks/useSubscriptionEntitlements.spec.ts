/** @vitest-environment jsdom */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useSubscriptionEntitlements } from './useSubscriptionEntitlements';

vi.mock('@/features/ai/hooks/useAiSubscription', () => ({
  useAiSubscription: () => ({
    planName: 'starter',
    limits: {},
    isLoading: false,
    canUse: false,
    quotaExceeded: false,
  }),
}));

vi.mock('../hooks/useSubscription', () => ({
  useSubscriptionUsage: () => ({ isLoading: false, dashboard: null }),
  useTenantSubscription: () => ({ isLoading: false, data: null }),
  useTenantEntitlements: vi.fn(),
}));

import { useTenantEntitlements } from '../hooks/useSubscription';

describe('useSubscriptionEntitlements fail-closed', () => {
  it('denies write/mutate when entitlements are unavailable', () => {
    vi.mocked(useTenantEntitlements).mockReturnValue({
      isLoading: false,
      isSuccess: false,
      isError: true,
      data: undefined,
    } as never);

    const { result } = renderHook(() => useSubscriptionEntitlements());

    expect(result.current.canWrite).toBe(false);
    expect(result.current.canMutate).toBe(false);
    expect(result.current.safeMode).toBe(true);
    expect(result.current.canUseModule('patients')).toBe(false);
  });

  it('allows write when server entitlements confirm access', () => {
    vi.mocked(useTenantEntitlements).mockReturnValue({
      isLoading: false,
      isSuccess: true,
      isError: false,
      data: {
        canWrite: true,
        canMutate: true,
        license: {
          uiPlan: 'professional',
          modules: { patients: 'enabled' },
          features: { apiAccess: 'enabled' },
        },
        usageLimits: [],
      },
    } as never);

    const { result } = renderHook(() => useSubscriptionEntitlements());

    expect(result.current.canWrite).toBe(true);
    expect(result.current.canMutate).toBe(true);
    expect(result.current.canUseModule('patients')).toBe(true);
    expect(result.current.safeMode).toBe(false);
  });
});
