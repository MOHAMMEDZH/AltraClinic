/**
 * Deterministic Step 12 seed inventory — evidence-based from LICENSED_* /
 * facility classifier / ClinicProfile specialty options.
 * Does not invent laboratory/radiology product modules (capability gap).
 */
import type { CatalogKindName } from '../platform-healthcare-catalog.tokens';

export interface SeedTranslation {
  locale: 'en-US' | 'ar-SY';
  displayName: string;
  shortDescription: string;
}

export interface SeedAlias {
  aliasValue: string;
  sourceNamespace:
    | 'legacy_clinic_type'
    | 'licensed_module_id'
    | 'licensed_feature_id'
    | 'plan_features_key'
    | 'plan_limits_key'
    | 'ui_specialty_option';
  reason: string;
}

export interface SeedItem {
  canonicalKey: string;
  kind: CatalogKindName;
  sortOrder: number;
  iconKey?: string;
  translations: SeedTranslation[];
  aliases?: SeedAlias[];
  limit?: {
    valueType: 'INTEGER' | 'COUNT';
    unit: string;
    zeroValid: boolean;
    unlimitedSupported: boolean;
  };
}

export interface SeedRule {
  ruleType:
    | 'REQUIRES'
    | 'REQUIRES_ANY_OF'
    | 'INCOMPATIBLE_WITH'
    | 'ALLOWED_FOR'
    | 'NOT_ALLOWED_FOR';
  subjectKey: string;
  targetKey: string;
  anyOfGroupKey?: string;
  explanationEn: string;
  explanationAr: string;
}

function t(
  enName: string,
  enDesc: string,
  arName: string,
  arDesc: string,
): SeedTranslation[] {
  return [
    { locale: 'en-US', displayName: enName, shortDescription: enDesc },
    { locale: 'ar-SY', displayName: arName, shortDescription: arDesc },
  ];
}

function camelToSnakeModule(id: string): string {
  return `module.${id.replace(/([A-Z])/g, '_$1').toLowerCase()}`;
}

function camelToSnakeFeature(id: string): string {
  return `feature.${id.replace(/([A-Z])/g, '_$1').toLowerCase()}`;
}

function camelToSnakeLimit(id: string): string {
  return `limit.${id.replace(/([A-Z])/g, '_$1').toLowerCase()}`;
}

const LICENSED_MODULE_IDS = [
  'dashboard',
  'patients',
  'scheduling',
  'queue',
  'emr',
  'dental',
  'beauty',
  'inventory',
  'billing',
  'reporting',
  'analytics',
  'workflow',
  'notifications',
  'ai',
  'userManagement',
  'settings',
  'patientPortal',
  'search',
  'media',
  'commission',
  'loyalty',
] as const;

const LICENSED_FEATURES: Array<{ id: string; backendFeature?: string }> = [
  { id: 'dashboard' },
  { id: 'patients' },
  { id: 'scheduling' },
  { id: 'billing' },
  { id: 'reports' },
  { id: 'aiChat' },
  { id: 'medicalCopilot' },
  { id: 'dentalCopilot' },
  { id: 'reportingAi' },
  { id: 'workflow', backendFeature: 'customWorkflows' },
  { id: 'analytics', backendFeature: 'advancedAnalytics' },
  { id: 'inventoryAi' },
  { id: 'apiAccess' },
  { id: 'integrations' },
  { id: 'prioritySupport' },
  { id: 'customBranding' },
  { id: 'whiteLabel' },
  { id: 'auditLogs', backendFeature: 'auditExport' },
  { id: 'customRoles' },
  { id: 'multiProviderAi', backendFeature: 'aiModels' },
  { id: 'organizationKnowledge' },
];

const LIMIT_KEYS = [
  'maxUsers',
  'maxDoctors',
  'maxBranches',
  'maxPatients',
  'maxAppointmentsPerMonth',
  'maxReportsPerMonth',
  'maxStorageGb',
  'maxApiRequestsPerDay',
  'maxEmailPerMonth',
  'maxSmsPerMonth',
  'maxWhatsappPerMonth',
  'maxPushPerMonth',
] as const;

