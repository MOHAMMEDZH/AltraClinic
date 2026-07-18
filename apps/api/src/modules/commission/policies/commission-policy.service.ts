import { Injectable } from '@nestjs/common';

interface CommissionUser {
  id: string;
  roles?: string[];
}

@Injectable()
export class CommissionPolicyService {
  private readonly allowedRoles = new Set([
    'admin',
    'finance_manager',
    'payroll_manager',
    'billing_manager',
    'tenant_admin',
    'accountant',
  ]);

  canAccess(user: unknown | null, _request: unknown): boolean {
    if (!user || typeof user !== 'object') return false;
    const payload = user as CommissionUser;
    if (!payload.id) return false;
    const roles = Array.isArray(payload.roles) ? payload.roles : [];
    return roles.some((role) => this.allowedRoles.has(role));
  }
}