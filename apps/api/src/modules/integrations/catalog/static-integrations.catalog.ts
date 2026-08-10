/**
 * Phase 44a — static provider catalog baseline (parity only; never runtime authority).
 * All entries disabled / non-executable. No adapters.
 */
import type { IntegrationsRegistrationMetadata } from '../domain/integrations-registration.contracts';
import { API_KEYS_INTEGRATIONS_CENTER_ENABLED_ENV } from '../integrations.constants';

export const STATIC_INTEGRATIONS_CATALOG: readonly IntegrationsRegistrationMetadata[] =
  [
    {
      typeId: 'custom.http',
      displayName: 'Custom HTTP webhook',
      category: 'webhook',
      ownerModule: 'platform',
      registrationKind: 'webhookDeliveryAdapter',
      status: 'disabled',
      requiredLicense: 'allowIntegrations',
      featureFlag: API_KEYS_INTEGRATIONS_CENTER_ENABLED_ENV,
      version: '44a.0',
      adapterAttached: false,
      executable: false,
    },
    {
      typeId: 'payment.generic',
      displayName: 'Payment provider (generic)',
      category: 'payment',
      ownerModule: 'billing',
      registrationKind: 'providerAdapter',
      status: 'disabled',
      requiredLicense: 'allowIntegrations',
      featureFlag: API_KEYS_INTEGRATIONS_CENTER_ENABLED_ENV,
      version: '44a.0',
      adapterAttached: false,
      executable: false,
    },
    {
      typeId: 'accounting.generic',
      displayName: 'Accounting provider (generic)',
      category: 'accounting',
      ownerModule: 'billing',
      registrationKind: 'providerAdapter',
      status: 'inactive',
      requiredLicense: 'allowIntegrations',
      featureFlag: API_KEYS_INTEGRATIONS_CENTER_ENABLED_ENV,
      version: '44a.0',
      adapterAttached: false,
      executable: false,
    },
    {
      typeId: 'calendar.generic',
      displayName: 'Calendar provider (generic)',
      category: 'calendar',
      ownerModule: 'scheduling',
      registrationKind: 'providerAdapter',
      status: 'inactive',
      requiredLicense: 'allowIntegrations',
      featureFlag: API_KEYS_INTEGRATIONS_CENTER_ENABLED_ENV,
      version: '44a.0',
      adapterAttached: false,
      executable: false,
    },
    {
      typeId: 'inbound.generic',
      displayName: 'Inbound webhook receiver (generic)',
      category: 'inbound',
      ownerModule: 'platform',
      registrationKind: 'inboundReceiver',
      status: 'disabled',
      requiredLicense: 'allowIntegrations',
      featureFlag: API_KEYS_INTEGRATIONS_CENTER_ENABLED_ENV,
      version: '44a.0',
      adapterAttached: false,
      executable: false,
    },
  ] as const;

/** Explicit: static catalog is never runtime authority. */
export const STATIC_INTEGRATIONS_CATALOG_IS_RUNTIME_AUTHORITY = false;
