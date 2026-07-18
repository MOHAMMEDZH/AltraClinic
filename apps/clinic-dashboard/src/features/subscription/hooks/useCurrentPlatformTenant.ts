import { useMemo } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { usePlatformTenants, useSubscriptionAccess } from './useSubscription';

export function useCurrentPlatformTenant() {
  const { user } = useAuth();
  const access = useSubscriptionAccess();
  const tenants = usePlatformTenants(access.canView);

  const current = useMemo(
    () => tenants.data?.find((row) => row.tenantId === user?.tenantId) ?? null,
    [tenants.data, user?.tenantId],
  );

  return {
    platformTenantId: current?.platformTenantId ?? null,
    tenant: current,
    isLoading: tenants.isLoading,
    isError: tenants.isError,
  };
}
