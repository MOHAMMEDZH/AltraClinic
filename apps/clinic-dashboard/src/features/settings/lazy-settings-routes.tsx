import { lazy, Suspense, type ComponentType } from 'react';
import { SettingsLayout } from './components/SettingsLayout';

const SettingsHomePage = lazy(() => import('./pages/SettingsHomePage').then((m) => ({ default: m.SettingsHomePage })));
const GeneralSettingsPage = lazy(() => import('./pages/GeneralSettingsPage').then((m) => ({ default: m.GeneralSettingsPage })));
const ClinicProfilePage = lazy(() => import('./pages/ClinicProfilePage').then((m) => ({ default: m.ClinicProfilePage })));
const LocalizationSettingsPage = lazy(() => import('./pages/LocalizationSettingsPage').then((m) => ({ default: m.LocalizationSettingsPage })));
const BrandingSettingsPage = lazy(() => import('./pages/BrandingSettingsPage').then((m) => ({ default: m.BrandingSettingsPage })));
const FeatureFlagsSettingsPage = lazy(() => import('./pages/FeatureFlagsSettingsPage').then((m) => ({ default: m.FeatureFlagsSettingsPage })));
const BranchesSettingsPage = lazy(() => import('./pages/BranchesSettingsPage').then((m) => ({ default: m.BranchesSettingsPage })));
const SettingsSearchPage = lazy(() => import('./pages/SettingsSearchPage').then((m) => ({ default: m.SettingsSearchPage })));
const BillingSettingsPage = lazy(() => import('./pages/BillingSettingsPage').then((m) => ({ default: m.BillingSettingsPage })));
const InventorySettingsPage = lazy(() => import('./pages/InventorySettingsPage').then((m) => ({ default: m.InventorySettingsPage })));
const ReportsSettingsPage = lazy(() => import('./pages/ReportsSettingsPage').then((m) => ({ default: m.ReportsSettingsPage })));
const IntegrationsSettingsPage = lazy(() => import('./pages/IntegrationsSettingsPage').then((m) => ({ default: m.IntegrationsSettingsPage })));
const AuditSettingsPage = lazy(() => import('./pages/AuditSettingsPage').then((m) => ({ default: m.AuditSettingsPage })));
const DeveloperSettingsPage = lazy(() => import('./pages/DeveloperSettingsPage').then((m) => ({ default: m.DeveloperSettingsPage })));
const AdvancedSettingsPage = lazy(() => import('./pages/AdvancedSettingsPage').then((m) => ({ default: m.AdvancedSettingsPage })));
const SecurityPoliciesSettingsPage = lazy(() => import('./pages/SecurityPoliciesSettingsPage').then((m) => ({ default: m.SecurityPoliciesSettingsPage })));
const NotificationDefaultsSettingsPage = lazy(() => import('./pages/NotificationDefaultsSettingsPage').then((m) => ({ default: m.NotificationDefaultsSettingsPage })));

function SettingsFallback() {
  return <div style={{ padding: 'var(--space-6)' }} aria-busy="true" />;
}

function withSuspense(Component: ComponentType) {
  return (
    <Suspense fallback={<SettingsFallback />}>
      <Component />
    </Suspense>
  );
}

export function LazySettingsLayout() {
  return (
    <Suspense fallback={<SettingsFallback />}>
      <SettingsLayout />
    </Suspense>
  );
}

export const LazySettingsHomePage = () => withSuspense(SettingsHomePage);
export const LazyGeneralSettingsPage = () => withSuspense(GeneralSettingsPage);
export const LazyClinicProfilePage = () => withSuspense(ClinicProfilePage);
export const LazyLocalizationSettingsPage = () => withSuspense(LocalizationSettingsPage);
export const LazyBrandingSettingsPage = () => withSuspense(BrandingSettingsPage);
export const LazyFeatureFlagsSettingsPage = () => withSuspense(FeatureFlagsSettingsPage);
export const LazyBranchesSettingsPage = () => withSuspense(BranchesSettingsPage);
export const LazySettingsSearchPage = () => withSuspense(SettingsSearchPage);
export const LazyBillingSettingsPage = () => withSuspense(BillingSettingsPage);
export const LazyInventorySettingsPage = () => withSuspense(InventorySettingsPage);
export const LazyReportsSettingsPage = () => withSuspense(ReportsSettingsPage);
export const LazyIntegrationsSettingsPage = () => withSuspense(IntegrationsSettingsPage);
export const LazyAuditSettingsPage = () => withSuspense(AuditSettingsPage);
export const LazyDeveloperSettingsPage = () => withSuspense(DeveloperSettingsPage);
export const LazyAdvancedSettingsPage = () => withSuspense(AdvancedSettingsPage);
export const LazySecurityPoliciesSettingsPage = () => withSuspense(SecurityPoliciesSettingsPage);
export const LazyNotificationDefaultsSettingsPage = () => withSuspense(NotificationDefaultsSettingsPage);
