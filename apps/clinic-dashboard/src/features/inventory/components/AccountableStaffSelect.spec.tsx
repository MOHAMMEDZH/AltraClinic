/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AccountableStaffSelect } from './AccountableStaffSelect';

const useAuth = vi.fn();
const useUsers = vi.fn();

vi.mock('@/app/providers/AuthProvider', () => ({
  useAuth: () => useAuth(),
}));

vi.mock('@/features/user-management/hooks/useUserManagement', () => ({
  useUsers: (...args: unknown[]) => useUsers(...args),
}));

vi.mock('@booking/i18n/react', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: 'en-US',
    direction: 'ltr',
  }),
}));

const CURRENT = '11111111-2222-4333-8444-555555555555';
const OTHER = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

function renderSelect(value: string, onChange = vi.fn(), error: string | null = null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    onChange,
    ...render(
      <QueryClientProvider client={client}>
        <AccountableStaffSelect value={value} onChange={onChange} error={error} />
      </QueryClientProvider>,
    ),
  };
}

describe('AccountableStaffSelect', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({
      user: {
        userId: CURRENT,
        tenantId: 'tenant-1',
        roles: ['inventory_manager'],
        email: 'inventory@demo.clinic',
        firstName: 'Inv',
        lastName: 'Manager',
      },
    });
    useUsers.mockReturnValue({ data: { items: [] } });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('starts empty and does not auto-select the current user', () => {
    renderSelect('');
    const select = screen.getByLabelText('inventory.stockRequests.accountableStaff') as HTMLSelectElement;
    expect(select.value).toBe('');
    expect(select.required).toBe(true);
  });

  it('emits the selected UUID, including the current user only after explicit choice', () => {
    const { onChange } = renderSelect('');
    const select = screen.getByLabelText('inventory.stockRequests.accountableStaff');
    fireEvent.change(select, { target: { value: CURRENT } });
    expect(onChange).toHaveBeenCalledWith(CURRENT);
  });

  it('lists directory staff when identity view is available and emits that UUID', () => {
    useAuth.mockReturnValue({
      user: {
        userId: CURRENT,
        tenantId: 'tenant-1',
        roles: ['owner'],
        email: 'owner@demo.clinic',
        firstName: 'Owner',
        lastName: 'Demo',
      },
    });
    useUsers.mockReturnValue({
      data: {
        items: [{ id: OTHER, fullName: 'Dr Other', email: 'doctor@demo.clinic' }],
      },
    });
    const { onChange } = renderSelect('');
    expect(useUsers).toHaveBeenCalledWith({ status: 'active', limit: 200 }, true);
    const select = screen.getByLabelText('inventory.stockRequests.accountableStaff') as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).toContain(OTHER);
    fireEvent.change(select, { target: { value: OTHER } });
    expect(onChange).toHaveBeenCalledWith(OTHER);
    expect(onChange.mock.calls[0][0]).not.toBe(CURRENT);
  });

  it('does not query identity users for inventory_manager', () => {
    renderSelect('');
    expect(useUsers).toHaveBeenCalledWith({ status: 'active', limit: 200 }, false);
  });

  it('shows the required validation error when provided', () => {
    renderSelect('', vi.fn(), 'inventory.stockRequests.accountableStaffRequired');
    expect(screen.getByRole('alert').textContent).toBe(
      'inventory.stockRequests.accountableStaffRequired',
    );
  });
});
