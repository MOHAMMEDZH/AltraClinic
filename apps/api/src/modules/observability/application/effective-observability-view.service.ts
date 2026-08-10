import { Injectable } from '@nestjs/common';
import { TenantPolicyService } from '../../settings/application/services/tenant-policy.service';
import { ObservabilityExtensionRegistry } from './observability-extension.registry';
import { isSystemMonitoringObservabilityEnabled } from '../config/observability-config';
import { STATIC_OBSERVABILITY_CATALOG } from '../catalog/static-observability.catalog';
import type { EffectiveObservabilityType } from '../domain/observability-registration.contracts';
import { OBSERVABILITY_EXTENSION_KIND } from '../observability.constants';

export interface EffectiveObservabilityViewInput {
  tenantId?: string;
  branchId?: string | null;
  roles?: readonly string[];
  hasReadPermission?: boolean;
}

export interface EffectiveObservabilityView {
  tenantId: string | null;
  branchId: string | null;
  extensionKind: typeof OBSERVABILITY_EXTENSION_KIND;
  featureEnabled: boolean;
  allowObservability: boolean;
  visible: boolean;
  types: readonly EffectiveObservabilityType[];
  meta: {
    catalogCount: number;
    executableCount: number;
    staticCatalogIsRuntimeAuthority: false;
  };
}

/**
 * Phase 45a — dormant effective view.
 * Returns empty visible types; static catalog is never authority.
 */
@Injectable()
export class EffectiveObservabilityViewService {
  constructor(
    private readonly extensions: ObservabilityExtensionRegistry,
    private readonly tenantPolicy: TenantPolicyService,
  ) {}

  async resolve(
    input: EffectiveObservabilityViewInput = {},
  ): Promise<EffectiveObservabilityView> {
    const featureEnabled = isSystemMonitoringObservabilityEnabled();
    const tenantId = input.tenantId ?? null;
    let allowObservability = false;
    if (tenantId) {
      const policy = await this.tenantPolicy.getAdvancedPolicy(tenantId);
      allowObservability = policy.allowObservability;
    }

    const hasRead = input.hasReadPermission === true;
    const visible = featureEnabled && allowObservability && hasRead;

    return {
      tenantId,
      branchId: input.branchId ?? null,
      extensionKind: this.extensions.getExtensionKind(),
      featureEnabled,
      allowObservability,
      visible,
      types: [],
      meta: {
        catalogCount: STATIC_OBSERVABILITY_CATALOG.length,
        executableCount: 0,
        staticCatalogIsRuntimeAuthority: false,
      },
    };
  }
}
