import type { LicensedModuleId } from '../types';

/**
 * Canonical executable search entity vocabulary — single source of truth for Phase 32.
 * Count: 26 built-in types (aligned with apps/api search.types.ts SearchEntityType).
 * Queue is intentionally excluded — see QUEUE_SEARCH_STRATEGY in canonical-discovery-search.ts.
 */
export const CANONICAL_SEARCH_ENTITY_TYPES = [
  'user',
  'patient',
  'appointment',
  'diagnosis',
  'treatment',
  'invoice',
  'inventory',
  'report',
  'lab_result',
  'care_plan',
  'note_template',
  'problem',
  'encounter',
  'dental_plan',
  'dental_ortho',
  'dental_implant',
  'dental_note',
  'dental_image',
  'beauty_plan',
  'beauty_session',
  'beauty_consultation',
  'beauty_image',
  'notification',
  'workflow',
  'workflow_task',
  'workflow_template',
] as const;

export type CanonicalSearchEntityType = (typeof CANONICAL_SEARCH_ENTITY_TYPES)[number];

export const CANONICAL_EXECUTABLE_SEARCH_ENTITY_COUNT = CANONICAL_SEARCH_ENTITY_TYPES.length;

export type CanonicalSearchCategory =
  | 'clinical'
  | 'operations'
  | 'financial'
  | 'platform'
  | 'admin';

export interface CanonicalSearchEntity {
  entityType: CanonicalSearchEntityType;
  moduleId: LicensedModuleId;
  localId: string;
  labelKey: string;
  resourceId: string | string[];
  deepLinkTemplate: string;
  backendProviderKey: string;
  sortOrder: number;
  category: CanonicalSearchCategory;
  searchScope: 'executable';
  deprecatedAliases?: string[];
}

function resources(...ids: string[]): string | string[] {
  return ids.length === 1 ? ids[0]! : ids;
}

