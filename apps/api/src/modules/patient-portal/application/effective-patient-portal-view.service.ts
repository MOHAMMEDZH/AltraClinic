import { Injectable } from '@nestjs/common';
import { TenantPolicyService } from '../../settings/application/services/tenant-policy.service';
import { isPatientPortalCenterEnabled } from '../config/patient-portal-config';
import {
  PATIENT_PORTAL_API_NAMESPACE,
  PATIENT_PORTAL_PERMISSION_RESOURCE,
} from '../patient-portal.constants';

export interface EffectivePatientPortalViewInput {
  tenantId?: string;
  branchId?: string | null;
  roles?: readonly string[];
  hasReadPermission?: boolean;
}

export interface EffectivePatientPortalView {
  tenantId: string | null;
  branchId: string | null;
  apiNamespace: typeof PATIENT_PORTAL_API_NAMESPACE;
  permissionResource: typeof PATIENT_PORTAL_PERMISSION_RESOURCE;
  featureEnabled: boolean;
  allowPatientPortal: boolean;
  visible: boolean;
  dormant: boolean;
  meta: {
    phase: '46a';
    productSurfacesLive: false;
  };
}

/**
 * Phase 46a — dormant effective view.
 * Product surfaces are never live in 46a regardless of flags.
 */
@Injectable()
export class EffectivePatientPortalViewService {
  constructor(private readonly tenantPolicy: TenantPolicyService) {}

  async resolve(
    input: EffectivePatientPortalViewInput = {},
  ): Promise<EffectivePatientPortalView> {
    const featureEnabled = isPatientPortalCenterEnabled();
    const tenantId = input.tenantId ?? null;
    let allowPatientPortal = false;
    if (tenantId) {
      const policy = await this.tenantPolicy.getAdvancedPolicy(tenantId);
      allowPatientPortal = policy.allowPatientPortal;
    }

    const hasRead = input.hasReadPermission === true;
    const visible = featureEnabled && allowPatientPortal && hasRead;

    return {
      tenantId,
      branchId: input.branchId ?? null,
      apiNamespace: PATIENT_PORTAL_API_NAMESPACE,
      permissionResource: PATIENT_PORTAL_PERMISSION_RESOURCE,
      featureEnabled,
      allowPatientPortal,
      visible,
      dormant: !featureEnabled,
      meta: {
        phase: '46a',
        productSurfacesLive: false,
      },
    };
  }
}
