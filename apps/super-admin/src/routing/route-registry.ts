/**
 * Step 09 — Super Admin route registry.
 *
 * Single source of truth for every route the shell can render: its path,
 * navigation placement, i18n keys, and access policy. Nothing here ever
 * references a role name — access is always expressed as permission keys
 * evaluated by `evaluatePermissionPolicy`.
 */
import {
  evaluatePermissionPolicy,
  isValidPermissionPolicy,
  type PermissionPolicy,
  type PolicyPrincipal,
} from './permission-policy';

export type SuperAdminNavGroup = 'overview' | 'platform' | 'administration' | 'operations' | 'sales';

export type SuperAdminRouteId =
  | 'login'
  | 'activate'
  | 'unauthorized'
  | 'mfa-enroll'
  | 'mfa-challenge'
  | 'overview'
  | 'tenants'
  | 'tenants-detail'
  | 'tenant-onboarding'
  | 'tenant-onboarding-detail'
  | 'catalog'
  | 'plans'
  | 'plans-new'
  | 'plans-legacy'
  | 'plans-detail'
  | 'plans-edit'
  | 'plans-version-new'
  | 'plans-version'
  | 'plans-version-edit'
  | 'plans-version-compare'
  | 'add-ons'
  | 'add-ons-new'
  | 'add-ons-detail'
  | 'add-ons-version'
  | 'add-ons-version-entitlements'
  | 'add-ons-version-limits'
  | 'add-ons-version-applicability'
  | 'add-ons-version-readiness'
  | 'add-ons-version-compare'
  | 'commercial-overrides'
  | 'commercial-overrides-new'
  | 'commercial-overrides-detail'
  | 'commercial-overrides-readiness'
  | 'commercial-overrides-compare'
  | 'commercial-composition-preview'
  | 'subscriptions'
  | 'subscriptions-new'
  | 'subscriptions-detail'
  | 'subscriptions-plan'
  | 'subscriptions-addons'
  | 'subscriptions-overrides'
  | 'subscriptions-dates'
  | 'subscriptions-readiness'
  | 'subscriptions-preview'
  | 'subscriptions-history'
  | 'subscriptions-compare'
  | 'subscriptions-runtime'
  | 'platform-users'
  | 'platform-users-invite'
  | 'platform-users-detail'
  | 'roles'
  | 'mfa-reset-approve'
  | 'security'
  | 'operations'
  | 'audit'
  | 'sales'
  | 'sales-representatives-new'
  | 'sales-representatives-detail'
  | 'sales-leads'
  | 'sales-leads-new'
  | 'sales-leads-detail'
  | 'sales-trials'
  | 'sales-trials-new'
  | 'sales-trials-detail'
  | 'sales-productivity'
  | 'sales-productivity-team'
  | 'sales-commission-snapshots'
  | 'sales-commission-snapshots-detail'
  | 'settings'
  | 'feature-flags-new'
  | 'feature-flags-detail'
  | 'global-settings-detail'
  | 'not-found';

export interface SuperAdminRouteDefinition {
  readonly id: SuperAdminRouteId;
  readonly path: string;
  readonly titleKey: string;
  readonly descriptionKey?: string;
  readonly navLabelKey?: string;
  readonly navGroup?: SuperAdminNavGroup;
  readonly icon?: string;
  readonly policy: PermissionPolicy;
  readonly showInNav: boolean;
  readonly breadcrumbParentId?: SuperAdminRouteId;
  readonly layout: 'app' | 'auth' | 'bare';
  readonly step?: number;
  readonly status: 'available' | 'placeholder';
  readonly securitySensitive?: boolean;
}

/**
 * NOTE: intentionally no `home` (`/`) entry. The index route resolves to
 * the caller's default landing page at render time via
 * `resolveDefaultRoutePath` instead of rendering a static placeholder.
 */
