import {
  STATUS_COMMAND_MATRIX,
  assertTransition,
  TenantLifecycleError,
} from '../domain/tenant-lifecycle.types';

describe('Step 19 lifecycle transition matrix (foundation)', () => {
  it('allows activate only from PROVISIONING', () => {
    expect(assertTransition('PROVISIONING', 'activate')).toBe('ACTIVE');
    expect(() => assertTransition('ACTIVE', 'activate')).toThrow(TenantLifecycleError);
    expect(() => assertTransition('SUSPENDED', 'activate')).toThrow(TenantLifecycleError);
  });

  it('allows suspend only from ACTIVE', () => {
    expect(assertTransition('ACTIVE', 'suspend')).toBe('SUSPENDED');
    expect(() => assertTransition('SUSPENDED', 'suspend')).toThrow(TenantLifecycleError);
  });

  it('allows reactivate only from SUSPENDED', () => {
    expect(assertTransition('SUSPENDED', 'reactivate')).toBe('ACTIVE');
    expect(() => assertTransition('ACTIVE', 'reactivate')).toThrow(TenantLifecycleError);
    expect(() => assertTransition('ARCHIVED', 'reactivate')).toThrow(TenantLifecycleError);
  });

  it('ARCHIVED has no immediate status commands', () => {
    expect(STATUS_COMMAND_MATRIX.ARCHIVED).toEqual({});
  });
});
