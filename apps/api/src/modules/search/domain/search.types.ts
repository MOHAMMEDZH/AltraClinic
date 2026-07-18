export const SEARCH_ENTITY_TYPES = {
  USER: 'user',
  PATIENT: 'patient',
  APPOINTMENT: 'appointment',
  DIAGNOSIS: 'diagnosis',
  TREATMENT: 'treatment',
  INVOICE: 'invoice',
  INVENTORY: 'inventory',
  REPORT: 'report',
  LAB_RESULT: 'lab_result',
  CARE_PLAN: 'care_plan',
  NOTE_TEMPLATE: 'note_template',
  PROBLEM: 'problem',
  ENCOUNTER: 'encounter',
  DENTAL_PLAN: 'dental_plan',
  DENTAL_ORTHO: 'dental_ortho',
  DENTAL_IMPLANT: 'dental_implant',
  DENTAL_NOTE: 'dental_note',
  DENTAL_IMAGE: 'dental_image',
  BEAUTY_PLAN: 'beauty_plan',
  BEAUTY_SESSION: 'beauty_session',
  BEAUTY_CONSULTATION: 'beauty_consultation',
  BEAUTY_IMAGE: 'beauty_image',
  NOTIFICATION: 'notification',
  WORKFLOW: 'workflow',
  WORKFLOW_TASK: 'workflow_task',
  WORKFLOW_TEMPLATE: 'workflow_template',
} as const;

export type SearchEntityType = (typeof SEARCH_ENTITY_TYPES)[keyof typeof SEARCH_ENTITY_TYPES];

export const ALL_SEARCH_ENTITY_TYPES: SearchEntityType[] = Object.values(SEARCH_ENTITY_TYPES);

export type SearchMatchKind = 'exact' | 'prefix' | 'contains' | 'secondary';

export interface SearchHit {
  type: SearchEntityType;
  id: string;
  tenantId: string;
  branchId: string | null;
  title: string;
  subtitle: string | null;
  url: string;
  matchKind: SearchMatchKind;
  matchedField: string;
  createdAt: Date;
  /** Optional entity-specific payload for UI badges */
  metadata?: Record<string, string>;
}

export interface GlobalSearchParams {
  tenantId: string;
  branchId?: string | null;
  query: string;
  types: SearchEntityType[];
  limit: number;
  page: number;
}

export interface GlobalSearchResult {
  query: string;
  page: number;
  limit: number;
  total: number;
  results: RankedSearchHit[];
  tookMs: number;
  cached: boolean;
}

export interface RankedSearchHit extends SearchHit {
  score: number;
}

/** Maps searchable entity types to permission-matrix resource IDs. */
export const SEARCH_ENTITY_PERMISSION_RESOURCES: Record<
  SearchEntityType,
  string | string[]
> = {
  [SEARCH_ENTITY_TYPES.USER]: 'api.identity',
  [SEARCH_ENTITY_TYPES.PATIENT]: 'api.patients',
  [SEARCH_ENTITY_TYPES.APPOINTMENT]: 'api.scheduling',
  [SEARCH_ENTITY_TYPES.DIAGNOSIS]: 'api.emr',
  [SEARCH_ENTITY_TYPES.TREATMENT]: ['api.dental', 'api.beauty'],
  [SEARCH_ENTITY_TYPES.INVOICE]: 'api.billing',
  [SEARCH_ENTITY_TYPES.INVENTORY]: 'api.inventory',
  [SEARCH_ENTITY_TYPES.REPORT]: 'api.reporting',
  [SEARCH_ENTITY_TYPES.LAB_RESULT]: 'api.emr',
  [SEARCH_ENTITY_TYPES.CARE_PLAN]: 'api.emr',
  [SEARCH_ENTITY_TYPES.NOTE_TEMPLATE]: 'api.emr',
  [SEARCH_ENTITY_TYPES.PROBLEM]: 'api.emr',
  [SEARCH_ENTITY_TYPES.ENCOUNTER]: 'api.emr',
  [SEARCH_ENTITY_TYPES.DENTAL_PLAN]: 'api.dental',
  [SEARCH_ENTITY_TYPES.DENTAL_ORTHO]: 'api.dental',
  [SEARCH_ENTITY_TYPES.DENTAL_IMPLANT]: 'api.dental',
  [SEARCH_ENTITY_TYPES.DENTAL_NOTE]: 'api.dental',
  [SEARCH_ENTITY_TYPES.DENTAL_IMAGE]: 'api.media',
  [SEARCH_ENTITY_TYPES.BEAUTY_PLAN]: 'api.beauty',
  [SEARCH_ENTITY_TYPES.BEAUTY_SESSION]: 'api.beauty',
  [SEARCH_ENTITY_TYPES.BEAUTY_CONSULTATION]: 'api.beauty',
  [SEARCH_ENTITY_TYPES.BEAUTY_IMAGE]: 'api.media',
  [SEARCH_ENTITY_TYPES.NOTIFICATION]: 'api.notifications',
  [SEARCH_ENTITY_TYPES.WORKFLOW]: 'api.workflow',
  [SEARCH_ENTITY_TYPES.WORKFLOW_TASK]: 'api.workflow',
  [SEARCH_ENTITY_TYPES.WORKFLOW_TEMPLATE]: 'api.workflow',
};

