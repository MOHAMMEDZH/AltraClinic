/**
 * Phase 45a — registration / catalog contracts (metadata only).
 */

export const OBSERVABILITY_LOCAL_EXTENSION_KIND = 'observability' as const;

export type ObservabilityRegistrationKind =
  | 'healthContributor'
  | 'metricsContributor'
  | 'storageAdapter'
  | 'exportAdapter'
  | 'signalDomain';

export type ObservabilityRegistrationStatus =
  | 'disabled'
  | 'inactive'
  | 'active'
  | 'deprecated';

export type ObservabilityRequiredLicense = 'allowObservability';

export interface ObservabilityRegistrationMetadata {
  typeId: string;
  displayName: string;
  category: string;
  ownerModule: string;
  registrationKind: ObservabilityRegistrationKind;
  status: ObservabilityRegistrationStatus;
  requiredLicense: ObservabilityRequiredLicense;
  featureFlag: string | null;
  version: string;
  adapterAttached: boolean;
  executable: boolean;
}

export interface EffectiveObservabilityType {
  typeId: string;
  displayName: string;
  category: string;
  ownerModule: string;
  registrationKind: ObservabilityRegistrationKind;
  status: ObservabilityRegistrationStatus;
  version: string;
  featureFlag: string | null;
  adapterAttached: boolean;
  executable: boolean;
  visible: true;
}
