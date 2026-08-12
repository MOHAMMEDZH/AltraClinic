/**
 * Phase 47 Step 08 — Platform Permission catalog and built-in role matrix.
 * Code-governed (immutable via APIs). Keys are stable, lowercase, dot-separated.
 * No wildcards. No role-name encoding. No tenant IDs.
 */

export type PlatformPermissionRisk = 'low' | 'medium' | 'high' | 'critical';
export type PlatformPermissionLifecycle = 'active' | 'reserved';

export interface PlatformPermissionDefinition {
  key: string;
  domain: string;
  action: string;
  description: string;
  risk: PlatformPermissionRisk;
  /** Soft expectation for API designers — enforcement is per-endpoint. */
  stepUpExpected: boolean;
  dualControlLater: boolean;
  lifecycle: PlatformPermissionLifecycle;
}

export type PlatformRoleScope = 'all' | 'assigned_only' | 'own' | 'read_only';

export interface PlatformRoleDefinition {
  key: string;
  displayName: string;
  description: string;
  scope: PlatformRoleScope;
  immutable: true;
  /** High-impact: assignment/removal requires step-up + safeguards. */
  highImpact: boolean;
  permissionKeys: readonly string[];
}

function p(
  key: string,
  description: string,
  risk: PlatformPermissionRisk,
  opts: { stepUpExpected?: boolean; dualControlLater?: boolean } = {},
): PlatformPermissionDefinition {
  const [domain, ...rest] = key.split('.');
  return {
    key,
    domain: domain ?? key,
    action: rest.join('.') || 'view',
    description,
    risk,
    stepUpExpected: opts.stepUpExpected ?? (risk === 'high' || risk === 'critical'),
    dualControlLater: opts.dualControlLater ?? false,
    lifecycle: 'active',
  };
}

