/**
 * Phase 44a — Licensing capability registry only.
 * Consumes TenantPolicyService.allowIntegrations; no SKU engine redesign.
 */
import {
  INTEGRATIONS_LICENSE_CAPABILITIES,
  INTEGRATIONS_TENANT_LICENSE_GATE,
} from '../integrations.constants';

export type IntegrationsLicenseCapability =
  (typeof INTEGRATIONS_LICENSE_CAPABILITIES)[number];

export class IntegrationsLicensingContracts {
  readonly tenantGate = INTEGRATIONS_TENANT_LICENSE_GATE;
  readonly capabilities: readonly IntegrationsLicenseCapability[] =
    INTEGRATIONS_LICENSE_CAPABILITIES;

  listCapabilities(): readonly IntegrationsLicenseCapability[] {
    return this.capabilities;
  }

  getTenantLicenseGate(): typeof INTEGRATIONS_TENANT_LICENSE_GATE {
    return this.tenantGate;
  }
}