/** Deep-link paths per entity type (frontend routes). */
export const SEARCH_ENTITY_URLS: Record<SearchEntityType, (id: string) => string> = {
  [SEARCH_ENTITY_TYPES.USER]: (id) => `/settings/users/${id}`,
  [SEARCH_ENTITY_TYPES.PATIENT]: (id) => `/patients/${id}`,
  [SEARCH_ENTITY_TYPES.APPOINTMENT]: (id) => `/scheduling/appointments/${id}`,
  [SEARCH_ENTITY_TYPES.DIAGNOSIS]: (id) => `/emr/encounters/${id}`,
  [SEARCH_ENTITY_TYPES.TREATMENT]: (id) => `/treatments/${id}`,
  [SEARCH_ENTITY_TYPES.INVOICE]: (id) => `/billing/invoices/${id}`,
  [SEARCH_ENTITY_TYPES.INVENTORY]: (id) => `/inventory/item/${id}`,
  [SEARCH_ENTITY_TYPES.REPORT]: (id) => `/reporting/reports/${id}`,
  [SEARCH_ENTITY_TYPES.LAB_RESULT]: (id) => `/emr/lab-results/${id}`,
  [SEARCH_ENTITY_TYPES.CARE_PLAN]: (id) => `/care-plans/${id}`,
  [SEARCH_ENTITY_TYPES.NOTE_TEMPLATE]: () => `/encounters`,
  [SEARCH_ENTITY_TYPES.PROBLEM]: (id) => `/patients/${id.split(':')[0]}`,
  [SEARCH_ENTITY_TYPES.ENCOUNTER]: (id) => `/encounters/${id}`,
  [SEARCH_ENTITY_TYPES.DENTAL_PLAN]: (id) => {
    const [patientId, planId] = id.split(':');
    return `/dental/chart/${patientId}/plan/${planId}`;
  },
  [SEARCH_ENTITY_TYPES.DENTAL_ORTHO]: (id) => {
    const [patientId] = id.split(':');
    return `/dental/chart/${patientId}?tab=ortho`;
  },
  [SEARCH_ENTITY_TYPES.DENTAL_IMPLANT]: (id) => {
    const [patientId] = id.split(':');
    return `/dental/chart/${patientId}?tab=implants`;
  },
  [SEARCH_ENTITY_TYPES.DENTAL_NOTE]: (id) => {
    const [patientId] = id.split(':');
    return `/dental/chart/${patientId}?tab=notes`;
  },
  [SEARCH_ENTITY_TYPES.DENTAL_IMAGE]: (id) => {
    const [patientId] = id.split(':');
    return `/dental/imaging/${patientId}`;
  },
  [SEARCH_ENTITY_TYPES.BEAUTY_PLAN]: (id) => {
    const [patientId, planId] = id.split(':');
    return `/beauty/workspace/${patientId}?tab=plans`;
  },
  [SEARCH_ENTITY_TYPES.BEAUTY_SESSION]: (id) => {
    const [patientId] = id.split(':');
    return `/beauty/workspace/${patientId}?tab=sessions`;
  },
  [SEARCH_ENTITY_TYPES.BEAUTY_CONSULTATION]: (id) => {
    const [patientId] = id.split(':');
    return `/beauty/workspace/${patientId}?tab=consultation`;
  },
  [SEARCH_ENTITY_TYPES.BEAUTY_IMAGE]: (id) => {
    const [patientId] = id.split(':');
    return `/beauty/imaging/${patientId}`;
  },
  [SEARCH_ENTITY_TYPES.NOTIFICATION]: (id) => `/settings/notifications/inbox/${id}`,
  [SEARCH_ENTITY_TYPES.WORKFLOW]: (id) => `/workflows/instances/${id}`,
  [SEARCH_ENTITY_TYPES.WORKFLOW_TASK]: () => `/workflows/tasks`,
  [SEARCH_ENTITY_TYPES.WORKFLOW_TEMPLATE]: () => `/workflows/templates`,
};