/** Complete Step 08 catalog — including reserved keys for later domains. */
export const PLATFORM_PERMISSIONS: readonly PlatformPermissionDefinition[] = [
  // Platform User and Security
  p('platform-user.view', 'View Platform Users', 'low'),
  p('platform-user.create', 'Create Platform Users', 'high', { stepUpExpected: true }),
  p('platform-user.invite', 'Invite Platform Users', 'high', { stepUpExpected: true }),
  p('platform-user.activate', 'Activate Platform Users', 'medium'),
  p('platform-user.suspend', 'Suspend Platform Users', 'critical', { stepUpExpected: true }),
  p('platform-user.role.assign', 'Assign Platform Roles', 'critical', { stepUpExpected: true }),
  p('platform-user.role.remove', 'Remove Platform Roles', 'critical', { stepUpExpected: true }),
  p('platform-user.session.view', 'View another user sessions', 'medium'),
  p('platform-user.session.revoke', 'Revoke another user sessions', 'high', { stepUpExpected: true }),
  p('platform-user.mfa.reset-request', 'Request administrator MFA reset', 'high', { stepUpExpected: true }),
  p('platform-user.mfa.reset-approve', 'Approve administrator MFA reset', 'critical', {
    stepUpExpected: true,
    dualControlLater: true,
  }),
  p('platform-user.security.view', 'View Platform User security metadata', 'medium'),

  // Roles and Permissions
  p('platform-role.view', 'View built-in Platform Roles', 'low'),
  p('platform-role.assign', 'Assign built-in Platform Roles', 'critical', { stepUpExpected: true }),
  p('platform-permission.view', 'View Platform Permission catalog', 'low'),

  // Tenant (reserved)
  p('tenant.view', 'View tenants', 'low'),
  p('tenant.create', 'Create tenants', 'high', { stepUpExpected: true }),
  p('tenant.activate', 'Activate tenants', 'high', { stepUpExpected: true }),
  p('tenant.suspend', 'Suspend tenants', 'critical', { stepUpExpected: true }),
  p('tenant.resume', 'Resume tenants', 'high', { stepUpExpected: true }),
  p('tenant.archive-request', 'Request tenant archive', 'high', { dualControlLater: true }),
  p('tenant.delete-request', 'Request tenant delete', 'critical', { dualControlLater: true }),
  p('tenant.request.approve', 'Approve or reject tenant lifecycle requests', 'critical', {
    stepUpExpected: true,
    dualControlLater: true,
  }),
  // Flexible Step 17 — narrow onboarding permissions (not general subscription.migrate)
  p('tenant.provision.view', 'View tenant provisioning workflows', 'low'),
  p('tenant.provision.create', 'Create tenant provisioning requests', 'high', {
    stepUpExpected: true,
  }),
  p('tenant.provision.execute', 'Start tenant provisioning execution', 'high', {
    stepUpExpected: true,
  }),
  p('tenant.provision.retry', 'Retry tenant provisioning', 'high', { stepUpExpected: true }),
  p('tenant.provision.compensate', 'Compensate failed tenant provisioning', 'critical', {
    stepUpExpected: true,
  }),
  p('tenant.provision.activate', 'Finalize onboarding activation', 'critical', {
    stepUpExpected: true,
  }),

  // Catalog — kind-scoped. Lifecycle transitions still require fresh server step-up
  // via PlatformAssuranceService (permission risk remains medium for metadata edits).
  p('facility-type.view', 'View facility types', 'low'),
  p('facility-type.manage', 'Manage facility types', 'medium'),
  p('specialty.view', 'View specialties', 'low'),
  p('specialty.manage', 'Manage specialties', 'medium'),
  p('module.view', 'View modules', 'low'),
  p('module.manage', 'Manage modules', 'medium'),
  p('feature.view', 'View features', 'low'),
  p('feature.manage', 'Manage features', 'medium'),
  p('limit.view', 'View limits', 'low'),
  p('limit.manage', 'Manage limits', 'medium'),
  p('compatibility-rule.view', 'View compatibility rules', 'low'),
  p('compatibility-rule.manage', 'Manage compatibility rules', 'medium'),

  // Plans / commercial (Step 13)
  p('plan.view', 'View plans', 'low'),
  p('plan.create', 'Create plans', 'medium'),
  p('plan.edit', 'Edit plans', 'medium'),
  p('plan.lifecycle', 'Activate, archive, or reactivate plans', 'high', {
    stepUpExpected: true,
  }),
  p('plan.alias.manage', 'Manage plan legacy aliases', 'medium'),
  p('plan-version.view', 'View plan versions', 'low'),
  p('plan-version.create', 'Create plan versions', 'medium'),
  p('plan-version.review', 'Review plan version readiness', 'medium'),
  p('plan-version.publish', 'Publish plan versions', 'critical', {
    stepUpExpected: true,
    dualControlLater: true,
  }),
  p('plan-version.retire', 'Retire plan versions', 'high', { stepUpExpected: true }),
  // Step 14 — Plan Version commercial entitlements / Limits (not runtime)
  p('plan-entitlement.view', 'View plan version entitlements', 'low'),
  p('plan-entitlement.manage', 'Manage plan version entitlements', 'medium'),
  p('plan-limit.view', 'View plan version limit assignments', 'low'),
  p('plan-limit.manage', 'Manage plan version limit assignments', 'medium'),
  p('addon.view', 'View add-ons', 'low'),
  p('addon.manage', 'Manage add-ons', 'medium'),
  p('subscription.view', 'View subscriptions', 'low'),
  p('subscription.assign', 'Assign subscriptions', 'high', { stepUpExpected: true }),
  p('subscription.migrate', 'Migrate subscriptions', 'high', { stepUpExpected: true }),
  p('subscription.suspend', 'Suspend or resume commercial subscriptions', 'high', {
    stepUpExpected: true,
  }),
  p('subscription.cancel', 'Cancel commercial subscriptions', 'critical', {
    stepUpExpected: true,
  }),
  p('override.view', 'View overrides', 'low'),
  p('override.request', 'Request overrides', 'high'),
  p('override.approve', 'Approve overrides', 'critical', {
    stepUpExpected: true,
    dualControlLater: true,
  }),
  p('entitlement.view', 'View entitlements', 'low'),
  p('entitlement.explain', 'Explain entitlements', 'low'),
  p('usage.view', 'View tenant usage meters', 'low'),
  p('usage.reconcile', 'Reconcile tenant usage meters', 'high', { stepUpExpected: true }),

  // Flags / ops / audit — Flexible Step 20 operational controls (never commercial entitlement)
  p('feature-flag.view', 'View operational feature flags', 'low'),
  p('feature-flag.manage', 'Manage operational feature flags and targeting', 'high', {
    stepUpExpected: true,
  }),
  p('feature-flag.kill-switch', 'Activate or deactivate operational kill switches', 'critical', {
    stepUpExpected: true,
  }),
  p('settings.view', 'View platform global settings and safe references', 'low'),
  p('settings.manage', 'Manage safe non-secret global settings', 'high', { stepUpExpected: true }),
  p('settings.reference.manage', 'Update safe provider/reference status metadata', 'high', {
    stepUpExpected: true,
  }),
  p('operations.view', 'View operations', 'low'),
  p('operations.execute', 'Execute operations', 'critical', { stepUpExpected: true }),
  p('operations.backups.view', 'View backup operational metadata', 'low'),
  p('operations.integrations.view', 'View integration operational status', 'low'),
  p('operations.entitlement-health.view', 'View entitlement/cache operational health', 'low'),
  p('operations.cache.invalidate', 'Invalidate entitlement cache', 'critical', {
    stepUpExpected: true,
  }),
  p('audit.view', 'View audit evidence', 'medium'),
  p('audit.export', 'Export audit evidence', 'high', { stepUpExpected: true }),
  p('audit.sensitive.view', 'View sensitive entitlement-decision audit details', 'high'),
  p('audit.network-metadata.view', 'View unmasked audit network metadata', 'high'),

  // Sales (reserved)
  p('sales-representative.view', 'View sales representatives', 'low'),
  p('sales-representative.manage', 'Manage sales representatives', 'medium'),
  p('sales-lead.view', 'View sales leads', 'low'),
  p('sales-lead.manage', 'Manage sales leads', 'medium'),
  p('sales-lead.assign', 'Assign sales leads', 'medium'),
  p('sales-trial.create', 'Create sales trials', 'medium'),
  // Flexible Step 25 — governed Trial aggregate (entitlements stay Step 16/18 authority)
  p('trial.view', 'View governed sales trials', 'low'),
  p('trial.create', 'Create governed sales trials', 'medium'),
  p('trial.update', 'Update governed sales trial configuration', 'medium'),
  p('trial.extend', 'Extend a governed sales trial within policy', 'medium'),
  p('trial.extend.exceptional', 'Extend a governed sales trial beyond default policy', 'high', {
    stepUpExpected: true,
  }),
  p('trial.convert', 'Convert a governed sales trial to a published paid Plan Version', 'high', {
    stepUpExpected: true,
  }),
  p('trial.preview-entitlements', 'Preview trial vs paid entitlement comparison', 'low'),
  p('sales-customer.view', 'View sales customers', 'low'),
  p('sales-report.view', 'View sales reports', 'low'),
  p('sales-report.export', 'Export sales productivity reports', 'low'),
  p('commission-snapshot.view', 'View commission snapshots', 'low'),
  p('commission-snapshot.review', 'Review commission snapshots', 'medium'),
  p('commission-snapshot.generate', 'Generate commission snapshots', 'medium'),
  p('commission-snapshot.mark-paid', 'Mark commission snapshots paid (administrative)', 'high', {
    stepUpExpected: true,
  }),
  p('notifications.templates.view', 'View platform notification templates', 'low'),
  p('notifications.preferences.view', 'View platform notification preferences', 'low'),
  p('notifications.preferences.manage', 'Manage platform notification preferences', 'medium'),
  p('notifications.deliveries.view', 'View platform notification deliveries', 'low'),
  p('notifications.deliveries.retry', 'Retry platform notification deliveries', 'medium'),
];

