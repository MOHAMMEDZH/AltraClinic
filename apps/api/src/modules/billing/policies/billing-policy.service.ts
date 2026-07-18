import { Injectable } from '@nestjs/common';
import { rolesCanAccessResourceAnyAction } from '../../../common/authorization/permission-matrix.util';

interface BillingUser {
  id: string;
  roles?: string[];
}

@Injectable()
export class BillingPolicyService {
  canAccess(user: unknown | null, _request: unknown): boolean {
    if (!user || typeof user !== 'object') return false;
    const payload = user as BillingUser;
    if (!payload.id) return false;
    const roles = Array.isArray(payload.roles) ? payload.roles : [];
    return rolesCanAccessResourceAnyAction(roles, 'api.billing');
  }
}
