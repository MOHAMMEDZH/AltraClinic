import { Injectable } from '@nestjs/common';

interface LoyaltyUser {
  id: string;
  roles?: string[];
  tenantId?: string;
}

interface PolicyRequest {
  method?: string;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
}

interface OwnershipCheck {
  findAccountById(accountId: string, tenantId: string): Promise<{ patientId: string } | null>;
}
@Injectable()
export class LoyaltyPolicyService {
  private readonly allowedRoles = new Set(['admin', 'patient', 'tenant_admin']);

  async canAccess(
    user: unknown | null,
    request: PolicyRequest,
    tenantId?: string,
    ownership?: OwnershipCheck,
  ): Promise<boolean> {
    if (!user || typeof user !== 'object') return false;
    const payload = user as LoyaltyUser;
    if (!payload.id) return false;
    const userTenantId = payload.tenantId?.trim();
    if (!userTenantId || !tenantId?.trim() || userTenantId !== tenantId.trim()) {
      return false;
    }

    const roles = Array.isArray(payload.roles) ? payload.roles : [];
    return roles.some((role) => this.allowedRoles.has(role));
  }
}