const ALL_KEYS = PLATFORM_PERMISSIONS.map((x) => x.key);

const CATALOG_MANAGE = [
  'facility-type.view',
  'facility-type.manage',
  'specialty.view',
  'specialty.manage',
  'module.view',
  'module.manage',
  'feature.view',
  'feature.manage',
  'limit.view',
  'limit.manage',
  'compatibility-rule.view',
  'compatibility-rule.manage',
] as const;

const PLATFORM_USER_SECURITY = [
  'platform-user.view',
  'platform-user.create',
  'platform-user.invite',
  'platform-user.activate',
  'platform-user.suspend',
  'platform-user.role.assign',
  'platform-user.role.remove',
  'platform-user.session.view',
  'platform-user.session.revoke',
  'platform-user.mfa.reset-request',
  'platform-user.mfa.reset-approve',
  'platform-user.security.view',
  'platform-role.view',
  'platform-role.assign',
  'platform-permission.view',
] as const;

/** Built-in immutable roles — eight frozen roles. No wildcards. */
export const PLATFORM_ROLES: readonly PlatformRoleDefinition[] = [
  {
    key: 'platform_owner',
    displayName: 'Platform Owner',
    description: 'Broad governance visibility and selected governance actions. Not a wildcard bypass.',
    scope: 'all',
    immutable: true,
    highImpact: true,
    // Explicit grants — nearly all keys except none reserved-only gaps; still no "*".
    permissionKeys: ALL_KEYS.filter(
      (k) => !k.startsWith('sales-') && !k.startsWith('commission-snapshot.'),
    ),
  },
  {
    key: 'platform_administrator',
    displayName: 'Platform Administrator',
    description: 'Tenant lifecycle, approved configuration, operational coordination.',
    scope: 'all',
    immutable: true,
    highImpact: true,
    permissionKeys: [
      'platform-user.view',
      'platform-role.view',
      'platform-permission.view',
      'tenant.view',
      'tenant.create',
      'tenant.activate',
      'tenant.suspend',
      'tenant.resume',
      'tenant.archive-request',
      'tenant.delete-request',
      'tenant.request.approve',
      'tenant.provision.view',
      'tenant.provision.create',
      'tenant.provision.execute',
      'tenant.provision.retry',
      'tenant.provision.compensate',
      'tenant.provision.activate',
      ...CATALOG_MANAGE,
      'plan.view',
      'plan-version.view',
      'plan-entitlement.view',
      'plan-entitlement.manage',
      'plan-limit.view',
      'plan-limit.manage',
      'addon.view',
      'subscription.view',
      'usage.view',
      'usage.reconcile',
      'override.view',
      'entitlement.view',
      'entitlement.explain',
      'feature-flag.view',
      'feature-flag.manage',
      'feature-flag.kill-switch',
      'settings.view',
      'settings.manage',
      'settings.reference.manage',
      'operations.view',
      'audit.view',
      'notifications.templates.view',
      'notifications.preferences.view',
      'notifications.preferences.manage',
      'notifications.deliveries.view',
      'notifications.deliveries.retry',
      // Explicitly NO plan-version.publish, override.approve, platform-user.suspend, MFA reset approve
    ],
  },
  {
    key: 'security_administrator',
    displayName: 'Security Administrator',
    description: 'Platform User security, roles, sessions, MFA reset governance.',
    scope: 'all',
    immutable: true,
    highImpact: true,
    permissionKeys: [
      ...PLATFORM_USER_SECURITY,
      'audit.view',
      'audit.export',
      'audit.sensitive.view',
      'audit.network-metadata.view',
      'settings.view',
      // Security may view settings; no flag manage / kill-switch / reference.manage unless frozen later
    ],
  },
  {
    key: 'plans_subscription_manager',
    displayName: 'Plans & Subscription Manager',
    description: 'Catalog, plans, versions, add-ons, subscriptions, override requests.',
    scope: 'all',
    immutable: true,
    highImpact: true,
    permissionKeys: [
      ...CATALOG_MANAGE,
      'plan.view',
      'plan.create',
      'plan.edit',
      'plan.lifecycle',
      'plan.alias.manage',
      'plan-version.view',
      'plan-version.create',
      'plan-version.review',
      'plan-version.publish',
      'plan-version.retire',
      'plan-entitlement.view',
      'plan-entitlement.manage',
      'plan-limit.view',
      'plan-limit.manage',
      'addon.view',
      'addon.manage',
      'subscription.view',
      'usage.view',
      'usage.reconcile',
      'subscription.assign',
      'subscription.migrate',
      'subscription.suspend',
      'subscription.cancel',
      'override.view',
      'override.request',
      // override.approve NOT granted
      'entitlement.view',
      'entitlement.explain',
    ],
  },
  {
    key: 'sales_manager',
    displayName: 'Sales Manager',
    description: 'Representatives, leads, reporting, trials, commission review.',
    scope: 'all',
    immutable: true,
    highImpact: false,
    permissionKeys: [
      'sales-representative.view',
      'sales-representative.manage',
      'sales-lead.view',
      'sales-lead.manage',
      'sales-lead.assign',
      'sales-trial.create',
      'trial.view',
      'trial.create',
      'trial.update',
      'trial.extend',
      'trial.extend.exceptional',
      'trial.convert',
      'trial.preview-entitlements',
      'sales-customer.view',
      'sales-report.view',
      'sales-report.export',
      'commission-snapshot.view',
      'commission-snapshot.review',
      'commission-snapshot.generate',
      'commission-snapshot.mark-paid',
      'tenant.view',
      'plan.view',
      'subscription.view',
      'usage.view',
      'tenant.provision.view',
    ],
  },
  {
    key: 'sales_representative',
    displayName: 'Sales Representative',
    description: 'Assigned sales records only (scope foundation; records in later steps).',
    scope: 'assigned_only',
    immutable: true,
    highImpact: false,
    permissionKeys: [
      'sales-lead.view',
      'sales-lead.manage',
      'sales-trial.create',
      // Flexible Step 25 — assigned-only Trial governance; no extend/convert authority.
      'trial.view',
      'trial.create',
      'trial.update',
      'trial.preview-entitlements',
      'sales-customer.view',
      'sales-report.view',
      'sales-report.export',
      // Flexible Step 26 — own-scope productivity/snapshot read + export only.
      'commission-snapshot.view',
      'plan.view',
      'tenant.view',
      'tenant.provision.view',
    ],
  },
  {
    key: 'operations_engineer',
    displayName: 'Operations Engineer',
    description: 'Operational health, jobs, queues, backups, integrations.',
    scope: 'all',
    immutable: true,
    highImpact: false,
    permissionKeys: [
      'operations.view',
      'operations.execute',
      'operations.backups.view',
      'operations.integrations.view',
      'operations.entitlement-health.view',
      'operations.cache.invalidate',
      'settings.view',
      'settings.manage',
      'audit.view',
      'feature-flag.view',
      'feature-flag.manage',
      // Explicitly NO feature-flag.kill-switch (distinct SoD)
      'tenant.view',
      'tenant.provision.view',
      'tenant.provision.retry',
    ],
  },
  {
    key: 'auditor',
    displayName: 'Auditor',
    description: 'Read-only audit, configuration history, entitlement evidence.',
    scope: 'read_only',
    immutable: true,
    highImpact: false,
    permissionKeys: [
      'audit.view',
      'audit.export',
      'audit.sensitive.view',
      'audit.network-metadata.view',
      'entitlement.view',
      'entitlement.explain',
      'platform-user.view',
      'platform-role.view',
      'platform-permission.view',
      'tenant.view',
      'plan.view',
      'plan-version.view',
      'plan-entitlement.view',
      'plan-limit.view',
      'subscription.view',
      'usage.view',
      'override.view',
      'settings.view',
      'feature-flag.view',
      'facility-type.view',
      'specialty.view',
      'module.view',
      'feature.view',
      'limit.view',
      'compatibility-rule.view',
    ],
  },
];

