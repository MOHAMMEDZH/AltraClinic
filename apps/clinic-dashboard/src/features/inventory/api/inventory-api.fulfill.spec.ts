import { afterEach, describe, expect, it, vi } from 'vitest';
import { fulfillStockRequestLine } from './inventory-api';

const SELECTED = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const CURRENT = '11111111-2222-4333-8444-555555555555';

describe('fulfillStockRequestLine request serialization', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function mockOkFetch() {
    const payload = {
      requestId: 'req-1',
      requestNumber: 'SR-1',
      requestType: 'DEPARTMENT',
      status: 'FULFILLED',
      metrics: {},
      lines: [],
      requestedBy: CURRENT,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => JSON.stringify(payload),
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('POSTs { quantity, usedByUserId } and optional notes — never injects current user', async () => {
    const fetchMock = mockOkFetch();
    await fulfillStockRequestLine('token', 'tenant-1', 'line-1', {
      quantity: 3,
      usedByUserId: SELECTED,
      notes: 'ward A',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).toEqual({
      quantity: 3,
      usedByUserId: SELECTED,
      notes: 'ward A',
    });
    expect(body.usedByUserId).not.toBe(CURRENT);
    expect(body).not.toHaveProperty('recordedByUserId');
    expect(body).not.toHaveProperty('fulfilledBy');
  });

  it('sends a distinct selected user when it differs from the current user', async () => {
    const fetchMock = mockOkFetch();
    await fulfillStockRequestLine('token', 'tenant-1', 'line-1', {
      quantity: 1,
      usedByUserId: SELECTED,
    });
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.usedByUserId).toBe(SELECTED);
    expect(body.usedByUserId).not.toBe(CURRENT);
  });

  it('sends the current user only when that UUID was explicitly passed', async () => {
    const fetchMock = mockOkFetch();
    await fulfillStockRequestLine('token', 'tenant-1', 'line-1', {
      quantity: 2,
      usedByUserId: CURRENT,
    });
    const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
    expect(body.usedByUserId).toBe(CURRENT);
    expect(body.quantity).toBe(2);
    expect(body).not.toHaveProperty('notes');
  });

  it('does not send an empty usedByUserId string', async () => {
    const fetchMock = mockOkFetch();
    await expect(
      fulfillStockRequestLine('token', 'tenant-1', 'line-1', {
        quantity: 1,
        usedByUserId: '',
      }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
