import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../../shell/AppShell';
import { LoginPage } from '../../pages/LoginPage';
import { MfaEnrollPage } from '../../pages/MfaEnrollPage';
import { MfaChallengePage } from '../../pages/MfaChallengePage';
import { SecuritySessionsPage } from '../../pages/SecuritySessionsPage';
import { UnauthorizedPage } from '../../pages/UnauthorizedPage';
import { NotFoundPage } from '../../pages/NotFoundPage';
import { PlaceholderPage } from '../../pages/PlaceholderPage';
import {
  AuditCenterPage,
  AuditCorrelationPage,
  AuditEntryDetailPage,
  AuditExportPage,
  AuditOverrideEvidencePage,
  AuditPlanVersionEvidencePage,
} from '../../pages/AuditCenterPages';
import {
  OperationsConsolePage,
  OperationsSectionPage,
} from '../../pages/OperationsConsolePages';
import {
  FeatureFlagCreatePage,
  FeatureFlagDetailPage,
  FeatureFlagsSettingsPage,
  GlobalSettingDetailPage,
} from '../../pages/FeatureFlagsSettingsPages';
import { DashboardPage } from '../../pages/DashboardPage';
import { TenantDirectoryPage } from '../../pages/TenantDirectoryPage';
import { TenantDetailPage } from '../../pages/TenantDetailPage';
import {
  TenantOnboardingDetailPage,
  TenantOnboardingPage,
} from '../../pages/TenantOnboardingPage';
import { CatalogPage } from '../../pages/CatalogPage';
import { PlansPage } from '../../pages/PlansPage';
import { PlanCreatePage } from '../../pages/plans/PlanCreatePage';
import { PlanDetailPage } from '../../pages/plans/PlanDetailPage';
import { PlanEditPage } from '../../pages/plans/PlanEditPage';
import { PlanLegacyMappingsPage } from '../../pages/plans/PlanLegacyMappingsPage';
import { PlanVersionNewPage } from '../../pages/plans/PlanVersionNewPage';
import { PlanVersionDetailPage, PlanVersionComparePage } from '../../pages/plans/PlanVersionDetailPage';
import { PlanVersionEditPage } from '../../pages/plans/PlanVersionEditPage';
import { AddOnsListPage } from '../../pages/addons/AddOnsListPage';
import { AddOnCreatePage } from '../../pages/addons/AddOnCreatePage';
import { AddOnDetailPage } from '../../pages/addons/AddOnDetailPage';
import {
  AddOnVersionApplicabilityPage,
  AddOnVersionComparePage,
  AddOnVersionEntitlementsPage,
  AddOnVersionLimitsPage,
  AddOnVersionOverviewPage,
  AddOnVersionReadinessPage,
} from '../../pages/addons/AddOnVersionPage';
import {
  OverrideComparePage,
  OverrideCreatePage,
  OverrideDetailPage,
  OverrideReadinessPage,
  OverridesListPage,
} from '../../pages/addons/OverridesPages';
import { CompositionPreviewPage } from '../../pages/addons/CompositionPreviewPage';
import {
  SubscriptionsListPage,
  SubscriptionCreatePage,
  SubscriptionDetailPage,
  SubscriptionPlanPage,
  SubscriptionAddOnsPage,
  SubscriptionOverridesPage,
  SubscriptionDatesPage,
  SubscriptionReadinessPage,
  SubscriptionPreviewPage,
  SubscriptionHistoryPage,
  SubscriptionComparePage,
  SubscriptionRuntimePage,
} from '../../pages/subscriptions/SubscriptionsPages';
import { PlatformUsersPage } from '../../pages/PlatformUsersPage';
import { PlatformUserInvitePage } from '../../pages/PlatformUserInvitePage';
import { PlatformUserDetailPage } from '../../pages/PlatformUserDetailPage';
import { PlatformRolesPage } from '../../pages/PlatformRolesPage';
import { ActivateInvitationPage } from '../../pages/ActivateInvitationPage';
import { MfaResetApprovePage } from '../../pages/MfaResetApprovePage';
import {
  RedirectIfAuthenticated,
  RequireMfaChallenge,
  RequireMfaEnrollment,
  RequirePermissionPolicy,
  RequirePlatformAuth,
} from '../../auth/ProtectedRoute';
import { usePlatformAuth } from '../../auth/PlatformAuthProvider';
import { getRouteById, type SuperAdminRouteId } from '../../routing/route-registry';
import { resolveDefaultRoutePath } from '../../routing/resolve-default-route';