export const PLATFORM_PERMISSION_KEY_SET = new Set(ALL_KEYS);
export const PLATFORM_ROLE_KEY_SET = new Set(PLATFORM_ROLES.map((r) => r.key));

export const HIGH_IMPACT_ROLE_KEYS = new Set(
  PLATFORM_ROLES.filter((r) => r.highImpact).map((r) => r.key),
);

export function getPlatformPermission(key: string): PlatformPermissionDefinition | undefined {
  return PLATFORM_PERMISSIONS.find((p) => p.key === key);
}

export function getPlatformRole(key: string): PlatformRoleDefinition | undefined {
  return PLATFORM_ROLES.find((r) => r.key === key);
}

export function permissionsForRoles(roleKeys: readonly string[]): string[] {
  const set = new Set<string>();
  for (const key of roleKeys) {
    const role = getPlatformRole(key);
    if (!role) continue;
    for (const perm of role.permissionKeys) set.add(perm);
  }
  return [...set].sort();
}

/** Fail closed: unknown permission keys never grant access. */
export function isKnownActivePermission(key: string): boolean {
  const def = getPlatformPermission(key);
  return !!def && def.lifecycle === 'active';
}

export function assertNoWildcards(): void {
  for (const role of PLATFORM_ROLES) {
    for (const perm of role.permissionKeys) {
      if (perm === '*' || perm.includes('*')) {
        throw new Error(`Wildcard permission forbidden on role ${role.key}`);
      }
      if (!PLATFORM_PERMISSION_KEY_SET.has(perm)) {
        throw new Error(`Unknown permission ${perm} on role ${role.key}`);
      }
    }
  }
}

assertNoWildcards();
