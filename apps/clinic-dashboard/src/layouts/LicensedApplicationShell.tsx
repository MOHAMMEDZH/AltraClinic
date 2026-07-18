import { useLocation } from 'react-router-dom';
import { AppShell } from '@/layouts/AppShell/AppShell';
import { AuthSpinner } from '@/features/auth/components/AuthSpinner';
import {
  isSubscriptionAllowlisted,
  requiresLicenseExperience,
} from '@/lib/license-gate';
import { useTenantEntitlements } from '@/features/subscription/hooks/useSubscription';
import { EnterpriseLicenseExperience } from '@/features/subscription/components/EnterpriseLicenseExperience';
import { LicenseMaintenanceLayout } from '@/features/subscription/components/LicenseMaintenanceLayout';

export function LicensedApplicationShell() {
  const location = useLocation();
  const serverEntitlements = useTenantEntitlements();

  if (serverEntitlements.isLoading) {
    return <AuthSpinner />;
  }

  const entitlementsVerified = serverEntitlements.isSuccess && serverEntitlements.data != null;
  const safeMode =
    serverEntitlements.isError || (!serverEntitlements.isLoading && !entitlementsVerified);

  const blocked = requiresLicenseExperience({
    entitlementsVerified,
    safeMode,
    licenseStatus: serverEntitlements.data?.license.status,
    gracePeriodEndsAt: serverEntitlements.data?.license.gracePeriodEndsAt,
  });

  const onSubscriptionRoute = isSubscriptionAllowlisted(location.pathname);

  if (blocked && !onSubscriptionRoute) {
    return <EnterpriseLicenseExperience />;
  }

  if (blocked && onSubscriptionRoute) {
    return <LicenseMaintenanceLayout />;
  }

  return <AppShell />;
}
