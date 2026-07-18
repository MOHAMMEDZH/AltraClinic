/** Canonical licensed module identifiers (aligned with Phase 28 licensing.config.ts). */
export type LicensedModuleId =
  | 'dashboard'
  | 'patients'
  | 'scheduling'
  | 'queue'
  | 'emr'
  | 'dental'
  | 'beauty'
  | 'inventory'
  | 'billing'
  | 'reporting'
  | 'analytics'
  | 'workflow'
  | 'notifications'
  | 'ai'
  | 'userManagement'
  | 'settings'
  | 'patientPortal'
  | 'search'
  | 'media'
  | 'commission'
  | 'loyalty';

export type ModuleAccessMode = 'enabled' | 'disabled' | 'hidden' | 'read_only' | 'preview';

export type ModuleCategory =
  | 'clinical'
  | 'operations'
  | 'financial'
  | 'platform'
  | 'analytics'
  | 'communication'
  | 'administration'
  | 'extension';

export type CatalogLifecycleStatus =
  | 'discovered'
  | 'registered'
  | 'validated'
  | 'deprecated'
  | 'removed';

export type TenantRuntimeStatus =
  | 'installed'
  | 'initialized'
  | 'healthy'
  | 'degraded'
  | 'disabled'
  | 'suspended'
  | 'failed'
  | 'uninstalled';

export type ModuleLifecycleState = CatalogLifecycleStatus | TenantRuntimeStatus;

export type PermissionAction =
  | 'view'
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'export'
  | 'manage';

export type ModuleCapability =
  | 'navigation'
  | 'routing'
  | 'dashboard'
  | 'search'
  | 'reporting'
  | 'analytics'
  | 'workflow'
  | 'notifications'
  | 'ai'
  | 'whiteLabel'
  | 'branch'
  | 'activity'
  | 'audit'
  | 'journey'
  | 'notification'
  | 'http-adapter'
  | 'webhook';

export type ExtensionKind = Exclude<ModuleCapability, 'http-adapter' | 'webhook'>;

export type LockReason = 'plan' | 'lifecycle' | 'dependency' | 'flag' | 'permission';

export type DependencyHealthStatus = 'healthy' | 'degraded' | 'blocked';

export interface ModuleDependency {
  moduleId: string;
  type: 'required' | 'optional' | 'conflicts';
  semverRange?: string;
  reasonKey?: string;
}

export interface ModuleIdentity {
  displayNameKey: string;
  descriptionKey?: string;
  category: ModuleCategory;
  tags?: string[];
  publisher?: PublisherInfo;
  documentationUrl?: string;
  supportUrl?: string;
}

export interface ModuleMetadata {
  sortOrder: number;
  keywords?: string[];
  clinicalDomains?: ('medical' | 'dental' | 'beauty')[];
  HIPAARelevant?: boolean;
  auditClassification?: 'standard' | 'elevated' | 'platform';
}

export interface ModuleCompatibility {
  nestModule?: string;
  frontendChunk?: string;
  nodeEngine?: string;
  peerModules?: Record<string, string>;
}

export interface ModuleLicensingRef {
  licensedModuleId?: LicensedModuleId;
  requiredFeatures?: string[];
  marketingTier?: 'starter' | 'professional' | 'business' | 'enterprise';
}

export interface PermissionResourceRef {
  resourceId: string;
  actions: PermissionAction[];
  descriptionKey?: string;
}

export interface ModulePermissionsRef {
  resources: PermissionResourceRef[];
  defaultActions?: PermissionAction[];
}

export interface ModuleVisibilityRules {
  default: 'visible' | 'hidden' | 'locked';
  showWhenLocked?: boolean;
  kioskExcluded?: boolean;
  platformOnly?: boolean;
}

export interface ModuleIconSet {
  default: string;
  active?: string;
  locked?: string;
  monochrome?: string;
}

export interface ModulePresentation {
  visibility: ModuleVisibilityRules;
  icons: ModuleIconSet;
  themeTokens?: Record<string, string>;
}

