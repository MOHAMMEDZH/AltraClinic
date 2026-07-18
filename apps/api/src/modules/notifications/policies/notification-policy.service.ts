import { Injectable } from '@nestjs/common';

interface NotificationUser {
  id?: string;
  sub?: string;
  roles?: string[];
  tenantId?: string;
}

@Injectable()
export class NotificationPolicyService {
  private readonly allowedRoles = new Set([
    'admin',
    'tenant_admin',
    'super_admin',
    'owner',
    'general_manager',
    'branch_manager',
    'accountant',
    'receptionist',
    'assistant',
    'provider',
    'staff',
    'doctor',
    'dentist',
    'nurse',
    'specialist',
    'inventory_manager',
    'patient',
  ]);

  async canAccess(user: unknown | null, tenantId?: string): Promise<boolean> {
    if (!user || typeof user !== 'object') return false;
    const payload = user as NotificationUser;
    const userId = String(payload.id ?? payload.sub ?? '').trim();
    if (!userId) return false;

    const userTenantId = payload.tenantId?.trim();
    if (!userTenantId || !tenantId?.trim() || userTenantId !== tenantId.trim()) {
      return false;
    }

    const roles = Array.isArray(payload.roles) ? payload.roles : [];
    return roles.some((role) => this.allowedRoles.has(role));
  }
}
