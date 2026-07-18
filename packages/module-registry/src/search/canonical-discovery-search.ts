import type { LicensedModuleId } from '../types';

/**
 * Queue search strategy (Phase 32a decision B):
 * Queue is explicitly EXCLUDED from global clinical search.
 * No backend SearchEntityType exists for queue tickets; adding one would require API changes (Phase 32b+).
 * Queue module navigation remains available via routing/navigation contributions only.
 */
export const QUEUE_SEARCH_STRATEGY = 'excluded' as const;

export interface CanonicalDiscoverySearchEntity {
  /** Discovery key — NOT a SearchEntityType and never sent to GET /search types param */
  discoveryKey: string;
  moduleId: LicensedModuleId;
  localId: string;
  labelKey: string;
  resourceId: string;
  deepLinkTemplate: string;
  backendProviderKey: string;
  sortOrder: number;
  searchScope: 'discovery';
  deprecatedAliases?: string[];
}

export const CANONICAL_DISCOVERY_SEARCH_ENTITIES: readonly CanonicalDiscoverySearchEntity[] = [
  {
    discoveryKey: 'dashboard',
    moduleId: 'dashboard',
    localId: 'dashboard',
    labelKey: 'modules.dashboard.search',
    resourceId: 'api.identity',
    deepLinkTemplate: '/?q={query}',
    backendProviderKey: 'search.dashboard',
    sortOrder: 0,
    searchScope: 'discovery',
  },
  {
    discoveryKey: 'analytics-metric',
    moduleId: 'analytics',
    localId: 'analytics-metric',
    labelKey: 'modules.analytics.search',
    resourceId: 'api.analytics',
    deepLinkTemplate: '/analytics?q={query}',
    backendProviderKey: 'search.analytics',
    sortOrder: 10,
    searchScope: 'discovery',
    deprecatedAliases: ['analyticsMetric'],
  },
  {
    discoveryKey: 'ai-prompt',
    moduleId: 'ai',
    localId: 'ai-prompt',
    labelKey: 'modules.ai.search',
    resourceId: 'api.ai',
    deepLinkTemplate: '/ai?q={query}',
    backendProviderKey: 'search.ai',
    sortOrder: 20,
    searchScope: 'discovery',
    deprecatedAliases: ['aiPrompt'],
  },
  {
    discoveryKey: 'setting',
    moduleId: 'settings',
    localId: 'setting',
    labelKey: 'modules.settings.search',
    resourceId: 'api.settings',
    deepLinkTemplate: '/settings?q={query}',
    backendProviderKey: 'search.settings',
    sortOrder: 30,
    searchScope: 'discovery',
  },
  {
    discoveryKey: 'global',
    moduleId: 'search',
    localId: 'global',
    labelKey: 'modules.search.global',
    resourceId: 'api.search',
    deepLinkTemplate: '/search?q={query}',
    backendProviderKey: 'search.global',
    sortOrder: 40,
    searchScope: 'discovery',
  },
  {
    discoveryKey: 'portal-appointment',
    moduleId: 'patientPortal',
    localId: 'portal-appointment',
    labelKey: 'modules.patientPortal.search',
    resourceId: 'api.patient_portal',
    deepLinkTemplate: '/my-appointments/{id}',
    backendProviderKey: 'search.patientPortal',
    sortOrder: 50,
    searchScope: 'discovery',
    deprecatedAliases: ['portalAppointment'],
  },
  {
    discoveryKey: 'media-asset',
    moduleId: 'media',
    localId: 'media-asset',
    labelKey: 'modules.media.search',
    resourceId: 'api.media',
    deepLinkTemplate: '/media/{id}',
    backendProviderKey: 'search.media',
    sortOrder: 60,
    searchScope: 'discovery',
    deprecatedAliases: ['mediaAsset'],
  },
  {
    discoveryKey: 'commission-rule',
    moduleId: 'commission',
    localId: 'commission-rule',
    labelKey: 'modules.commission.search',
    resourceId: 'api.commission',
    deepLinkTemplate: '/billing/commission/{id}',
    backendProviderKey: 'search.commission',
    sortOrder: 70,
    searchScope: 'discovery',
    deprecatedAliases: ['commissionRule'],
  },
  {
    discoveryKey: 'loyalty-program',
    moduleId: 'loyalty',
    localId: 'loyalty-program',
    labelKey: 'modules.loyalty.search',
    resourceId: 'api.loyalty',
    deepLinkTemplate: '/billing/loyalty/{id}',
    backendProviderKey: 'search.loyalty',
    sortOrder: 80,
    searchScope: 'discovery',
    deprecatedAliases: ['loyaltyProgram'],
  },
] as const;

export const CANONICAL_DISCOVERY_SEARCH_ENTITY_COUNT = CANONICAL_DISCOVERY_SEARCH_ENTITIES.length;