export interface ExtensionBase {
  extensionId: string;
  labelKey: string;
  sortOrder: number;
  resourceId?: string;
  featureId?: string;
  icon?: string;
  hidden?: boolean;
}

export interface NavigationContribution extends ExtensionBase {
  path: string;
  parentExtensionId?: string;
  placement: 'sidebar' | 'settings' | 'quickNav' | 'topNav';
  badge?: 'new' | 'beta' | 'locked';
}

export interface RoutingContribution extends ExtensionBase {
  path: string;
  componentKey: string;
  layoutKey?: string;
  index?: boolean;
  children?: RoutingContribution[];
  kioskRoute?: boolean;
}

export interface DashboardContribution extends ExtensionBase {
  widgetId: string;
  componentKey: string;
  span?: 1 | 2 | 3 | 4;
  profiles?: string[];
  category?: string;
}

export interface SearchContribution extends ExtensionBase {
  entityType: string;
  permissionResources: string[];
  deepLinkTemplate: string;
  backendProviderKey?: string;
  /** executable = global GET /search types param; discovery = metadata/shortcuts only */
  searchScope: 'executable' | 'discovery';
  /** Discovery-only key when searchScope is discovery (not a SearchEntityType) */
  discoveryKey?: string;
  deprecatedAliases?: string[];
}

export interface ReportingContribution extends ExtensionBase {
  reportId: string;
  /** UI category namespace (e.g. 'clinical.patients', 'platform.reporting') */
  categoryKey: string;
  /** Logical data domain (e.g. 'patients', 'billing') */
  dataDomain: string;

  /** Optional secondary metadata for catalog presentation */
  descriptionKey?: string;
  featured?: boolean;
  tags?: string[];

  /**
   * Action-sensitive permission contract (Phase 33):
   * Reporting visibility differs from other consumers because templates may require create/export, not only view.
   * Bootstrap must evaluate (permissionResource(s), permissionAction) when determining extension accessibility.
   */
  permissionAction?: 'view' | 'create' | 'export';
  permissionResource?: string;
  permissionResources?: string[];

  /** Licensed feature linkage (optional; enforced server-side) */
  featureId?: string;

  /** Delivery + navigation metadata (metadata only; execution stays in existing modules) */
  delivery?: 'view' | 'generate' | 'export';
  route?: string;
  deepLinkTemplate?: string;

  /** Backend binding metadata */
  analyticsType?: string;
  operationalType?: string;

  /** Format metadata */
  defaultFormat?: 'pdf' | 'csv' | 'excel' | 'json';
  supportedFormats?: ('pdf' | 'csv' | 'excel' | 'json' | 'xlsx')[];
  exportFormats?: ('pdf' | 'csv' | 'xlsx')[];

  /** Scheduling metadata */
  scheduleAllowed?: boolean;

  /** Marketplace/provider metadata */
  providerKey?: string;
}

export interface AnalyticsContribution extends ExtensionBase {
  analyticsId: string;
  localId: string;
  moduleId: LicensedModuleId;
  schemaVersion: 1;
  providerKey: string;
  analyticsKind: 'domain' | 'widget' | 'hub' | 'kpi' | 'alert' | 'savedView';
  categoryId: string;
  dataDomain: string;
  classification: 'clinical' | 'operational' | 'financial' | 'platform';
  descriptionKey?: string;
  iconKey?: string;
  permissionAction?: 'view' | 'create' | 'export';
  permissionResource?: string;
  permissionResources?: string[];
  featureId?: string;
  route?: string;
  deepLinkTemplate?: string;
  drillDownTemplate?: string;
  metricIds?: string[];
  primaryMetricId?: string;
  visualizationTypes?: string[];
  reportLinkIds?: string[];
  dashboardWidgetIds?: string[];
  exportFormats?: ('pdf' | 'csv' | 'excel' | 'json' | 'xlsx')[];
  filterProfile?: 'all' | 'revenue' | 'appointments' | 'patients' | 'health';
  /** @deprecated use metricIds[] */
  metricId?: string;
  /** Builder palette id when analyticsKind is widget */
  widgetCatalogId?: string;
  /** @deprecated use dimensionIds[] */
  dimensions?: string[];
  /** Display hint only — licensing enforced server-side */
  minimumPlan?: string;
}

