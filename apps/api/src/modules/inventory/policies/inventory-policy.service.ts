import { Injectable } from '@nestjs/common';

interface InventoryUser {
  id?: string;
  userId?: string;
  sub?: string;
  roles?: string[];
}

/** Roles with any api.inventory access per permission matrix. */
const INVENTORY_ACCESS_ROLES = new Set([
  'super_admin',
  'owner',
  'general_manager',
  'branch_manager',
  'inventory_manager',
  'assistant',
  'accountant',
  'doctor',
  'dentist',
  'specialist',
  'receptionist',
]);

@Injectable()
export class InventoryPolicyService {
  canAccess(user: unknown | null, _request: unknown): boolean {
    if (!user || typeof user !== 'object') return false;
    const payload = user as InventoryUser;
    const id = payload.userId ?? payload.sub ?? payload.id;
    if (!id) return false;
    const roles = Array.isArray(payload.roles) ? payload.roles : [];
    if (roles.includes('super_admin')) return true;
    return roles.some((role) => INVENTORY_ACCESS_ROLES.has(role));
  }
}