export const SEED_FACILITY_TYPES: SeedItem[] = [
  {
    canonicalKey: 'facility_type.general_clinic',
    kind: 'FACILITY_TYPE',
    sortOrder: 10,
    iconKey: 'clinic',
    translations: t(
      'General clinic',
      'General medical outpatient clinic',
      'عيادة عامة',
      'عيادة طبية عامة للعيادات الخارجية',
    ),
    aliases: [
      {
        aliasValue: 'medical',
        sourceNamespace: 'legacy_clinic_type',
        reason: 'Legacy tenants.features.clinicProfile.clinicType bucket',
      },
    ],
  },
  {
    canonicalKey: 'facility_type.dental_clinic',
    kind: 'FACILITY_TYPE',
    sortOrder: 20,
    iconKey: 'dental',
    translations: t('Dental clinic', 'Dental care facility', 'عيادة أسنان', 'منشأة لرعاية الأسنان'),
    aliases: [
      {
        aliasValue: 'dental',
        sourceNamespace: 'legacy_clinic_type',
        reason: 'Legacy clinicType dental',
      },
    ],
  },
  {
    canonicalKey: 'facility_type.cosmetic_center',
    kind: 'FACILITY_TYPE',
    sortOrder: 30,
    iconKey: 'cosmetic',
    translations: t(
      'Cosmetic center',
      'Cosmetic and aesthetic care center',
      'مركز تجميل',
      'مركز للعناية التجميلية والجمالية',
    ),
    aliases: [
      {
        aliasValue: 'beauty',
        sourceNamespace: 'legacy_clinic_type',
        reason: 'Legacy clinicType beauty',
      },
    ],
  },
  {
    canonicalKey: 'facility_type.laboratory',
    kind: 'FACILITY_TYPE',
    sortOrder: 40,
    iconKey: 'lab',
    translations: t('Laboratory', 'Diagnostic laboratory facility', 'مختبر', 'منشأة مخبرية تشخيصية'),
  },
  {
    canonicalKey: 'facility_type.radiology_center',
    kind: 'FACILITY_TYPE',
    sortOrder: 50,
    iconKey: 'radiology',
    translations: t(
      'Radiology center',
      'Imaging and radiology facility',
      'مركز أشعة',
      'منشأة للتصوير والأشعة',
    ),
  },
  {
    canonicalKey: 'facility_type.multi_specialty_center',
    kind: 'FACILITY_TYPE',
    sortOrder: 60,
    iconKey: 'multi',
    translations: t(
      'Multi-specialty center',
      'Multi-specialty outpatient center',
      'مركز متعدد التخصصات',
      'مركز عيادات متعددة التخصصات',
    ),
    aliases: [
      {
        aliasValue: 'multi',
        sourceNamespace: 'legacy_clinic_type',
        reason: 'Legacy clinicType multi',
      },
    ],
  },
  {
    canonicalKey: 'facility_type.hospital',
    kind: 'FACILITY_TYPE',
    sortOrder: 70,
    iconKey: 'hospital',
    translations: t('Hospital', 'Hospital care setting', 'مستشفى', 'منشأة رعاية مشفية'),
  },
];

export const SEED_SPECIALTIES: SeedItem[] = [
  {
    canonicalKey: 'specialty.general_medicine',
    kind: 'SPECIALTY',
    sortOrder: 10,
    translations: t('General medicine', 'General medicine specialty', 'طب عام', 'تخصص الطب العام'),
    aliases: [
      {
        aliasValue: 'general',
        sourceNamespace: 'ui_specialty_option',
        reason: 'ClinicProfile SPECIALTY_OPTIONS',
      },
    ],
  },
  {
    canonicalKey: 'specialty.dentistry',
    kind: 'SPECIALTY',
    sortOrder: 20,
    translations: t('Dentistry', 'Dental specialty', 'طب الأسنان', 'تخصص طب الأسنان'),
  },
  {
    canonicalKey: 'specialty.pediatrics',
    kind: 'SPECIALTY',
    sortOrder: 30,
    translations: t('Pediatrics', 'Pediatric specialty', 'طب الأطفال', 'تخصص طب الأطفال'),
    aliases: [
      {
        aliasValue: 'pediatrics',
        sourceNamespace: 'ui_specialty_option',
        reason: 'ClinicProfile SPECIALTY_OPTIONS',
      },
    ],
  },
  {
    canonicalKey: 'specialty.dermatology',
    kind: 'SPECIALTY',
    sortOrder: 40,
    translations: t('Dermatology', 'Dermatology specialty', 'الأمراض الجلدية', 'تخصص الأمراض الجلدية'),
    aliases: [
      {
        aliasValue: 'dermatology',
        sourceNamespace: 'ui_specialty_option',
        reason: 'ClinicProfile SPECIALTY_OPTIONS',
      },
    ],
  },
  {
    canonicalKey: 'specialty.orthodontics',
    kind: 'SPECIALTY',
    sortOrder: 50,
    translations: t('Orthodontics', 'Orthodontics specialty', 'تقويم الأسنان', 'تخصص تقويم الأسنان'),
    aliases: [
      {
        aliasValue: 'orthodontics',
        sourceNamespace: 'ui_specialty_option',
        reason: 'ClinicProfile SPECIALTY_OPTIONS',
      },
    ],
  },
  {
    canonicalKey: 'specialty.cosmetic',
    kind: 'SPECIALTY',
    sortOrder: 60,
    translations: t('Cosmetic', 'Cosmetic specialty', 'تجميل', 'تخصص تجميلي'),
    aliases: [
      {
        aliasValue: 'cosmetic',
        sourceNamespace: 'ui_specialty_option',
        reason: 'ClinicProfile SPECIALTY_OPTIONS',
      },
    ],
  },
  {
    canonicalKey: 'specialty.physiotherapy',
    kind: 'SPECIALTY',
    sortOrder: 70,
    translations: t('Physiotherapy', 'Physiotherapy specialty', 'العلاج الطبيعي', 'تخصص العلاج الطبيعي'),
    aliases: [
      {
        aliasValue: 'physiotherapy',
        sourceNamespace: 'ui_specialty_option',
        reason: 'ClinicProfile SPECIALTY_OPTIONS',
      },
    ],
  },
];