export interface WorkflowContribution extends ExtensionBase {
  triggerType?: string;
  actionType?: string;
}

export interface NotificationContribution extends ExtensionBase {
  eventType: string;
  templateKey?: string;
  channels?: ('email' | 'sms' | 'push' | 'in_app')[];
}

export interface AiContribution extends ExtensionBase {
  workspaceId: string;
  toolIds?: string[];
}

export interface WhiteLabelContribution extends ExtensionBase {
  surfaceId?: string;
  localId?: string;
  moduleId?: LicensedModuleId;
  surface:
    | 'branding'
    | 'customDomain'
    | 'theme'
    | 'loginPage'
    | 'layout'
    | 'localization'
    | 'identity'
    | 'emailTemplate'
    | 'pdfTemplate'
    | 'patientPortal'
    | 'marketplacePack';
  requiredFeature: string;
  settingsPath?: string;
  deepLinkTemplate?: string;
  adminResourceId?: string;
  adminAction?: 'view' | 'update';
  appliesTo?: string[];
  assetSlots?: string[];
  tokenGroups?: string[];
  layoutProfileId?: string;
  localizationOptionIds?: string[];
  categoryId?: string;
  defaultEnabled?: boolean;
  rollbackBehavior?: 'platform' | 'tenant-json';
  providerKey?: string;
  schemaVersion?: number;
  descriptionKey?: string;
}

export interface BranchContribution extends ExtensionBase {
  surfaceId: string;
  localId: string;
  moduleId: LicensedModuleId;
  surface:
    | 'identity'
    | 'address'
    | 'clinical'
    | 'financial'
    | 'inventory'
    | 'reporting'
    | 'analytics'
    | 'whiteLabel'
    | 'administration';
  categoryId: string;
  configurationCategory: string;
  branchScoped: boolean;
  crossBranchAllowed: boolean;
  inheritanceMode: 'tenant-default' | 'branch-override' | 'branch-only';
  adminResourceId: string;
  adminAction: 'view' | 'update' | 'manage';
  settingsPath: string;
  deepLinkTemplate: string;
  requiredFeature?: string;
  providerKey: string;
  schemaVersion: number;
  descriptionKey?: string;
  /** Reserved for Phase 37 — vocabulary only in 36a. */
  departmentScoped?: boolean;
}

export interface ActivityContribution extends ExtensionBase {
  activityKind: 'type' | 'feed' | 'hub';
  localId: string;
  moduleId: LicensedModuleId;
  activityTypeId?: string;
  eventTypeId?: string;
  feedId?: string;
  hubId?: string;
  categoryId?: string;
  defaultSeverity?: string;
  descriptionKey?: string;
  actions: Array<'view' | 'export'>;
  requiredFeature?: string;
  branchScoped?: boolean;
  crossBranchAllowed?: boolean;
  deepLinkTemplate: string;
  route?: string;
  providerKey: string;
  feedIds?: string[];
  ownerModuleId?: string | 'platform';
  visibility?: string;
  licensing?: string;
  branchScope?: 'tenant' | 'branch' | 'cross-branch';
  retentionPolicy?: string;
  archivePolicy?: string;
  retentionPolicyId?: string;
  categoryFilter?: string[];
  producerEntityType?: string;
  eventVersion?: string;
  schemaVersion?: string;
  projectionVersion?: string;
  supportsCorrelation?: boolean;
  supportsCausation?: boolean;
  supportsParentActivity?: boolean;
  supportsBatch?: boolean;
  orderingScope?: 'tenant' | 'branch' | 'feed';
  redactFields?: string[];
  contributionSchemaVersion: 1;
}

