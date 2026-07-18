import { Outlet } from 'react-router-dom';
import { ModuleRegistryProvider } from '@/features/module-registry/context/ModuleRegistryProvider';
import { RegistryEntitlementSync } from '@/features/module-registry/components/RegistryEntitlementSync';
import { DynamicRouteProvider } from '@/features/dynamic-routing/context/DynamicRouteProvider';
import { DynamicBranchProvider } from '@/features/dynamic-branch/context/DynamicBranchProvider';
import { DynamicWhiteLabelProvider } from '@/features/dynamic-white-label/context/DynamicWhiteLabelProvider';
import { DynamicActivityProvider } from '@/features/dynamic-activity/context/DynamicActivityProvider';
import { DynamicAuditProvider } from '@/features/dynamic-audit/context/DynamicAuditProvider';
import { DynamicJourneyProvider } from '@/features/dynamic-journey/context/DynamicJourneyProvider';
import { DynamicNotificationProvider } from '@/features/dynamic-notification/context/DynamicNotificationProvider';

/**
 * Hosts registry + dynamic route context above licensed shell routes.
 * Renders nested router outlets for kiosk and shell branches.
 * Order: ModuleRegistry → DynamicBranch → DynamicWhiteLabel → DynamicActivity → DynamicAudit → DynamicJourney → DynamicNotification → DynamicRoute.
 */
export function RegistryRouteHost() {
  return (
    <ModuleRegistryProvider>
      <RegistryEntitlementSync />
      <DynamicBranchProvider>
        <DynamicWhiteLabelProvider>
          <DynamicActivityProvider>
            <DynamicAuditProvider>
              <DynamicJourneyProvider>
                <DynamicNotificationProvider>
                  <DynamicRouteProvider>
                    <Outlet />
                  </DynamicRouteProvider>
                </DynamicNotificationProvider>
              </DynamicJourneyProvider>
            </DynamicAuditProvider>
          </DynamicActivityProvider>
        </DynamicWhiteLabelProvider>
      </DynamicBranchProvider>
    </ModuleRegistryProvider>
  );
}