export const SEED_MODULES: SeedItem[] = LICENSED_MODULE_IDS.map((id, index) => ({
  canonicalKey: camelToSnakeModule(id),
  kind: 'MODULE' as const,
  sortOrder: (index + 1) * 10,
  iconKey: 'module' as const,
  translations: t(
    id,
    `Licensed product module ${id}`,
    id,
    `وحدة منتج مرخصة ${id}`,
  ),
  aliases: [
    {
      aliasValue: id,
      sourceNamespace: 'licensed_module_id' as const,
      reason: 'LICENSED_MODULES id',
    },
  ],
}));

export const SEED_FEATURES: SeedItem[] = LICENSED_FEATURES.map((f, index) => {
  const aliases: SeedAlias[] = [
    {
      aliasValue: f.id,
      sourceNamespace: 'licensed_feature_id',
      reason: 'LICENSED_FEATURES id',
    },
  ];
  if (f.backendFeature) {
    aliases.push({
      aliasValue: f.backendFeature,
      sourceNamespace: 'plan_features_key',
      reason: 'PlanFeatures backend key linked from LICENSED_FEATURES',
    });
  }
  return {
    canonicalKey: camelToSnakeFeature(f.id),
    kind: 'FEATURE' as const,
    sortOrder: (index + 1) * 10,
    iconKey: 'feature' as const,
    translations: t(
      f.id,
      `Licensed feature ${f.id}`,
      f.id,
      `ميزة مرخصة ${f.id}`,
    ),
    aliases,
  };
});

export const SEED_LIMITS: SeedItem[] = LIMIT_KEYS.map((id, index) => ({
  canonicalKey: camelToSnakeLimit(id),
  kind: 'LIMIT' as const,
  sortOrder: (index + 1) * 10,
  iconKey: 'limit' as const,
  translations: t(id, `Limit definition ${id}`, id, `تعريف الحد ${id}`),
  aliases: [
    {
      aliasValue: id,
      sourceNamespace: 'plan_limits_key' as const,
      reason: 'PlanLimits key from plan-limits.config.ts',
    },
  ],
  limit: {
    valueType: id === 'maxStorageGb' ? 'INTEGER' : 'COUNT',
    unit:
      id === 'maxStorageGb'
        ? 'gigabytes'
        : id.includes('PerMonth') || id.includes('PerDay')
          ? 'count_per_period'
          : 'count',
    zeroValid: true,
    unlimitedSupported: true,
  },
}));

/** Fix limit alias namespace — use a dedicated namespace string in seed service. */
export const LIMIT_ALIAS_NAMESPACE = 'plan_limits_key' as const;