export interface AuditContribution extends ExtensionBase {
  auditKind: 'type' | 'feed' | 'surface';
  localId: string;
  moduleId: LicensedModuleId;
  auditEventTypeId?: string;
  feedId?: string;
  surfaceId?: string;
  owningModuleId?: LicensedModuleId | string;
  producerModuleId?: LicensedModuleId | string;
  ownerModuleId?: LicensedModuleId | string;
  categoryId?: string;
  severity?: string;
  risk?: string;
  action?: string;
  defaultOutcome?: string;
  resourceType?: string;
  permissionResource?: string;
  permissionAction?: PermissionAction;
  tenantScoped?: boolean;
  branchScoped?: boolean;
  crossBranchAllowed?: boolean;
  branchScope?: 'tenant' | 'branch' | 'cross-branch';
  retentionPolicyId?: string;
  redactionPolicyId?: string;
  integrityPolicyId?: string;
  exportPolicyId?: string;
  descriptionKey?: string;
  deepLinkTemplate: string;
  route?: string;
  providerKey: string;
  feedIds?: string[];
  visibility?: string;
  licensing?: string;
  defaultFilters?: string[];
  requiredFeature?: string;
  eventVersion?: string;
  schemaVersion?: string;
  legacyActionHint?: string;
  contributionSchemaVersion: 1;
}

export interface JourneyContribution extends ExtensionBase {
  journeyKind: 'stage' | 'transition' | 'definition' | 'surface' | 'automationHook' | 'pack';
  localId: string;
  moduleId: LicensedModuleId;
  ownerModuleId?: LicensedModuleId | string;
  providerKey: string;
  descriptionKey?: string;
  // stage fields
  stageId?: string;
  categoryId?: string;
  tenantScoped?: boolean;
  branchScoped?: boolean;
  entryRules?: string[];
  exitRules?: string[];
  terminal?: boolean;
  parallelPathAllowed?: boolean;
  multiInstanceAllowed?: boolean;
  // transition fields
  transitionId?: string;
  fromStageId?: string;
  toStageId?: string;
  transitionType?: 'happy-path' | 'side-path' | 'cancel' | 'reactivation' | 'parallel';
  requiredGuardIds?: string[];
  requiredApprovalIds?: string[];
  automationRuleIds?: string[];
  allowedBranchScope?: 'branch';
  retry?: { maxAttempts: number; backoff: 'none' | 'exponential'; failClosed: true };
  failureBehavior?: { strategy: 'fail-closed' | 'compensate' | 'manual'; failClosed: true };
  allowedCycle?: boolean;
  // definition fields
  definitionId?: string;
  stageIds?: string[];
  // surface fields
  surfaceId?: string;
  route?: string;
  requiredFeature?: string;
  branchScope?: 'tenant' | 'branch' | 'cross-branch';
  // automationHook fields
  automationRuleId?: string;
  triggerType?: 'domain-event' | 'transition' | 'timer';
  sourceStageId?: string;
  sourceTransitionId?: string;
  actionType?: string;
  targetModuleId?: LicensedModuleId | string;
  syncIntent?: 'async' | 'sync';
  idempotencyKeyStrategy?: string;
  // pack fields
  packId?: string;
  version?: string;
  permissionResource?: string;
  permissionAction?: PermissionAction;
  deepLinkTemplate: string;
  eventVersion?: string;
  schemaVersion?: string;
  contributionSchemaVersion: 1;
}

/**
 * Notification Center contribution (Phase 41a foundation) — discriminated by notificationKind.
 * Distinct from the legacy `NotificationContribution` (plural `notifications` extension field,
 * simple event/template/channel stub) which is preserved untouched for backward compatibility.
 * Zero runtime behavior: registry metadata only, mirrors JourneyContribution's shape.
 */