export const SUPER_ADMIN_ROUTES: readonly SuperAdminRouteDefinition[] = [
  {
    id: 'login',
    path: '/login',
    titleKey: 'routes.login.title',
    policy: { type: 'public' },
    showInNav: false,
    layout: 'auth',
    status: 'available',
  },
  {
    id: 'activate',
    path: '/activate',
    titleKey: 'routes.activate.title',
    policy: { type: 'public' },
    showInNav: false,
    layout: 'auth',
    status: 'available',
  },
  {
    id: 'unauthorized',
    path: '/unauthorized',
    titleKey: 'routes.unauthorized.title',
    policy: { type: 'public' },
    showInNav: false,
    layout: 'bare',
    status: 'available',
  },
  {
    id: 'mfa-enroll',
    path: '/mfa/enroll',
    titleKey: 'routes.mfaEnroll.title',
    policy: { type: 'authenticated' },
    showInNav: false,
    layout: 'auth',
    status: 'available',
  },
  {
    id: 'mfa-challenge',
    path: '/mfa/challenge',
    titleKey: 'routes.mfaChallenge.title',
    policy: { type: 'authenticated' },
    showInNav: false,
    layout: 'auth',
    status: 'available',
  },
  {
    id: 'overview',
    path: '/overview',
    titleKey: 'routes.overview.title',
    descriptionKey: 'routes.overview.description',
    navLabelKey: 'nav.overview',
    navGroup: 'overview',
    icon: 'layout-dashboard',
    policy: { type: 'authenticated' },
    showInNav: true,
    layout: 'app',
    step: 10,
    status: 'available',
  },
  {
    id: 'tenants',
    path: '/tenants',
    titleKey: 'routes.tenants.title',
    descriptionKey: 'routes.tenants.description',
    navLabelKey: 'nav.tenants',
    navGroup: 'platform',
    icon: 'building',
    policy: { type: 'permission', permission: 'tenant.view' },
    showInNav: true,
    layout: 'app',
    step: 11,
    status: 'available',
  },
  {
    id: 'tenants-detail',
    path: '/tenants/:tenantId',
    titleKey: 'routes.tenantsDetail.title',
    policy: { type: 'permission', permission: 'tenant.view' },
    showInNav: false,
    breadcrumbParentId: 'tenants',
    layout: 'app',
    step: 11,
    status: 'available',
  },
  {
    id: 'tenant-onboarding',
    path: '/tenants/onboarding',
    titleKey: 'routes.tenantOnboarding.title',
    descriptionKey: 'routes.tenantOnboarding.description',
    navLabelKey: 'nav.tenantOnboarding',
    navGroup: 'platform',
    icon: 'building',
    policy: {
      type: 'anyOf',
      permissions: ['tenant.provision.create', 'sales-trial.create'],
    },
    showInNav: true,
    layout: 'app',
    step: 17,
    status: 'available',
  },
  {
    id: 'tenant-onboarding-detail',
    path: '/tenants/onboarding/:requestId',
    titleKey: 'routes.tenantOnboardingDetail.title',
    policy: { type: 'permission', permission: 'tenant.provision.view' },
    showInNav: false,
    breadcrumbParentId: 'tenant-onboarding',
    layout: 'app',
    step: 17,
    status: 'available',
  },
  {
    id: 'catalog',
    path: '/catalog',
    titleKey: 'routes.catalog.title',
    descriptionKey: 'routes.catalog.description',
    navLabelKey: 'nav.catalog',
    navGroup: 'platform',
    icon: 'library',
    policy: {
      type: 'anyOf',
      permissions: [
        'facility-type.view',
        'specialty.view',
        'module.view',
        'feature.view',
        'limit.view',
        'compatibility-rule.view',
      ],
    },
    showInNav: true,
    layout: 'app',
    step: 12,
    status: 'available',
  },
  {
    id: 'plans',
    path: '/plans',
    titleKey: 'routes.plans.title',
    descriptionKey: 'routes.plans.description',
    navLabelKey: 'nav.plans',
    navGroup: 'platform',
    icon: 'layers',
    policy: { type: 'anyOf', permissions: ['plan.view', 'subscription.view'] },
    showInNav: true,
    layout: 'app',
    step: 13,
    status: 'available',
  },
  {
    id: 'plans-new',
    path: '/plans/new',
    titleKey: 'routes.plansNew.title',
    policy: { type: 'permission', permission: 'plan.create' },
    showInNav: false,
    breadcrumbParentId: 'plans',
    layout: 'app',
    step: 13,
    status: 'available',
  },
  {
    id: 'plans-legacy',
    path: '/plans/legacy-mappings',
    titleKey: 'routes.plansLegacy.title',
    navLabelKey: 'nav.plansLegacy',
    navGroup: 'platform',
    policy: { type: 'permission', permission: 'plan.view' },
    showInNav: false,
    breadcrumbParentId: 'plans',
    layout: 'app',
    step: 13,
    status: 'available',
  },
  {
    id: 'plans-detail',
    path: '/plans/:planId',
    titleKey: 'routes.plansDetail.title',
    policy: { type: 'permission', permission: 'plan.view' },
    showInNav: false,
    breadcrumbParentId: 'plans',
    layout: 'app',
    step: 13,
    status: 'available',
  },
  {
    id: 'plans-edit',
    path: '/plans/:planId/edit',
    titleKey: 'routes.plansEdit.title',
    policy: { type: 'permission', permission: 'plan.edit' },
    showInNav: false,
    breadcrumbParentId: 'plans-detail',
    layout: 'app',
    step: 13,
    status: 'available',
  },
  {
    id: 'plans-version-new',
    path: '/plans/:planId/versions/new',
    titleKey: 'routes.plansVersionNew.title',
    policy: { type: 'permission', permission: 'plan-version.create' },
    showInNav: false,
    breadcrumbParentId: 'plans-detail',
    layout: 'app',
    step: 13,
    status: 'available',
  },
  {
    id: 'plans-version-compare',
    path: '/plans/:planId/versions/:versionId/compare',
    titleKey: 'routes.plansVersionCompare.title',
    policy: { type: 'permission', permission: 'plan-version.view' },
    showInNav: false,
    breadcrumbParentId: 'plans-version',
    layout: 'app',
    step: 13,
    status: 'available',
  },
  {
    id: 'plans-version-edit',
    path: '/plans/:planId/versions/:versionId/edit',
    titleKey: 'routes.plansVersionEdit.title',
    policy: { type: 'permission', permission: 'plan-version.create' },
    showInNav: false,
    breadcrumbParentId: 'plans-version',
    layout: 'app',
    step: 13,
    status: 'available',
  },
  {
    id: 'plans-version',
    path: '/plans/:planId/versions/:versionId',
    titleKey: 'routes.plansVersion.title',
    policy: { type: 'permission', permission: 'plan-version.view' },
    showInNav: false,
    breadcrumbParentId: 'plans-detail',
    layout: 'app',
    step: 13,
    status: 'available',
  },
  {
    id: 'add-ons',
    path: '/add-ons',
    titleKey: 'routes.addOns.title',
    descriptionKey: 'routes.addOns.description',
    navLabelKey: 'nav.addOns',
    navGroup: 'platform',
    icon: 'package-plus',
    policy: { type: 'permission', permission: 'addon.view' },
    showInNav: true,
    layout: 'app',
    step: 15,
    status: 'available',
  },
  {
    id: 'add-ons-new',
    path: '/add-ons/new',
    titleKey: 'routes.addOnsNew.title',
    policy: { type: 'permission', permission: 'addon.manage' },
    showInNav: false,
    breadcrumbParentId: 'add-ons',
    layout: 'app',
    step: 15,
    status: 'available',
  },
  {
    id: 'add-ons-version-entitlements',
    path: '/add-ons/:addOnId/versions/:versionId/entitlements',
    titleKey: 'routes.addOnsVersionEntitlements.title',
    policy: { type: 'permission', permission: 'addon.view' },
    showInNav: false,
    breadcrumbParentId: 'add-ons-version',
    layout: 'app',
    step: 15,
    status: 'available',
  },
  {
    id: 'add-ons-version-limits',
    path: '/add-ons/:addOnId/versions/:versionId/limits',
    titleKey: 'routes.addOnsVersionLimits.title',
    policy: { type: 'permission', permission: 'addon.view' },
    showInNav: false,
    breadcrumbParentId: 'add-ons-version',
    layout: 'app',
    step: 15,
    status: 'available',
  },
  {
    id: 'add-ons-version-applicability',
    path: '/add-ons/:addOnId/versions/:versionId/applicability',
    titleKey: 'routes.addOnsVersionApplicability.title',
    policy: { type: 'permission', permission: 'addon.view' },
    showInNav: false,
    breadcrumbParentId: 'add-ons-version',
    layout: 'app',
    step: 15,
    status: 'available',
  },
  {
    id: 'add-ons-version-readiness',
    path: '/add-ons/:addOnId/versions/:versionId/readiness',
    titleKey: 'routes.addOnsVersionReadiness.title',
    policy: { type: 'permission', permission: 'addon.view' },
    showInNav: false,
    breadcrumbParentId: 'add-ons-version',
    layout: 'app',
    step: 15,
    status: 'available',
  },
  {
    id: 'add-ons-version-compare',
    path: '/add-ons/:addOnId/versions/:versionId/compare',
    titleKey: 'routes.addOnsVersionCompare.title',
    policy: { type: 'permission', permission: 'addon.view' },
    showInNav: false,
    breadcrumbParentId: 'add-ons-version',
    layout: 'app',
    step: 15,
    status: 'available',
  },
  {
    id: 'add-ons-version',
    path: '/add-ons/:addOnId/versions/:versionId',
    titleKey: 'routes.addOnsVersion.title',
    descriptionKey: 'routes.addOnsVersion.description',
    policy: { type: 'permission', permission: 'addon.view' },
    showInNav: false,
    breadcrumbParentId: 'add-ons-detail',
    layout: 'app',
    step: 15,
    status: 'available',
  },
  {
    id: 'add-ons-detail',
    path: '/add-ons/:addOnId',
    titleKey: 'routes.addOnsDetail.title',
    policy: { type: 'permission', permission: 'addon.view' },
    showInNav: false,
    breadcrumbParentId: 'add-ons',
    layout: 'app',
    step: 15,
    status: 'available',
  },
  {
    id: 'commercial-overrides',
    path: '/commercial-overrides',
    titleKey: 'routes.commercialOverrides.title',
    descriptionKey: 'routes.commercialOverrides.description',
    navLabelKey: 'nav.commercialOverrides',
    navGroup: 'platform',
    icon: 'sliders',
    policy: { type: 'permission', permission: 'override.view' },
    showInNav: true,
    layout: 'app',
    step: 15,
    status: 'available',
  },
  {
    id: 'commercial-overrides-new',
    path: '/commercial-overrides/new',
    titleKey: 'routes.commercialOverridesNew.title',
    policy: { type: 'permission', permission: 'override.request' },
    showInNav: false,
    breadcrumbParentId: 'commercial-overrides',
    layout: 'app',
    step: 15,
    status: 'available',
  },
  {
    id: 'commercial-overrides-readiness',
    path: '/commercial-overrides/:overrideId/readiness',
    titleKey: 'routes.commercialOverridesReadiness.title',
    policy: { type: 'permission', permission: 'override.view' },
    showInNav: false,
    breadcrumbParentId: 'commercial-overrides-detail',
    layout: 'app',
    step: 15,
    status: 'available',
  },
  {
    id: 'commercial-overrides-compare',
    path: '/commercial-overrides/:overrideId/compare',
    titleKey: 'routes.commercialOverridesCompare.title',
    policy: { type: 'permission', permission: 'override.view' },
    showInNav: false,
    breadcrumbParentId: 'commercial-overrides-detail',
    layout: 'app',
    step: 15,
    status: 'available',
  },
  {
    id: 'commercial-overrides-detail',
    path: '/commercial-overrides/:overrideId',
    titleKey: 'routes.commercialOverridesDetail.title',
    policy: { type: 'permission', permission: 'override.view' },
    showInNav: false,
    breadcrumbParentId: 'commercial-overrides',
    layout: 'app',
    step: 15,
    status: 'available',
  },
  {
    id: 'commercial-composition-preview',
    path: '/commercial-composition/preview',
    titleKey: 'routes.compositionPreview.title',
    descriptionKey: 'routes.compositionPreview.description',
    navLabelKey: 'nav.compositionPreview',
    navGroup: 'platform',
    icon: 'layers-2',
    policy: {
      type: 'anyOf',
      permissions: ['addon.view', 'override.view', 'plan.view'],
    },
    showInNav: true,
    layout: 'app',
    step: 15,
    status: 'available',
  },
  {
    id: 'subscriptions',
    path: '/subscriptions',
    titleKey: 'routes.subscriptions.title',
    descriptionKey: 'routes.subscriptions.description',
    navLabelKey: 'nav.subscriptions',
    navGroup: 'platform',
    icon: 'credit-card',
    policy: { type: 'permission', permission: 'subscription.view' },
    showInNav: true,
    layout: 'app',
    step: 16,
    status: 'available',
  },
  {
    id: 'subscriptions-new',
    path: '/subscriptions/new',
    titleKey: 'routes.subscriptionsNew.title',
    policy: { type: 'permission', permission: 'subscription.assign' },
    showInNav: false,
    breadcrumbParentId: 'subscriptions',
    layout: 'app',
    step: 16,
    status: 'available',
  },
  {
    id: 'subscriptions-detail',
    path: '/subscriptions/:subscriptionId',
    titleKey: 'routes.subscriptionsDetail.title',
    policy: { type: 'permission', permission: 'subscription.view' },
    showInNav: false,
    breadcrumbParentId: 'subscriptions',
    layout: 'app',
    step: 16,
    status: 'available',
  },
  {
    id: 'subscriptions-plan',
    path: '/subscriptions/:subscriptionId/plan',
    titleKey: 'routes.subscriptionsPlan.title',
    policy: { type: 'permission', permission: 'subscription.view' },
    showInNav: false,
    breadcrumbParentId: 'subscriptions-detail',
    layout: 'app',
    step: 16,
    status: 'available',
  },
  {
    id: 'subscriptions-addons',
    path: '/subscriptions/:subscriptionId/add-ons',
    titleKey: 'routes.subscriptionsAddOns.title',
    policy: { type: 'permission', permission: 'subscription.view' },
    showInNav: false,
    breadcrumbParentId: 'subscriptions-detail',
    layout: 'app',
    step: 16,
    status: 'available',
  },
  {
    id: 'subscriptions-overrides',
    path: '/subscriptions/:subscriptionId/overrides',
    titleKey: 'routes.subscriptionsOverrides.title',
    policy: { type: 'permission', permission: 'subscription.view' },
    showInNav: false,
    breadcrumbParentId: 'subscriptions-detail',
    layout: 'app',
    step: 16,
    status: 'available',
  },
  {
    id: 'subscriptions-dates',
    path: '/subscriptions/:subscriptionId/dates',
    titleKey: 'routes.subscriptionsDates.title',
    policy: { type: 'permission', permission: 'subscription.view' },
    showInNav: false,
    breadcrumbParentId: 'subscriptions-detail',
    layout: 'app',
    step: 16,
    status: 'available',
  },
  {
    id: 'subscriptions-readiness',
    path: '/subscriptions/:subscriptionId/readiness',
    titleKey: 'routes.subscriptionsReadiness.title',
    policy: { type: 'permission', permission: 'subscription.view' },
    showInNav: false,
    breadcrumbParentId: 'subscriptions-detail',
    layout: 'app',
    step: 16,
    status: 'available',
  },
  {
    id: 'subscriptions-preview',
    path: '/subscriptions/:subscriptionId/preview',
    titleKey: 'routes.subscriptionsPreview.title',
    policy: { type: 'permission', permission: 'subscription.view' },
    showInNav: false,
    breadcrumbParentId: 'subscriptions-detail',
    layout: 'app',
    step: 16,
    status: 'available',
  },
  {
    id: 'subscriptions-history',
    path: '/subscriptions/:subscriptionId/history',
    titleKey: 'routes.subscriptionsHistory.title',
    policy: { type: 'permission', permission: 'subscription.view' },
    showInNav: false,
    breadcrumbParentId: 'subscriptions-detail',
    layout: 'app',
    step: 16,
    status: 'available',
  },
  {
    id: 'subscriptions-compare',
    path: '/subscriptions/:subscriptionId/compare',
    titleKey: 'routes.subscriptionsCompare.title',
    policy: { type: 'permission', permission: 'subscription.view' },
    showInNav: false,
    breadcrumbParentId: 'subscriptions-detail',
    layout: 'app',
    step: 16,
    status: 'available',
  },
  {
    id: 'subscriptions-runtime',
    path: '/subscriptions/:subscriptionId/runtime',
    titleKey: 'routes.subscriptionsRuntime.title',
    policy: { type: 'permission', permission: 'subscription.view' },
    showInNav: false,
    breadcrumbParentId: 'subscriptions-detail',
    layout: 'app',
    step: 17,
    status: 'available',
  },
  {
    id: 'platform-users',
    path: '/platform-users',
    titleKey: 'routes.platformUsers.title',
    descriptionKey: 'routes.platformUsers.description',
    navLabelKey: 'nav.platformUsers',
    navGroup: 'administration',
    icon: 'users',
    policy: { type: 'permission', permission: 'platform-user.view' },
    showInNav: true,
    layout: 'app',
    status: 'available',
  },
  {
    id: 'platform-users-invite',
    path: '/platform-users/invite',
    titleKey: 'routes.platformUsersInvite.title',
    policy: { type: 'permission', permission: 'platform-user.invite' },
    showInNav: false,
    breadcrumbParentId: 'platform-users',
    layout: 'app',
    status: 'available',
  },
  {
    id: 'platform-users-detail',
    path: '/platform-users/:id',
    titleKey: 'routes.platformUsersDetail.title',
    policy: { type: 'permission', permission: 'platform-user.view' },
    showInNav: false,
    breadcrumbParentId: 'platform-users',
    layout: 'app',
    status: 'available',
  },
  {
    id: 'roles',
    path: '/roles',
    titleKey: 'routes.roles.title',
    descriptionKey: 'routes.roles.description',
    navLabelKey: 'nav.roles',
    navGroup: 'administration',
    icon: 'shield',
    policy: {
      type: 'anyOf',
      permissions: ['platform-role.view', 'platform-permission.view'],
    },
    showInNav: true,
    layout: 'app',
    status: 'available',
  },
  {
    id: 'mfa-reset-approve',
    path: '/mfa-reset-requests/:requestId',
    titleKey: 'routes.mfaResetApprove.title',
    policy: { type: 'permission', permission: 'platform-user.mfa.reset-approve' },
    showInNav: false,
    layout: 'app',
    status: 'available',
    securitySensitive: true,
  },
  {
    id: 'security',
    path: '/security',
    titleKey: 'routes.security.title',
    descriptionKey: 'routes.security.description',
    policy: { type: 'authenticated' },
    showInNav: false,
    layout: 'app',
    status: 'available',
  },
  {
    id: 'operations',
    path: '/operations',
    titleKey: 'routes.operations.title',
    descriptionKey: 'routes.operations.description',
    navLabelKey: 'nav.operations',
    navGroup: 'operations',
    icon: 'activity',
    policy: { type: 'permission', permission: 'operations.view' },
    showInNav: true,
    layout: 'app',
    step: 22,
    status: 'available',
  },
  {
    id: 'audit',
    path: '/audit',
    titleKey: 'routes.audit.title',
    descriptionKey: 'routes.audit.description',
    navLabelKey: 'nav.audit',
    navGroup: 'operations',
    icon: 'file-search',
    policy: { type: 'permission', permission: 'audit.view' },
    showInNav: true,
    layout: 'app',
    step: 21,
    status: 'available',
  },
  {
    id: 'sales',
    path: '/sales',
    titleKey: 'routes.sales.title',
    descriptionKey: 'routes.sales.description',
    navLabelKey: 'nav.sales',
    navGroup: 'sales',
    icon: 'briefcase',
    policy: { type: 'permission', permission: 'sales-representative.view' },
    showInNav: true,
    layout: 'app',
    step: 23,
    status: 'available',
  },
  {
    id: 'sales-representatives-new',
    path: '/sales/new',
    titleKey: 'routes.salesRepresentativesNew.title',
    policy: { type: 'permission', permission: 'sales-representative.manage' },
    showInNav: false,
    breadcrumbParentId: 'sales',
    layout: 'app',
    step: 23,
    status: 'available',
  },
  {
    id: 'sales-representatives-detail',
    path: '/sales/:id',
    titleKey: 'routes.salesRepresentativesDetail.title',
    policy: { type: 'permission', permission: 'sales-representative.view' },
    showInNav: false,
    breadcrumbParentId: 'sales',
    layout: 'app',
    step: 23,
    status: 'available',
  },
  {
    id: 'sales-leads',
    path: '/sales/leads',
    titleKey: 'routes.salesLeads.title',
    descriptionKey: 'routes.salesLeads.description',
    navLabelKey: 'nav.salesLeads',
    navGroup: 'sales',
    icon: 'pipeline',
    policy: { type: 'permission', permission: 'sales-lead.view' },
    showInNav: true,
    layout: 'app',
    step: 24,
    status: 'available',
  },
  {
    id: 'sales-leads-new',
    path: '/sales/leads/new',
    titleKey: 'routes.salesLeadsNew.title',
    policy: { type: 'permission', permission: 'sales-lead.manage' },
    showInNav: false,
    breadcrumbParentId: 'sales-leads',
    layout: 'app',
    step: 24,
    status: 'available',
  },
  {
    id: 'sales-leads-detail',
    path: '/sales/leads/:id',
    titleKey: 'routes.salesLeadsDetail.title',
    policy: { type: 'permission', permission: 'sales-lead.view' },
    showInNav: false,
    breadcrumbParentId: 'sales-leads',
    layout: 'app',
    step: 24,
    status: 'available',
  },
  {
    id: 'sales-trials',
    path: '/sales/trials',
    titleKey: 'routes.salesTrials.title',
    descriptionKey: 'routes.salesTrials.description',
    navLabelKey: 'nav.salesTrials',
    navGroup: 'sales',
    icon: 'trial',
    policy: { type: 'permission', permission: 'trial.view' },
    showInNav: true,
    layout: 'app',
    step: 25,
    status: 'available',
  },
  {
    id: 'sales-trials-new',
    path: '/sales/trials/new',
    titleKey: 'routes.salesTrialsNew.title',
    policy: { type: 'permission', permission: 'trial.create' },
    showInNav: false,
    breadcrumbParentId: 'sales-trials',
    layout: 'app',
    step: 25,
    status: 'available',
  },
  {
    id: 'sales-trials-detail',
    path: '/sales/trials/:id',
    titleKey: 'routes.salesTrialsDetail.title',
    policy: { type: 'permission', permission: 'trial.view' },
    showInNav: false,
    breadcrumbParentId: 'sales-trials',
    layout: 'app',
    step: 25,
    status: 'available',
  },
  {
    id: 'sales-productivity',
    path: '/sales/productivity',
    titleKey: 'routes.salesProductivity.title',
    descriptionKey: 'routes.salesProductivity.description',
    navLabelKey: 'nav.salesProductivity',
    navGroup: 'sales',
    icon: 'chart',
    policy: { type: 'permission', permission: 'sales-report.view' },
    showInNav: true,
    layout: 'app',
    step: 26,
    status: 'available',
  },
  {
    id: 'sales-productivity-team',
    path: '/sales/productivity/team',
    titleKey: 'routes.salesProductivityTeam.title',
    descriptionKey: 'routes.salesProductivityTeam.description',
    navLabelKey: 'nav.salesProductivityTeam',
    navGroup: 'sales',
    icon: 'chart',
    policy: { type: 'permission', permission: 'sales-report.view' },
    showInNav: true,
    layout: 'app',
    step: 26,
    status: 'available',
  },
  {
    id: 'sales-commission-snapshots',
    path: '/sales/commission-snapshots',
    titleKey: 'routes.salesCommissionSnapshots.title',
    descriptionKey: 'routes.salesCommissionSnapshots.description',
    navLabelKey: 'nav.salesCommissionSnapshots',
    navGroup: 'sales',
    icon: 'receipt',
    policy: { type: 'permission', permission: 'commission-snapshot.view' },
    showInNav: true,
    layout: 'app',
    step: 26,
    status: 'available',
  },
  {
    id: 'sales-commission-snapshots-detail',
    path: '/sales/commission-snapshots/:id',
    titleKey: 'routes.salesCommissionSnapshotsDetail.title',
    policy: { type: 'permission', permission: 'commission-snapshot.view' },
    showInNav: false,
    breadcrumbParentId: 'sales-commission-snapshots',
    layout: 'app',
    step: 26,
    status: 'available',
  },
  {
    id: 'settings',
    path: '/settings',
    titleKey: 'routes.settings.title',
    descriptionKey: 'routes.settings.description',
    navLabelKey: 'nav.settings',
    navGroup: 'administration',
    icon: 'settings',
    policy: {
      type: 'anyOf',
      permissions: ['feature-flag.view', 'settings.view'],
    },
    showInNav: true,
    layout: 'app',
    step: 20,
    status: 'available',
  },
  {
    id: 'feature-flags-new',
    path: '/settings/flags/new',
    titleKey: 'pages.featureFlags.create',
    policy: { type: 'permission', permission: 'feature-flag.manage' },
    showInNav: false,
    layout: 'app',
    breadcrumbParentId: 'settings',
    step: 20,
    status: 'available',
    securitySensitive: true,
  },
  {
    id: 'feature-flags-detail',
    path: '/settings/flags/:flagId',
    titleKey: 'pages.featureFlags.detailTitle',
    policy: { type: 'permission', permission: 'feature-flag.view' },
    showInNav: false,
    layout: 'app',
    breadcrumbParentId: 'settings',
    step: 20,
    status: 'available',
  },
  {
    id: 'global-settings-detail',
    path: '/settings/global/:settingKey',
    titleKey: 'pages.featureFlags.settingsTitle',
    policy: { type: 'permission', permission: 'settings.view' },
    showInNav: false,
    layout: 'app',
    breadcrumbParentId: 'settings',
    step: 20,
    status: 'available',
  },
  {
    id: 'not-found',
    path: '/not-found',
    titleKey: 'routes.notFound.title',
    policy: { type: 'authenticated' },
    showInNav: false,
    layout: 'app',
    status: 'available',
  },
] as const;

