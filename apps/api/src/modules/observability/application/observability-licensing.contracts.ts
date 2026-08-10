/**
 * Phase 45a — Licensing capability registry only.
 * Consumes TenantPolicyService.allowObservability; no SKU engine redesign.
 */
import {
  OBSERVABILITY_LICENSE_CAPABILITIES,
  OBSERVABILITY_TENANT_LICENSE_GATE,
} from '../observability.constants';

export type ObservabilityLicenseCapability =
  (typeof OBSERVABILITY_LICENSE_CAPABILITIES)[number];

export class ObservabilityLicensingContracts {
  readonly tenantGate = OBSERVABILITY_TENANT_LICENSE_GATE;
  readonly capabilities: readonly ObservabilityLicenseCapability[] =
    OBSERVABILITY_LICENSE_CAPABILITIES;

  listCapabilities(): readonly ObservabilityLicenseCapability[] {
    return this.capabilities;
  }

  getTenantLicenseGate(): typeof OBSERVABILITY_TENANT_LICENSE_GATE {
    return this.tenantGate;
  }
}
