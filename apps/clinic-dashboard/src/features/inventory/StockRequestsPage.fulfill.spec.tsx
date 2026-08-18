/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ApiError } from '@/lib/api-client';
import { StockRequestsPage } from './StockRequestsPage';

const fulfillMutateAsync = vi.fn();
const useAuth = vi.fn();

vi.mock('@/app/providers/AuthProvider', () => ({
  useAuth: () => useAuth(),
}));

vi.mock('@booking/i18n/react', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: 'en-US',
    direction: 'ltr',
  }),
}));

vi.mock('@/features/patients/components/Modal', () => ({
  Modal: ({
    children,
    title,
    open,
  }: {
    children: ReactNode;
    title: string;
    open: boolean;
  }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    ) : null,
}));

vi.mock('@/features/user-management/hooks/useUserManagement', () => ({
  useUsers: () => ({
    data: {
      items: [
        {
          id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
          fullName: 'Dr Other',
          email: 'doctor@demo.clinic',
        },
      ],
    },
  }),
}));

vi.mock('./hooks/useInventory', () => ({
  useStockRequests: () => ({
    data: {
      requests: [
        {
          requestId: 'req-1',
          requestNumber: 'SR-DEMO-002',
          requestType: 'DEPARTMENT',
          status: 'APPROVED',
          notes: null,
          rejectionReason: null,
          requestedBy: 'creator-1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metrics: { lineCount: 1, fulfilledLineCount: 0, totalRequested: 3, totalFulfilled: 0 },
          lines: [
            {
              lineId: 'line-1',
              itemId: 'item-1',
              sku: 'SKU-1',
              itemName: 'Gloves',
              unit: 'box',
              quantityRequested: 3,
              quantityFulfilled: 0,
              quantityRemaining: 3,
              notes: null,
            },
          ],
        },
      ],
      total: 1,
      limit: 20,
    },
    isLoading: false,
    refetch: vi.fn(),
  }),
  useInventoryItems: () => ({ data: { items: [] } }),
  useCreateStockRequest: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSubmitStockRequest: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useApproveStockRequest: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRejectStockRequest: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCancelStockRequest: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useFulfillStockRequestLine: () => ({ mutateAsync: fulfillMutateAsync, isPending: false }),
  useConvertStockRequestToPo: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useInventorySuppliersList: () => ({ data: [] }),
}));

const CURRENT = '11111111-2222-4333-8444-555555555555';
const OTHER = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

const fulfilledRequest = {
  requestId: 'req-1',
  requestNumber: 'SR-DEMO-002',
  requestType: 'DEPARTMENT',
  status: 'FULFILLED',
  notes: null,
  requestedBy: 'creator-1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  metrics: { lineCount: 1 },
  lines: [],
};

async function openDetail() {
  render(
    <MemoryRouter>
      <StockRequestsPage />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'inventory.stockRequests.view' }));
  await screen.findByLabelText('inventory.stockRequests.accountableStaff');
}

describe('StockRequestsPage fulfill accountability', () => {
  beforeEach(() => {
    fulfillMutateAsync.mockReset();
    fulfillMutateAsync.mockResolvedValue(fulfilledRequest);
    useAuth.mockReturnValue({
      user: {
        userId: CURRENT,
        tenantId: 'tenant-1',
        roles: ['owner'],
        email: 'owner@demo.clinic',
        firstName: 'Owner',
        lastName: 'Demo',
      },
      getValidAccessToken: async () => 'token',
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('blocks Issue stock when no accountable staff is selected', async () => {
    await openDetail();
    fireEvent.click(screen.getByRole('button', { name: 'inventory.stockRequests.fulfill' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'inventory.stockRequests.accountableStaffRequired',
    );
    expect(fulfillMutateAsync).not.toHaveBeenCalled();
  });

  it('sends the selected staff UUID, not the logged-in user, when they differ', async () => {
    await openDetail();
    fireEvent.change(screen.getByLabelText('inventory.stockRequests.accountableStaff'), {
      target: { value: OTHER },
    });
    fireEvent.click(screen.getByRole('button', { name: 'inventory.stockRequests.fulfill' }));
    await waitFor(() => expect(fulfillMutateAsync).toHaveBeenCalledTimes(1));
    expect(fulfillMutateAsync.mock.calls[0][0]).toEqual({
      lineId: 'line-1',
      quantity: 3,
      usedByUserId: OTHER,
    });
    expect(fulfillMutateAsync.mock.calls[0][0].usedByUserId).not.toBe(CURRENT);
  });

  it('sends the current user only after that option is explicitly selected', async () => {
    await openDetail();
    fireEvent.change(screen.getByLabelText('inventory.stockRequests.accountableStaff'), {
      target: { value: CURRENT },
    });
    fireEvent.click(screen.getByRole('button', { name: 'inventory.stockRequests.fulfill' }));
    await waitFor(() => expect(fulfillMutateAsync).toHaveBeenCalledTimes(1));
    expect(fulfillMutateAsync.mock.calls[0][0].usedByUserId).toBe(CURRENT);
  });

  it('preserves quantity from the line input', async () => {
    await openDetail();
    fireEvent.change(screen.getByLabelText('inventory.stockRequests.quantity'), {
      target: { value: '2' },
    });
    fireEvent.change(screen.getByLabelText('inventory.stockRequests.accountableStaff'), {
      target: { value: OTHER },
    });
    fireEvent.click(screen.getByRole('button', { name: 'inventory.stockRequests.fulfill' }));
    await waitFor(() => expect(fulfillMutateAsync).toHaveBeenCalledTimes(1));
    expect(fulfillMutateAsync.mock.calls[0][0].quantity).toBe(2);
    expect(fulfillMutateAsync.mock.calls[0][0].usedByUserId).toBe(OTHER);
  });

  it('maps API errors through the existing inventory error keys', async () => {
    fulfillMutateAsync.mockRejectedValueOnce(new ApiError('denied', 403));
    await openDetail();
    fireEvent.change(screen.getByLabelText('inventory.stockRequests.accountableStaff'), {
      target: { value: OTHER },
    });
    fireEvent.click(screen.getByRole('button', { name: 'inventory.stockRequests.fulfill' }));
    expect((await screen.findByText('inventory.errors.permissionDenied')).textContent).toBe(
      'inventory.errors.permissionDenied',
    );
  });
});
