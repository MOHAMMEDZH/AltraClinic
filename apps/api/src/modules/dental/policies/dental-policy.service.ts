import { Injectable } from '@nestjs/common';

@Injectable()
export class DentalPolicyService {
  canViewChart(user: { id: string; roles?: string[] }, tenantId: string): boolean {
    // placeholder: implement RBAC rules per UI_SYSTEM and SECURITY.md
    return true;
  }

  canCreateTreatment(user: { id: string; roles?: string[] }, tenantId: string): boolean {
    return true;
  }
}
