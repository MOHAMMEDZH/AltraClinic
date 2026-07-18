import { ForbiddenException } from '@nestjs/common';

interface TenantScopedUser {
  tenantId?: unknown;
  branchId?: unknown;
}

interface TenantScopedRequest {
  headers?: Record<string, unknown>;
  user?: TenantScopedUser;
}

export interface TenantScope {
  tenantId: string;
  branchId?: string;
}

function normalizeHeaderValue(value: unknown): string {
  return String(value ?? '').trim();
}

export function requireTenantScope(request: TenantScopedRequest): TenantScope {
  const tenantId = normalizeHeaderValue(
    request.headers?.['x-tenant-id'] ?? request.headers?.['tenant-id'],
  );

  if (!tenantId) {
    throw new ForbiddenException('Tenant scope is required. Provide x-tenant-id header.');
  }

  const branchId = normalizeHeaderValue(
    request.headers?.['x-branch-id'] ?? request.headers?.['branch-id'],
  );

  const userTenantId = normalizeHeaderValue(request.user?.tenantId);
  if (userTenantId && userTenantId !== tenantId) {
    throw new ForbiddenException('Tenant mismatch between authenticated user and tenant header.');
  }

  const userBranchId = normalizeHeaderValue(request.user?.branchId);
  if (userBranchId && branchId && userBranchId !== branchId) {
    throw new ForbiddenException('Branch mismatch between authenticated user and branch header.');
  }

  return {
    tenantId,
    branchId: branchId || undefined,
  };
}