const FORBIDDEN_ROUTE_FIELDS = ['role', 'roles', 'roleName', 'roleNames', 'requiredRole', 'requiredRoles'];

function normalizePath(pathname: string): string {
  const withoutQuery = pathname.split('?')[0]?.split('#')[0] ?? pathname;
  if (withoutQuery.length > 1 && withoutQuery.endsWith('/')) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery || '/';
}

function pathToPattern(path: string): RegExp {
  const escaped = path
    .split('/')
    .map((segment) =>
      segment.startsWith(':') ? '([^/]+)' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    )
    .join('/');
  return new RegExp(`^${escaped}$`);
}

export function getRouteById(id: SuperAdminRouteId | string): SuperAdminRouteDefinition | undefined {
  return SUPER_ADMIN_ROUTES.find((route) => route.id === id);
}

/**
 * Resolves a pathname to its route definition. Static (non-parameterized)
 * routes always win over parameterized ones, so `/platform-users/invite`
 * resolves to the literal `platform-users-invite` route rather than the
 * `:id` detail route.
 */
export function getRouteByPath(pathname: string): SuperAdminRouteDefinition | undefined {
  const normalized = normalizePath(pathname);
  const exact = SUPER_ADMIN_ROUTES.find(
    (route) => !route.path.includes(':') && normalizePath(route.path) === normalized,
  );
  if (exact) return exact;
  return SUPER_ADMIN_ROUTES.find(
    (route) => route.path.includes(':') && pathToPattern(route.path).test(normalized),
  );
}

