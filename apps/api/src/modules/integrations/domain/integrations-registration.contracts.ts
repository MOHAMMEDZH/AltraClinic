/**
 * Phase 44a — registration / catalog contracts (metadata only).
 */

export const INTEGRATIONS_LOCAL_EXTENSION_KIND = 'integrations' as const;

export type IntegrationsRegistrationKind =
  | 'providerAdapter'
  | 'webhookDeliveryAdapter'
  | 'inboundReceiver'
  | 'secretStore'
  | 'authMiddleware';

export type IntegrationsRegistrationStatus =
  | 'disabled'
  | 'inactive'
  | 'active'
  | 'deprecated';

export type IntegrationsRequiredLicense = 'allowIntegrations';

export type IntegrationsMigrationStatus =
  | 'not_started'
  | 'dual_read'
  | 'complete';

export interface IntegrationsRegistrationMetadata {
  typeId: string;
  displayName: string;
  category: string;
  ownerModule: string;
  registrationKind: IntegrationsRegistrationKind;
  status: IntegrationsRegistrationStatus;
  requiredLicense: IntegrationsRequiredLicense;
  featureFlag: string | null;
  version: string;
  adapterAttached: boolean;
  executable: boolean;
}

export interface EffectiveIntegrationsType {
  typeId: string;
  displayName: string;
  category: string;
  ownerModule: string;
  registrationKind: IntegrationsRegistrationKind;
  status: IntegrationsRegistrationStatus;
  version: string;
  featureFlag: string | null;
  adapterAttached: boolean;
  executable: boolean;
  visible: true;
}

export interface ScopeCatalogEntry {
  scopeId: string;
  description: string;
  highRisk: boolean;
  /** Non-executable until Phase 44d. */
  executable: false;
}