export const SEED_COMPATIBILITY_RULES: SeedRule[] = [
  {
    ruleType: 'ALLOWED_FOR',
    subjectKey: 'module.dental',
    targetKey: 'facility_type.dental_clinic',
    explanationEn: 'Dental module is allowed for dental clinics',
    explanationAr: 'وحدة الأسنان مسموحة لعيادات الأسنان',
  },
  {
    ruleType: 'ALLOWED_FOR',
    subjectKey: 'module.dental',
    targetKey: 'facility_type.multi_specialty_center',
    explanationEn: 'Dental module is allowed for multi-specialty centers',
    explanationAr: 'وحدة الأسنان مسموحة للمراكز متعددة التخصصات',
  },
  {
    ruleType: 'ALLOWED_FOR',
    subjectKey: 'module.dental',
    targetKey: 'facility_type.hospital',
    explanationEn: 'Dental module is allowed for hospitals',
    explanationAr: 'وحدة الأسنان مسموحة للمستشفيات',
  },
  {
    ruleType: 'ALLOWED_FOR',
    subjectKey: 'module.beauty',
    targetKey: 'facility_type.cosmetic_center',
    explanationEn: 'Beauty module is allowed for cosmetic centers',
    explanationAr: 'وحدة التجميل مسموحة لمراكز التجميل',
  },
  {
    ruleType: 'ALLOWED_FOR',
    subjectKey: 'module.beauty',
    targetKey: 'facility_type.multi_specialty_center',
    explanationEn: 'Beauty module is allowed for multi-specialty centers',
    explanationAr: 'وحدة التجميل مسموحة للمراكز متعددة التخصصات',
  },
  {
    ruleType: 'ALLOWED_FOR',
    subjectKey: 'module.beauty',
    targetKey: 'facility_type.hospital',
    explanationEn: 'Beauty module is allowed for hospitals',
    explanationAr: 'وحدة التجميل مسموحة للمستشفيات',
  },
  {
    ruleType: 'NOT_ALLOWED_FOR',
    subjectKey: 'module.dental',
    targetKey: 'facility_type.laboratory',
    explanationEn: 'Dental module is not allowed for laboratories',
    explanationAr: 'وحدة الأسنان غير مسموحة للمختبرات',
  },
  {
    ruleType: 'NOT_ALLOWED_FOR',
    subjectKey: 'module.dental',
    targetKey: 'facility_type.radiology_center',
    explanationEn: 'Dental module is not allowed for radiology centers',
    explanationAr: 'وحدة الأسنان غير مسموحة لمراكز الأشعة',
  },
  {
    ruleType: 'REQUIRES_ANY_OF',
    subjectKey: 'module.dental',
    targetKey: 'specialty.dentistry',
    anyOfGroupKey: 'dental_specialty',
    explanationEn: 'Dental module requires dentistry or orthodontics specialty',
    explanationAr: 'وحدة الأسنان تتطلب تخصص طب الأسنان أو التقويم',
  },
  {
    ruleType: 'REQUIRES_ANY_OF',
    subjectKey: 'module.dental',
    targetKey: 'specialty.orthodontics',
    anyOfGroupKey: 'dental_specialty',
    explanationEn: 'Dental module requires dentistry or orthodontics specialty',
    explanationAr: 'وحدة الأسنان تتطلب تخصص طب الأسنان أو التقويم',
  },
  {
    ruleType: 'ALLOWED_FOR',
    subjectKey: 'specialty.orthodontics',
    targetKey: 'facility_type.dental_clinic',
    explanationEn: 'Orthodontics is allowed for dental clinics',
    explanationAr: 'تقويم الأسنان مسموح لعيادات الأسنان',
  },
  {
    ruleType: 'ALLOWED_FOR',
    subjectKey: 'specialty.orthodontics',
    targetKey: 'facility_type.multi_specialty_center',
    explanationEn: 'Orthodontics is allowed for multi-specialty centers',
    explanationAr: 'تقويم الأسنان مسموح للمراكز متعددة التخصصات',
  },
  {
    ruleType: 'ALLOWED_FOR',
    subjectKey: 'specialty.orthodontics',
    targetKey: 'facility_type.hospital',
    explanationEn: 'Orthodontics is allowed for hospitals',
    explanationAr: 'تقويم الأسنان مسموح للمستشفيات',
  },
];

export const ALL_SEED_ITEMS: SeedItem[] = [
  ...SEED_FACILITY_TYPES,
  ...SEED_SPECIALTIES,
  ...SEED_MODULES,
  ...SEED_FEATURES,
  ...SEED_LIMITS,
];

/**
 * Capability gaps (no product module to seed):
 * - laboratory workflow module
 * - radiology workflow module
 * Facility types exist for future Steps 13–18 selection only.
 */
export const DOCUMENTED_CAPABILITY_GAPS = [
  'facility_type.laboratory — no module.laboratory product capability yet',
  'facility_type.radiology_center — no module.radiology product capability yet',
] as const;