/** Nav-eligible routes for the current principal, in registry order. */
export function listNavRoutes(principal: PolicyPrincipal | null): SuperAdminRouteDefinition[] {
  return SUPER_ADMIN_ROUTES.filter(
    (route) => route.showInNav && evaluatePermissionPolicy(principal, route.policy),
  );
}

/** Groups nav-eligible routes by their `navGroup`, preserving registry order. */
export function listNavRoutesByGroup(
  principal: PolicyPrincipal | null,
): Array<{ group: SuperAdminNavGroup; routes: SuperAdminRouteDefinition[] }> {
  const groups: SuperAdminNavGroup[] = ['overview', 'platform', 'administration', 'operations', 'sales'];
  const eligible = listNavRoutes(principal);
  return groups
    .map((group) => ({ group, routes: eligible.filter((route) => route.navGroup === group) }))
    .filter((entry) => entry.routes.length > 0);
}

/**
 * Validates registry-wide invariants. Throws with a descriptive message on
 * failure so it can be used both from tests and (cheaply) at app startup.
 */
export function assertRegistryIntegrity(): void {
  const ids = new Set<string>();
  const paths = new Set<string>();

  for (const route of SUPER_ADMIN_ROUTES) {
    if (ids.has(route.id)) {
      throw new Error(`Duplicate route id in registry: ${route.id}`);
    }
    ids.add(route.id);

    if (paths.has(route.path)) {
      throw new Error(`Duplicate route path in registry: ${route.path}`);
    }
    paths.add(route.path);

    if (!route.path.startsWith('/')) {
      throw new Error(`Route path must be absolute: ${route.id} -> ${route.path}`);
    }

    if (!isValidPermissionPolicy(route.policy)) {
      throw new Error(`Route ${route.id} has an invalid or malformed permission policy.`);
    }

    if (route.breadcrumbParentId && !ids.has(route.breadcrumbParentId) && route.breadcrumbParentId !== route.id) {
      // Parent may be registered later in the array; validated in a second pass below.
    }

    const forbiddenKey = FORBIDDEN_ROUTE_FIELDS.find((key) => key in (route as unknown as Record<string, unknown>));
    if (forbiddenKey) {
      throw new Error(`Route ${route.id} must not carry role-based field "${forbiddenKey}".`);
    }
  }

  for (const route of SUPER_ADMIN_ROUTES) {
    if (route.breadcrumbParentId && !getRouteById(route.breadcrumbParentId)) {
      throw new Error(
        `Route ${route.id} references unknown breadcrumbParentId "${route.breadcrumbParentId}".`,
      );
    }
  }
}
