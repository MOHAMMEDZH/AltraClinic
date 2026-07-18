import { useEffect, useRef } from 'react';
import { useTenantEntitlements } from '@/features/subscription/hooks/useSubscription';
import { buildEntitlementVersion } from '../lib/build-entitlement-version';
import { useModuleRegistry } from '../context/ModuleRegistryProvider';

/** Refreshes module registry when subscription entitlements change. */
export function RegistryEntitlementSync() {
  const { refresh, snapshot } = useModuleRegistry();
  const entitlements = useTenantEntitlements();
  const lastFingerprintRef = useRef<string | null>(null);

  useEffect(() => {
    const license = entitlements.data?.license;
    if (!license?.modules) return;

    const fingerprint = buildEntitlementVersion({
      licenseStatus: license.status,
      canWrite: entitlements.data.canWrite,
      canMutate: entitlements.data.canMutate,
      licenseModules: license.modules,
    });

    if (
      lastFingerprintRef.current &&
      lastFingerprintRef.current !== fingerprint &&
      snapshot?.entitlementVersion !== fingerprint
    ) {
      void refresh();
    }

    lastFingerprintRef.current = fingerprint;
  }, [entitlements.data, refresh, snapshot?.entitlementVersion]);

  return null;
}