export interface NotificationCenterContribution extends ExtensionBase {
  notificationKind: 'channel' | 'type' | 'template' | 'provider' | 'surface' | 'pack';
  localId: string;
  moduleId: LicensedModuleId;
  ownerModuleId?: LicensedModuleId | string;
  providerKey: string;
  descriptionKey?: string;
  // channel fields
  channelId?: string;
  runtimeImplemented?: boolean;
  implementationStatus?: 'not-implemented' | 'stub' | 'partial' | 'full';
  supportsRichContent?: boolean;
  requiresRecipientAddress?: boolean;
  fallbackChannelId?: string;
  // type fields
  typeId?: string;
  categoryId?: string;
  transactional?: boolean;
  requiresConsent?: boolean;
  consentPolicyId?: string;
  sensitive?: boolean;
  redactionPolicyId?: string;
  defaultChannelIds?: string[];
  // template fields
  templateId?: string;
  locale?: string;
  publicationStatus?: 'draft' | 'published';
  phiClassification?: 'none' | 'limited' | 'phi';
  variableNames?: string[];
  // provider fields
  providerId?: string;
  vendor?: string;
  requiresCredentials?: boolean;
  // surface fields
  surfaceId?: string;
  route?: string;
  requiredFeature?: string;
  branchScope?: 'tenant' | 'branch' | 'cross-branch';
  // pack fields
  packId?: string;
  includedTypeIds?: string[];
  version?: string;
  permissionResource?: string;
  permissionAction?: PermissionAction;
  deepLinkTemplate: string;
  schemaVersion?: string;
  contributionSchemaVersion: 1;
}

export type ModuleContribution =
  | NavigationContribution
  | RoutingContribution
  | DashboardContribution
  | SearchContribution
  | ReportingContribution
  | AnalyticsContribution
  | WorkflowContribution
  | NotificationContribution
  | AiContribution
  | WhiteLabelContribution
  | BranchContribution
  | ActivityContribution
  | AuditContribution
  | JourneyContribution
  | NotificationCenterContribution;

export interface ModuleExtensions {
  navigation?: NavigationContribution[];
  routing?: RoutingContribution[];
  dashboard?: DashboardContribution[];
  search?: SearchContribution[];
  reporting?: ReportingContribution[];
  analytics?: AnalyticsContribution[];
  workflow?: WorkflowContribution[];
  notifications?: NotificationContribution[];
  ai?: AiContribution[];
  whiteLabel?: WhiteLabelContribution[];
  branch?: BranchContribution[];
  activity?: ActivityContribution[];
  audit?: AuditContribution[];
  journey?: JourneyContribution[];
  notification?: NotificationCenterContribution[];
}

export interface ModuleLocalizationBundle {
  namespace: string;
  fallbackLocale: string;
  locales?: string[];
}

export interface ModuleAssets {
  iconUrl?: string;
  screenshotUrls?: string[];
  bundleChecksum?: string;
}

export interface ModuleSettingToggle {
  key: string;
  labelKey: string;
  licensedModuleId?: LicensedModuleId;
  defaultValue: boolean;
}

export interface ModuleSettingsSchema {
  settingsPath?: string;
  toggles?: ModuleSettingToggle[];
}

export interface ModuleFeatureFlagDecl {
  key: string;
  descriptionKey: string;
  scope: 'tenant' | 'platform';
  allowTenantOverride: boolean;
}

export interface ModuleHealthCheck {
  probeId: string;
  type: 'backend' | 'frontend-chunk' | 'dependency' | 'custom';
  target: string;
  intervalSeconds?: number;
  timeoutMs?: number;
  required: boolean;
}

export interface ManifestSignature {
  algorithm: 'ed25519' | 'rs256';
  publicKeyId: string;
  value: string;
}

export interface PublisherInfo {
  publisherId: string;
  name: string;
  verified: boolean;
}

export interface ModuleIntegrity {
  signature?: ManifestSignature;
  checksum?: string;
  publishedAt?: string;
}

