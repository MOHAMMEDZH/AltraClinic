export const PLATFORM_TENANT_STATUSES = [
  'PROVISIONING',
  'ACTIVE',
  'SUSPENDED',
  'ARCHIVED',
] as const;

export type PlatformTenantLifecycleStatus = (typeof PLATFORM_TENANT_STATUSES)[number];

export type LifecycleAction =
  | 'activate'
  | 'suspend'
  | 'reactivate'
  | 'archive_request'
  | 'deletion_request';

export type LifecycleRequestType = 'ARCHIVE' | 'DELETE';

export type LifecycleRequestStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'APPROVED_HANDOFF'
  | 'EXECUTED';

export class TenantLifecycleError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus: number = 400,
  ) {
    super(message);
    this.name = 'TenantLifecycleError';
  }
}

/** Allowed immediate status transitions for mutation commands (not requests). */
export const STATUS_COMMAND_MATRIX: Record<
  PlatformTenantLifecycleStatus,
  Partial<Record<'activate' | 'suspend' | 'reactivate', PlatformTenantLifecycleStatus>>
> = {
  PROVISIONING: { activate: 'ACTIVE' },
  ACTIVE: { suspend: 'SUSPENDED' },
  SUSPENDED: { reactivate: 'ACTIVE' },
  ARCHIVED: {},
};

export function assertTransition(
  from: PlatformTenantLifecycleStatus,
  action: 'activate' | 'suspend' | 'reactivate',
): PlatformTenantLifecycleStatus {
  const next = STATUS_COMMAND_MATRIX[from]?.[action];
  if (!next) {
    throw new TenantLifecycleError(
      'invalid_lifecycle_transition',
      `Action ${action} is not allowed from status ${from}.`,
      409,
    );
  }
  return next;
}

/** Test-only failure injection env — never registered in production. */
export const LIFECYCLE_FAILURE_INJECTION_ENV = 'TENANT_LIFECYCLE_TEST_FAILURE_POINT';
