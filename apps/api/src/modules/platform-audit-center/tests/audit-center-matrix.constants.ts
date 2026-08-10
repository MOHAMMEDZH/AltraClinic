/**
 * Step 21 Audit Center test matrix taxonomy (freeze-aligned).
 * Actions are prefixed for safe PostgreSQL cleanup.
 */
export const MATRIX_ACTION_PREFIX = 'audit.center.matrix.';

export type MatrixCoverageCase = {
  label: string;
  category: string;
  action: string;
  resourceType: string;
};

/** A01–A16 canonical category/action pairs. */
export const COVERAGE_MATRIX: MatrixCoverageCase[] = [
  { label: 'A01', category: 'platform_security', action: 'platform.user.login', resourceType: 'platform_user' },
  { label: 'A02', category: 'platform_security', action: 'platform.mfa.enrolled', resourceType: 'platform_user' },
  { label: 'A03', category: 'catalog', action: 'healthcare_catalog.item.created', resourceType: 'healthcare_catalog_item' },
  { label: 'A04', category: 'plan', action: 'platform_plan.version.drafted', resourceType: 'platform_plan_version' },
  { label: 'A05', category: 'plan', action: 'platform_plan.version.published', resourceType: 'platform_plan_version' },
  { label: 'A06', category: 'entitlement', action: 'platform_plan.entitlements_replaced', resourceType: 'platform_plan_version' },
  { label: 'A07', category: 'entitlement', action: 'platform_plan.limits_replaced', resourceType: 'platform_plan_version' },
  { label: 'A08', category: 'addon', action: 'platform_addon.assigned', resourceType: 'platform_addon' },
  { label: 'A09', category: 'override', action: 'platform_override.approved', resourceType: 'platform_override' },
  { label: 'A10', category: 'subscription', action: 'platform_subscription.assigned', resourceType: 'platform_subscription' },
  { label: 'A11', category: 'provisioning', action: 'tenant_provisioning.completed', resourceType: 'tenant_provisioning_request' },
  { label: 'A12', category: 'lifecycle', action: 'tenant_lifecycle.suspended', resourceType: 'tenant' },
  { label: 'A13', category: 'feature_flag', action: 'platform_feature_flag.created', resourceType: 'platform_feature_flag' },
  { label: 'A14', category: 'feature_flag', action: 'platform_feature_flag.targets_updated', resourceType: 'platform_feature_flag' },
  { label: 'A15', category: 'global_setting', action: 'platform_global_setting.updated', resourceType: 'platform_global_setting' },
  { label: 'A16', category: 'eer_decision', action: 'eer.activation.evaluated', resourceType: 'subscription' },
];

export const PROHIBITED_SERIALIZED = [
  'password',
  'secret',
  'Bearer',
  'accessToken',
  'refreshToken',
  'sessionId',
  'patient',
  'mrn',
  'diagnosis',
  'private_key',
  'api_key',
];