/** Canonical module manifest (schema v1.0). */
export interface ModuleManifest {
  moduleManifestSchemaVersion: '1.0';
  manifestId: string;
  moduleId: string;
  version: string;
  minPlatformVersion: string;
  catalogStatus?: CatalogLifecycleStatus;
  identity: ModuleIdentity;
  metadata: ModuleMetadata;
  compatibility: ModuleCompatibility;
  dependencies: ModuleDependency[];
  licensing: ModuleLicensingRef;
  permissions: ModulePermissionsRef;
  presentation: ModulePresentation;
  extensions: ModuleExtensions;
  localization?: ModuleLocalizationBundle;
  assets?: ModuleAssets;
  settings?: ModuleSettingsSchema;
  featureFlags?: ModuleFeatureFlagDecl[];
  healthChecks?: ModuleHealthCheck[];
  integrity?: ModuleIntegrity;
  capabilities?: ModuleCapability[];
}

export interface DependencyHealth {
  moduleId: string;
  status: DependencyHealthStatus;
  reasonKey?: string;
}

export interface EffectiveExtension {
  extensionId: string;
  kind: ExtensionKind;
  moduleId: string;
  labelKey: string;
  sortOrder: number;
  userVisible: boolean;
  payload: Record<string, unknown>;
}

export interface EffectiveModuleView {
  moduleId: string;
  manifestId: string;
  access: ModuleAccessMode;
  tenantOverride: 'enabled' | 'disabled' | 'inherit';
  runtimeStatus: TenantRuntimeStatus;
  userVisible: boolean;
  userAccessible: boolean;
  lockReason?: LockReason;
  dependencies: DependencyHealth[];
  extensions: EffectiveExtension[];
}

export interface RegistrySnapshot {
  schemaVersion: '1.0';
  platformVersion: string;
  generatedAt: string;
  catalogGeneration: number;
  licenseGeneration?: number;
  manifests: ModuleManifest[];
  dependencyOrder: string[];
  moduleCount: number;
}

export type ModuleEventType =
  | 'module.discovered'
  | 'module.registered'
  | 'module.validated'
  | 'module.installed'
  | 'module.initialized'
  | 'module.enabled'
  | 'module.disabled'
  | 'module.degraded'
  | 'module.failed'
  | 'module.suspended'
  | 'module.removed'
  | 'module.uninstalled'
  | 'module.health.changed'
  | 'module.dependencies.changed'
  | 'module.upgraded'
  | 'module.rollback';

export interface ModuleRegistryEvent {
  eventType: ModuleEventType;
  eventId: string;
  occurredAt: string;
  tenantId?: string;
  moduleId: string;
  manifestId?: string;
  fromState?: string;
  toState?: string;
  actor: { type: 'system' | 'user' | 'publisher'; id: string };
  payload: Record<string, unknown>;
  correlationId?: string;
}

export interface ModuleHealthReport {
  moduleId: string;
  manifestId: string;
  runtimeStatus: TenantRuntimeStatus;
  probes: Array<{
    probeId: string;
    status: 'pass' | 'fail' | 'skip';
    message?: string;
  }>;
}

export interface PermissionEvaluator {
  hasPermission: (resourceId: string, action?: PermissionAction) => boolean;
}

export interface EffectiveModuleResolveInput {
  manifests: ModuleManifest[];
  licenseModules: Record<string, ModuleAccessMode>;
  moduleFlags: Record<string, boolean>;
  canWrite: boolean;
  canMutate: boolean;
  licenseStatus?: string;
  permissionEvaluator?: PermissionEvaluator;
  dependencyOrder: string[];
  dependencyHealthByModule: Record<string, DependencyHealth[]>;
}

export interface ManifestValidationIssue {
  path: string;
  code: string;
  message: string;
}

export interface ManifestValidationResult {
  valid: boolean;
  issues: ManifestValidationIssue[];
}

export interface DependencyGraphResult {
  order: string[];
  cycles: string[][];
  blocked: Array<{ moduleId: string; reason: string }>;
  healthByModule: Record<string, DependencyHealth[]>;
}

export const PLATFORM_MODULE_ID = 'platform';
export const PLATFORM_VERSION = '1.0.0';
export const BUILTIN_MANIFEST_VERSION = '1.0.0';

export const ALL_LICENSED_MODULE_IDS: LicensedModuleId[] = [
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
];