export const CANONICAL_SEARCH_ENTITIES: readonly CanonicalSearchEntity[] = [
  {
    entityType: 'user',
    moduleId: 'userManagement',
    localId: 'user',
    labelKey: 'modules.userManagement.search',
    resourceId: 'api.identity',
    deepLinkTemplate: '/settings/users/{id}',
    backendProviderKey: 'search.userManagement',
    sortOrder: 10,
    category: 'admin',
    searchScope: 'executable',
  },
  {
    entityType: 'patient',
    moduleId: 'patients',
    localId: 'patient',
    labelKey: 'modules.patients.search',
    resourceId: 'api.patients',
    deepLinkTemplate: '/patients/{id}',
    backendProviderKey: 'search.patients',
    sortOrder: 20,
    category: 'clinical',
    searchScope: 'executable',
  },
  {
    entityType: 'appointment',
    moduleId: 'scheduling',
    localId: 'appointment',
    labelKey: 'modules.scheduling.search',
    resourceId: 'api.scheduling',
    deepLinkTemplate: '/scheduling/appointments/{id}',
    backendProviderKey: 'search.scheduling',
    sortOrder: 30,
    category: 'operations',
    searchScope: 'executable',
  },
  {
    entityType: 'encounter',
    moduleId: 'emr',
    localId: 'encounter',
    labelKey: 'modules.emr.search.encounter',
    resourceId: 'api.emr',
    deepLinkTemplate: '/encounters/{id}',
    backendProviderKey: 'search.emr',
    sortOrder: 40,
    category: 'clinical',
    searchScope: 'executable',
  },
  {
    entityType: 'diagnosis',
    moduleId: 'emr',
    localId: 'diagnosis',
    labelKey: 'modules.emr.search.diagnosis',
    resourceId: 'api.emr',
    deepLinkTemplate: '/emr/encounters/{id}',
    backendProviderKey: 'search.emr',
    sortOrder: 41,
    category: 'clinical',
    searchScope: 'executable',
  },
  {
    entityType: 'lab_result',
    moduleId: 'emr',
    localId: 'lab-result',
    labelKey: 'modules.emr.search.labResult',
    resourceId: 'api.emr',
    deepLinkTemplate: '/emr/lab-results/{id}',
    backendProviderKey: 'search.emr',
    sortOrder: 42,
    category: 'clinical',
    searchScope: 'executable',
  },
  {
    entityType: 'care_plan',
    moduleId: 'emr',
    localId: 'care-plan',
    labelKey: 'modules.emr.search.carePlan',
    resourceId: 'api.emr',
    deepLinkTemplate: '/care-plans/{id}',
    backendProviderKey: 'search.emr',
    sortOrder: 43,
    category: 'clinical',
    searchScope: 'executable',
  },
  {
    entityType: 'note_template',
    moduleId: 'emr',
    localId: 'note-template',
    labelKey: 'modules.emr.search.noteTemplate',
    resourceId: 'api.emr',
    deepLinkTemplate: '/encounters',
    backendProviderKey: 'search.emr',
    sortOrder: 44,
    category: 'clinical',
    searchScope: 'executable',
  },
  {
    entityType: 'problem',
    moduleId: 'emr',
    localId: 'problem',
    labelKey: 'modules.emr.search.problem',
    resourceId: 'api.emr',
    deepLinkTemplate: '/patients/{id}',
    backendProviderKey: 'search.emr',
    sortOrder: 45,
    category: 'clinical',
    searchScope: 'executable',
  },
  {
    entityType: 'dental_plan',
    moduleId: 'dental',
    localId: 'dental-plan',
    labelKey: 'modules.dental.search.dentalPlan',
    resourceId: 'api.dental',
    deepLinkTemplate: '/dental/chart/{patientId}/plan/{planId}',
    backendProviderKey: 'search.dental',
    sortOrder: 50,
    category: 'clinical',
    searchScope: 'executable',
    deprecatedAliases: ['dentalRecord'],
  },
  {
    entityType: 'dental_ortho',
    moduleId: 'dental',
    localId: 'dental-ortho',
    labelKey: 'modules.dental.search.dentalOrtho',
    resourceId: 'api.dental',
    deepLinkTemplate: '/dental/chart/{patientId}?tab=ortho',
    backendProviderKey: 'search.dental',
    sortOrder: 51,
    category: 'clinical',
    searchScope: 'executable',
  },
  {
    entityType: 'dental_implant',
    moduleId: 'dental',
    localId: 'dental-implant',
    labelKey: 'modules.dental.search.dentalImplant',
    resourceId: 'api.dental',
    deepLinkTemplate: '/dental/chart/{patientId}?tab=implants',
    backendProviderKey: 'search.dental',
    sortOrder: 52,
    category: 'clinical',
    searchScope: 'executable',
  },
  {
    entityType: 'dental_note',
    moduleId: 'dental',
    localId: 'dental-note',
    labelKey: 'modules.dental.search.dentalNote',
    resourceId: 'api.dental',
    deepLinkTemplate: '/dental/chart/{patientId}?tab=notes',
    backendProviderKey: 'search.dental',
    sortOrder: 53,
    category: 'clinical',
    searchScope: 'executable',
  },
  {
    entityType: 'dental_image',
    moduleId: 'dental',
    localId: 'dental-image',
    labelKey: 'modules.dental.search.dentalImage',
    resourceId: 'api.media',
    deepLinkTemplate: '/dental/imaging/{patientId}',
    backendProviderKey: 'search.dental',
    sortOrder: 54,
    category: 'clinical',
    searchScope: 'executable',
  },
  {
    entityType: 'beauty_plan',
    moduleId: 'beauty',
    localId: 'beauty-plan',
    labelKey: 'modules.beauty.search.beautyPlan',
    resourceId: 'api.beauty',
    deepLinkTemplate: '/beauty/workspace/{patientId}?tab=plans',
    backendProviderKey: 'search.beauty',
    sortOrder: 60,
    category: 'clinical',
    searchScope: 'executable',
    deprecatedAliases: ['beautyRecord'],
  },
  {
    entityType: 'beauty_session',
    moduleId: 'beauty',
    localId: 'beauty-session',
    labelKey: 'modules.beauty.search.beautySession',
    resourceId: 'api.beauty',
    deepLinkTemplate: '/beauty/workspace/{patientId}?tab=sessions',
    backendProviderKey: 'search.beauty',
    sortOrder: 61,
    category: 'clinical',
    searchScope: 'executable',
  },
  {
    entityType: 'beauty_consultation',
    moduleId: 'beauty',
    localId: 'beauty-consultation',
    labelKey: 'modules.beauty.search.beautyConsultation',
    resourceId: 'api.beauty',
    deepLinkTemplate: '/beauty/workspace/{patientId}?tab=consultation',
    backendProviderKey: 'search.beauty',
    sortOrder: 62,
    category: 'clinical',
    searchScope: 'executable',
  },
  {
    entityType: 'beauty_image',
    moduleId: 'beauty',
    localId: 'beauty-image',
    labelKey: 'modules.beauty.search.beautyImage',
    resourceId: 'api.media',
    deepLinkTemplate: '/beauty/imaging/{patientId}',
    backendProviderKey: 'search.beauty',
    sortOrder: 63,
    category: 'clinical',
    searchScope: 'executable',
  },
  {
    entityType: 'treatment',
    moduleId: 'billing',
    localId: 'treatment',
    labelKey: 'modules.billing.search.treatment',
    resourceId: resources('api.dental', 'api.beauty'),
    deepLinkTemplate: '/treatments/{id}',
    backendProviderKey: 'search.billing',
    sortOrder: 70,
    category: 'financial',
    searchScope: 'executable',
  },
  {
    entityType: 'invoice',
    moduleId: 'billing',
    localId: 'invoice',
    labelKey: 'modules.billing.search',
    resourceId: 'api.billing',
    deepLinkTemplate: '/billing/invoices/{id}',
    backendProviderKey: 'search.billing',
    sortOrder: 71,
    category: 'financial',
    searchScope: 'executable',
  },
  {
    entityType: 'inventory',
    moduleId: 'inventory',
    localId: 'inventory',
    labelKey: 'modules.inventory.search',
    resourceId: 'api.inventory',
    deepLinkTemplate: '/inventory/item/{id}',
    backendProviderKey: 'search.inventory',
    sortOrder: 80,
    category: 'operations',
    searchScope: 'executable',
    deprecatedAliases: ['inventoryItem'],
  },
  {
    entityType: 'report',
    moduleId: 'reporting',
    localId: 'report',
    labelKey: 'modules.reporting.search',
    resourceId: 'api.reporting',
    deepLinkTemplate: '/reporting/reports/{id}',
    backendProviderKey: 'search.reporting',
    sortOrder: 90,
    category: 'platform',
    searchScope: 'executable',
  },
  {
    entityType: 'notification',
    moduleId: 'notifications',
    localId: 'notification',
    labelKey: 'modules.notifications.search',
    resourceId: 'api.notifications',
    deepLinkTemplate: '/settings/notifications/inbox/{id}',
    backendProviderKey: 'search.notifications',
    sortOrder: 100,
    category: 'platform',
    searchScope: 'executable',
  },
  {
    entityType: 'workflow',
    moduleId: 'workflow',
    localId: 'workflow',
    labelKey: 'modules.workflow.search.workflow',
    resourceId: 'api.workflow',
    deepLinkTemplate: '/workflows/instances/{id}',
    backendProviderKey: 'search.workflow',
    sortOrder: 110,
    category: 'operations',
    searchScope: 'executable',
  },
  {
    entityType: 'workflow_task',
    moduleId: 'workflow',
    localId: 'workflow-task',
    labelKey: 'modules.workflow.search.workflowTask',
    resourceId: 'api.workflow',
    deepLinkTemplate: '/workflows/tasks',
    backendProviderKey: 'search.workflow',
    sortOrder: 111,
    category: 'operations',
    searchScope: 'executable',
  },
  {
    entityType: 'workflow_template',
    moduleId: 'workflow',
    localId: 'workflow-template',
    labelKey: 'modules.workflow.search.workflowTemplate',
    resourceId: 'api.workflow',
    deepLinkTemplate: '/workflows/templates',
    backendProviderKey: 'search.workflow',
    sortOrder: 112,
    category: 'operations',
    searchScope: 'executable',
  },
] as const;

export function listCanonicalSearchEntityTypes(): CanonicalSearchEntityType[] {
  return [...CANONICAL_SEARCH_ENTITY_TYPES];
}

export function getCanonicalSearchEntity(
  entityType: CanonicalSearchEntityType,
): CanonicalSearchEntity {
  const entity = CANONICAL_SEARCH_ENTITIES.find((entry) => entry.entityType === entityType);
  if (!entity) {
    throw new Error(`Unknown canonical search entity: ${entityType}`);
  }
  return entity;
}

export function listCanonicalPermissionResources(
  entityType: CanonicalSearchEntityType,
): string[] {
  const entity = getCanonicalSearchEntity(entityType);
  return Array.isArray(entity.resourceId) ? entity.resourceId : [entity.resourceId];
}