function requireRoute(id: SuperAdminRouteId) {
  const route = getRouteById(id);
  if (!route) {
    throw new Error(`Route registry is missing required route: ${id}`);
  }
  return route;
}

/** Nested-route path relative to the root `AppShell` layout route. */
function relativePath(id: SuperAdminRouteId): string {
  return requireRoute(id).path.replace(/^\//, '');
}

/** Index route: send authenticated users to their default landing page. */
function DefaultLandingRedirect() {
  const { principal } = usePlatformAuth();
  return <Navigate to={resolveDefaultRoutePath(principal)} replace />;
}

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route
          path={relativePath('login')}
          element={
            <RedirectIfAuthenticated>
              <LoginPage />
            </RedirectIfAuthenticated>
          }
        />
        <Route path={relativePath('unauthorized')} element={<UnauthorizedPage />} />
        <Route path={relativePath('activate')} element={<ActivateInvitationPage />} />

        <Route
          path={relativePath('mfa-enroll')}
          element={
            <RequireMfaEnrollment>
              <MfaEnrollPage />
            </RequireMfaEnrollment>
          }
        />
        <Route
          path={relativePath('mfa-challenge')}
          element={
            <RequireMfaChallenge>
              <MfaChallengePage />
            </RequireMfaChallenge>
          }
        />
        <Route
          path={relativePath('security')}
          element={
            <RequirePermissionPolicy policy={requireRoute('security').policy}>
              <SecuritySessionsPage />
            </RequirePermissionPolicy>
          }
        />

        <Route
          index
          element={
            <RequirePlatformAuth>
              <DefaultLandingRedirect />
            </RequirePlatformAuth>
          }
        />

        <Route
          path={relativePath('overview')}
          element={
            <RequirePermissionPolicy policy={requireRoute('overview').policy}>
              <DashboardPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('tenants')}
          element={
            <RequirePermissionPolicy policy={requireRoute('tenants').policy}>
              <TenantDirectoryPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('tenants-detail')}
          element={
            <RequirePermissionPolicy policy={requireRoute('tenants-detail').policy}>
              <TenantDetailPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('tenant-onboarding')}
          element={
            <RequirePermissionPolicy policy={requireRoute('tenant-onboarding').policy}>
              <TenantOnboardingPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('tenant-onboarding-detail')}
          element={
            <RequirePermissionPolicy policy={requireRoute('tenant-onboarding-detail').policy}>
              <TenantOnboardingDetailPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('catalog')}
          element={
            <RequirePermissionPolicy policy={requireRoute('catalog').policy}>
              <CatalogPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('plans')}
          element={
            <RequirePermissionPolicy policy={requireRoute('plans').policy}>
              <PlansPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('plans-new')}
          element={
            <RequirePermissionPolicy policy={requireRoute('plans-new').policy}>
              <PlanCreatePage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('plans-legacy')}
          element={
            <RequirePermissionPolicy policy={requireRoute('plans-legacy').policy}>
              <PlanLegacyMappingsPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('plans-edit')}
          element={
            <RequirePermissionPolicy policy={requireRoute('plans-edit').policy}>
              <PlanEditPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('plans-version-new')}
          element={
            <RequirePermissionPolicy policy={requireRoute('plans-version-new').policy}>
              <PlanVersionNewPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('plans-version-compare')}
          element={
            <RequirePermissionPolicy policy={requireRoute('plans-version-compare').policy}>
              <PlanVersionComparePage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('plans-version-edit')}
          element={
            <RequirePermissionPolicy policy={requireRoute('plans-version-edit').policy}>
              <PlanVersionEditPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('plans-version')}
          element={
            <RequirePermissionPolicy policy={requireRoute('plans-version').policy}>
              <PlanVersionDetailPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('plans-detail')}
          element={
            <RequirePermissionPolicy policy={requireRoute('plans-detail').policy}>
              <PlanDetailPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('add-ons')}
          element={
            <RequirePermissionPolicy policy={requireRoute('add-ons').policy}>
              <AddOnsListPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('add-ons-new')}
          element={
            <RequirePermissionPolicy policy={requireRoute('add-ons-new').policy}>
              <AddOnCreatePage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('add-ons-version-entitlements')}
          element={
            <RequirePermissionPolicy policy={requireRoute('add-ons-version-entitlements').policy}>
              <AddOnVersionEntitlementsPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('add-ons-version-limits')}
          element={
            <RequirePermissionPolicy policy={requireRoute('add-ons-version-limits').policy}>
              <AddOnVersionLimitsPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('add-ons-version-applicability')}
          element={
            <RequirePermissionPolicy policy={requireRoute('add-ons-version-applicability').policy}>
              <AddOnVersionApplicabilityPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('add-ons-version-readiness')}
          element={
            <RequirePermissionPolicy policy={requireRoute('add-ons-version-readiness').policy}>
              <AddOnVersionReadinessPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('add-ons-version-compare')}
          element={
            <RequirePermissionPolicy policy={requireRoute('add-ons-version-compare').policy}>
              <AddOnVersionComparePage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('add-ons-version')}
          element={
            <RequirePermissionPolicy policy={requireRoute('add-ons-version').policy}>
              <AddOnVersionOverviewPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('add-ons-detail')}
          element={
            <RequirePermissionPolicy policy={requireRoute('add-ons-detail').policy}>
              <AddOnDetailPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('commercial-overrides')}
          element={
            <RequirePermissionPolicy policy={requireRoute('commercial-overrides').policy}>
              <OverridesListPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('commercial-overrides-new')}
          element={
            <RequirePermissionPolicy policy={requireRoute('commercial-overrides-new').policy}>
              <OverrideCreatePage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('commercial-overrides-readiness')}
          element={
            <RequirePermissionPolicy policy={requireRoute('commercial-overrides-readiness').policy}>
              <OverrideReadinessPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('commercial-overrides-compare')}
          element={
            <RequirePermissionPolicy policy={requireRoute('commercial-overrides-compare').policy}>
              <OverrideComparePage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('commercial-overrides-detail')}
          element={
            <RequirePermissionPolicy policy={requireRoute('commercial-overrides-detail').policy}>
              <OverrideDetailPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('commercial-composition-preview')}
          element={
            <RequirePermissionPolicy policy={requireRoute('commercial-composition-preview').policy}>
              <CompositionPreviewPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('subscriptions')}
          element={
            <RequirePermissionPolicy policy={requireRoute('subscriptions').policy}>
              <SubscriptionsListPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('subscriptions-new')}
          element={
            <RequirePermissionPolicy policy={requireRoute('subscriptions-new').policy}>
              <SubscriptionCreatePage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('subscriptions-detail')}
          element={
            <RequirePermissionPolicy policy={requireRoute('subscriptions-detail').policy}>
              <SubscriptionDetailPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('subscriptions-plan')}
          element={
            <RequirePermissionPolicy policy={requireRoute('subscriptions-plan').policy}>
              <SubscriptionPlanPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('subscriptions-addons')}
          element={
            <RequirePermissionPolicy policy={requireRoute('subscriptions-addons').policy}>
              <SubscriptionAddOnsPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('subscriptions-overrides')}
          element={
            <RequirePermissionPolicy policy={requireRoute('subscriptions-overrides').policy}>
              <SubscriptionOverridesPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('subscriptions-dates')}
          element={
            <RequirePermissionPolicy policy={requireRoute('subscriptions-dates').policy}>
              <SubscriptionDatesPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('subscriptions-readiness')}
          element={
            <RequirePermissionPolicy policy={requireRoute('subscriptions-readiness').policy}>
              <SubscriptionReadinessPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('subscriptions-preview')}
          element={
            <RequirePermissionPolicy policy={requireRoute('subscriptions-preview').policy}>
              <SubscriptionPreviewPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('subscriptions-history')}
          element={
            <RequirePermissionPolicy policy={requireRoute('subscriptions-history').policy}>
              <SubscriptionHistoryPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('subscriptions-compare')}
          element={
            <RequirePermissionPolicy policy={requireRoute('subscriptions-compare').policy}>
              <SubscriptionComparePage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('subscriptions-runtime')}
          element={
            <RequirePermissionPolicy policy={requireRoute('subscriptions-runtime').policy}>
              <SubscriptionRuntimePage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('platform-users')}
          element={
            <RequirePermissionPolicy policy={requireRoute('platform-users').policy}>
              <PlatformUsersPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('platform-users-invite')}
          element={
            <RequirePermissionPolicy policy={requireRoute('platform-users-invite').policy}>
              <PlatformUserInvitePage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('platform-users-detail')}
          element={
            <RequirePermissionPolicy policy={requireRoute('platform-users-detail').policy}>
              <PlatformUserDetailPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('roles')}
          element={
            <RequirePermissionPolicy policy={requireRoute('roles').policy}>
              <PlatformRolesPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('mfa-reset-approve')}
          element={
            <RequirePermissionPolicy policy={requireRoute('mfa-reset-approve').policy}>
              <MfaResetApprovePage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('operations')}
          element={
            <RequirePermissionPolicy policy={requireRoute('operations').policy}>
              <OperationsConsolePage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path="operations/jobs"
          element={
            <RequirePermissionPolicy policy={requireRoute('operations').policy}>
              <OperationsSectionPage section="jobs" />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path="operations/provisioning"
          element={
            <RequirePermissionPolicy policy={requireRoute('operations').policy}>
              <OperationsSectionPage section="provisioning" />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path="operations/entitlement-health"
          element={
            <RequirePermissionPolicy policy={requireRoute('operations').policy}>
              <OperationsSectionPage section="entitlement" />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path="operations/integrations"
          element={
            <RequirePermissionPolicy policy={requireRoute('operations').policy}>
              <OperationsSectionPage section="integrations" />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path="operations/backups"
          element={
            <RequirePermissionPolicy policy={requireRoute('operations').policy}>
              <OperationsSectionPage section="backups" />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('audit')}
          element={
            <RequirePermissionPolicy policy={requireRoute('audit').policy}>
              <AuditCenterPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path="audit/entries/:entryId"
          element={
            <RequirePermissionPolicy policy={requireRoute('audit').policy}>
              <AuditEntryDetailPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path="audit/correlation/:correlationId"
          element={
            <RequirePermissionPolicy policy={requireRoute('audit').policy}>
              <AuditCorrelationPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path="audit/export"
          element={
            <RequirePermissionPolicy
              policy={{ type: 'permission', permission: 'audit.export' }}
            >
              <AuditExportPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path="audit/plan-versions/:planVersionId"
          element={
            <RequirePermissionPolicy policy={requireRoute('audit').policy}>
              <AuditPlanVersionEvidencePage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path="audit/overrides/:overrideId"
          element={
            <RequirePermissionPolicy policy={requireRoute('audit').policy}>
              <AuditOverrideEvidencePage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('sales')}
          element={
            <RequirePermissionPolicy policy={requireRoute('sales').policy}>
              <PlaceholderPage routeId="sales" />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('settings')}
          element={
            <RequirePermissionPolicy policy={requireRoute('settings').policy}>
              <FeatureFlagsSettingsPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('feature-flags-new')}
          element={
            <RequirePermissionPolicy policy={requireRoute('feature-flags-new').policy}>
              <FeatureFlagCreatePage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('feature-flags-detail')}
          element={
            <RequirePermissionPolicy policy={requireRoute('feature-flags-detail').policy}>
              <FeatureFlagDetailPage />
            </RequirePermissionPolicy>
          }
        />
        <Route
          path={relativePath('global-settings-detail')}
          element={
            <RequirePermissionPolicy policy={requireRoute('global-settings-detail').policy}>
              <GlobalSettingDetailPage />
            </RequirePermissionPolicy>
          }
        />

        <Route
          path={relativePath('not-found')}
          element={
            <RequirePlatformAuth>
              <NotFoundPage />
            </RequirePlatformAuth>
          }
        />
        <Route
          path="*"
          element={
            <RequirePlatformAuth>
              <NotFoundPage />
            </RequirePlatformAuth>
          }
        />
      </Route>
      <Route path="/home" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
