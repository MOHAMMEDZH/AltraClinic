/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { fulfillStockRequestLine } from '../api/inventory-api';
import { useFulfillStockRequestLine } from './useInventory';

const CURRENT = '11111111-2222-4333-8444-555555555555';
const OTHER = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

vi.mock('@/app/providers/AuthProvider', () => ({
  useAuth: () => ({
    user: { userId: CURRENT, tenantId: 'tenant-1', roles: ['inventory_manager'] },
    getValidAccessToken: async () => 'token',
  }),
}));

vi.mock('../api/inventory-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/inventory-api')>();
  return {
    ...actual,
    fulfillStockRequestLine: vi.fn(),
  };
});

const fulfillMock = vi.mocked(fulfillStockRequestLine);

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useFulfillStockRequestLine', () => {
  afterEach(() => {
    fulfillMock.mockReset();
  });

  it('forwards explicit usedByUserId and does not substitute the auth user', async () => {
    fulfillMock.mockResolvedValue({ requestId: 'req-1', lines: [] } as never);
    const { result } = renderHook(() => useFulfillStockRequestLine(), { wrapper });
    await result.current.mutateAsync({
      lineId: 'line-1',
      quantity: 3,
      usedByUserId: OTHER,
      notes: 'ward',
    });
    expect(fulfillMock).toHaveBeenCalledTimes(1);
    expect(fulfillMock).toHaveBeenCalledWith('token', 'tenant-1', 'line-1', {
      quantity: 3,
      usedByUserId: OTHER,
      notes: 'ward',
    });
    expect(fulfillMock.mock.calls[0][3].usedByUserId).not.toBe(CURRENT);
  });

  it('can send the current user only when the caller supplied that UUID', async () => {
    fulfillMock.mockResolvedValue({ requestId: 'req-1', lines: [] } as never);
    const { result } = renderHook(() => useFulfillStockRequestLine(), { wrapper });
    await result.current.mutateAsync({
      lineId: 'line-1',
      quantity: 1,
      usedByUserId: CURRENT,
    });
    expect(fulfillMock.mock.calls[0][3]).toEqual({
      quantity: 1,
      usedByUserId: CURRENT,
      notes: undefined,
    });
  });
});
