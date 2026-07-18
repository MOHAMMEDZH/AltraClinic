import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { readRegistryCache } from '@/features/module-registry/lib/registry-cache';
import { useModuleRegistry } from '@/features/module-registry/context/ModuleRegistryProvider';
import { useOptionalBranch } from '@/features/dynamic-branch/context/DynamicBranchProvider';
import { useRegisterBranchConsumer } from '@/features/dynamic-branch/hooks/useRegisterBranchConsumer';
import { useOptionalWhiteLabel } from '@/features/dynamic-white-label/context/DynamicWhiteLabelProvider';
import { buildRolesHash } from '@/features/module-registry/lib/registry-cache-identity';
import {
  NOTIFICATION_CACHE_VERSION,
  buildNotificationCacheKey,
  clearNotificationCache,
  readNotificationCache,
  readNotificationCacheForIdentity,
  writeNotificationCache,
} from '../lib/notification-cache';
import {
  buildRegistryNotificationSnapshot,
  buildRestrictedNotificationSnapshot,
  buildStaticNotificationSnapshot,
} from '../lib/notification-snapshot-builder';
import { STATIC_NOTIFICATION_CATALOG } from '../lib/static-notification-catalog';
import { isRegistryNotificationEnabled } from '../lib/notification-flags';
import { assertNotificationCatalogLoaded } from '../lib/notification-validation';
import type {
  EffectiveNotificationView,
  NotificationCapabilityFlags,
  NotificationCatalogSource,
  NotificationCategorySnapshot,
  NotificationChannelSnapshot,
  NotificationDisabledChannelEntry,
  NotificationLockedTypeEntry,
  NotificationPackSnapshot,
  NotificationProviderSnapshot,
  NotificationSnapshot,
  NotificationSurfaceSnapshot,
  NotificationTemplateSnapshot,
  NotificationTypeSnapshot,
} from '../lib/notification-types';

assertNotificationCatalogLoaded();

function resolveRegistrySnapshot(
  roles: string[],
  modules: ReturnType<typeof useModuleRegistry>['modules'],
  catalogGeneration: number | null,
  entitlementVersion: string | null,
  identity: NotificationSnapshot['identity'],
  whiteLabelSnapshotVersion: string | null,
): NotificationSnapshot {
  return buildRegistryNotificationSnapshot(
    roles,
    STATIC_NOTIFICATION_CATALOG,
    modules,
    catalogGeneration,
    entitlementVersion,
    identity,
    whiteLabelSnapshotVersion,
    'ready',
  );
}

function toContextValue(
  snapshot: NotificationSnapshot,
  options: {
    isRegistrySource: boolean;
    isLoading: boolean;
    error: Error | null;
    registryStatus: DynamicNotificationContextValue['registryStatus'];
    refresh: () => Promise<void>;
    branchSnapshotVersion: string | null;
    activeBranchId: string | null;
  },
): DynamicNotificationContextValue {
  return {
    snapshot,
    view: snapshot.view,
    categories: snapshot.categories,
    channels: snapshot.channels,
    types: snapshot.types,
    templates: snapshot.templates,
    providers: snapshot.providers,
    surfaces: snapshot.surfaces,
    packs: snapshot.packs,
    lockedNotificationTypes: snapshot.view.lockedNotificationTypes,
    disabledChannels: snapshot.view.disabledChannels,
    capabilities: snapshot.capabilities,
    canViewNotificationCenter: snapshot.canViewNotificationCenter,
    canViewCommunicationHistory: snapshot.canViewCommunicationHistory,
    canSendManualNotifications: snapshot.canSendManualNotifications,
    canConfigureTemplates: snapshot.canConfigureTemplates,
    canConfigureChannels: snapshot.canConfigureChannels,
    canManageDeliveryPolicies: snapshot.canManageDeliveryPolicies,
    canManageConsentPolicies: snapshot.canManageConsentPolicies,
    canViewDeliveryFailures: snapshot.canViewDeliveryFailures,
    canRetryFailedDelivery: snapshot.canRetryFailedDelivery,
    canSendPatientMessages: snapshot.canSendPatientMessages,
    canSendStaffMessages: snapshot.canSendStaffMessages,
    canSendCrossBranchMessages: snapshot.canSendCrossBranchMessages,
    canUseInApp: snapshot.canUseInApp,
    canUseEmail: snapshot.canUseEmail,
    canUseSms: snapshot.canUseSms,
    canUseWhatsApp: snapshot.canUseWhatsApp,
    canUsePush: snapshot.canUsePush,
    canUseWebhook: snapshot.canUseWebhook,
    canUseMarketingMessages: snapshot.canUseMarketingMessages,
    canViewSensitiveMessageContent: snapshot.canViewSensitiveMessageContent,
    canExportCommunicationHistory: snapshot.canExportCommunicationHistory,
    source: snapshot.source,
    notificationSnapshotVersion: snapshot.notificationSnapshotVersion,
    notificationConfigurationVersion: snapshot.notificationConfigurationVersion,
    providerKey: snapshot.providerKey,
    isRegistrySource: options.isRegistrySource,
    isLoading: options.isLoading,
    error: options.error,
    registryStatus: options.registryStatus,
    catalogGeneration: snapshot.catalogGeneration,
    entitlementVersion: snapshot.entitlementVersion,
    whiteLabelSnapshotVersion: snapshot.whiteLabelSnapshotVersion,
    refresh: options.refresh,
    branchSnapshotVersion: options.branchSnapshotVersion,
    activeBranchId: options.activeBranchId,
  };
}

export interface DynamicNotificationContextValue {
  snapshot: NotificationSnapshot;
  view: EffectiveNotificationView;
  categories: NotificationCategorySnapshot[];
  channels: NotificationChannelSnapshot[];
  types: NotificationTypeSnapshot[];
  templates: NotificationTemplateSnapshot[];
  providers: NotificationProviderSnapshot[];
  surfaces: NotificationSurfaceSnapshot[];
  packs: NotificationPackSnapshot[];
  lockedNotificationTypes: NotificationLockedTypeEntry[];
  disabledChannels: NotificationDisabledChannelEntry[];
  capabilities: NotificationCapabilityFlags;
  canViewNotificationCenter: boolean;
  canViewCommunicationHistory: boolean;
  canSendManualNotifications: boolean;
  canConfigureTemplates: boolean;
  canConfigureChannels: boolean;
  canManageDeliveryPolicies: boolean;
  canManageConsentPolicies: boolean;
  canViewDeliveryFailures: boolean;
  canRetryFailedDelivery: boolean;
  canSendPatientMessages: boolean;
  canSendStaffMessages: boolean;
  canSendCrossBranchMessages: boolean;
  canUseInApp: boolean;
  canUseEmail: boolean;
  canUseSms: boolean;
  canUseWhatsApp: boolean;
  canUsePush: boolean;
  canUseWebhook: boolean;
  canUseMarketingMessages: boolean;
  canViewSensitiveMessageContent: boolean;
  canExportCommunicationHistory: boolean;
  source: NotificationCatalogSource;
  notificationSnapshotVersion: string;
  notificationConfigurationVersion: string;
  providerKey: string;
  isRegistrySource: boolean;
  isLoading: boolean;
  error: Error | null;
  registryStatus: 'loading' | 'ready' | 'error' | 'restricted';
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  whiteLabelSnapshotVersion: string | null;
  refresh: () => Promise<void>;
  branchSnapshotVersion: string | null;
  activeBranchId: string | null;
}

const DynamicNotificationContext = createContext<DynamicNotificationContextValue | null>(null);

export function DynamicNotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { locale } = useI18n();
  const roles = user?.roles ?? [];
  const rolesHash = buildRolesHash(roles);
  const tenantId = user?.tenantId ?? '';
  const userId = user?.userId ?? '';
  const registry = useModuleRegistry();
  const branchCtx = useOptionalBranch();
  const whiteLabelCtx = useOptionalWhiteLabel();
  const useRegistry = isRegistryNotificationEnabled();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const lastRegistrySnapshotRef = useRef<{
    identityKey: string;
    snapshot: NotificationSnapshot;
  } | null>(null);
  const lastIdentityKeyRef = useRef<string | null>(null);
  const branchSnapshotVersion = branchCtx?.branchSnapshotVersion ?? null;
  const activeBranchId = branchCtx?.activeBranchId ?? null;
  const whiteLabelSnapshotVersion = whiteLabelCtx?.settingsVersion ?? null;

  const refresh = useCallback(async () => {
    clearNotificationCache();
    lastRegistrySnapshotRef.current = null;
    setRefreshNonce((value) => value + 1);
    await registry.refresh();
  }, [registry]);

  useRegisterBranchConsumer('notification', () => {
    clearNotificationCache();
    lastRegistrySnapshotRef.current = null;
    setRefreshNonce((value) => value + 1);
  });

  const value = useMemo<DynamicNotificationContextValue>(() => {
    void refreshNonce;

    const identity = {
      tenantId,
      userId,
      rolesHash,
      branchId: activeBranchId,
      locale,
    };
    const identityKey = [
      tenantId,
      userId,
      rolesHash,
      activeBranchId ?? 'none',
      branchSnapshotVersion ?? 'none',
      whiteLabelSnapshotVersion ?? 'none',
      locale,
    ].join(':');
    const catalogGeneration = registry.snapshot?.catalogGeneration ?? null;
    const entitlementVersion = registry.snapshot?.entitlementVersion ?? null;
    const registryStatus: DynamicNotificationContextValue['registryStatus'] = registry.isError
      ? 'error'
      : registry.isLoading
        ? 'loading'
        : 'ready';

    if (lastIdentityKeyRef.current && lastIdentityKeyRef.current !== identityKey) {
      clearNotificationCache();
      lastRegistrySnapshotRef.current = null;
    }
    lastIdentityKeyRef.current = identityKey;

    const staticSnapshot = buildStaticNotificationSnapshot(
      roles,
      STATIC_NOTIFICATION_CATALOG,
      identity,
      whiteLabelSnapshotVersion,
      useRegistry ? 'static-fallback' : 'static-only',
    );

    if (!useRegistry || registry.isError) {
      return toContextValue(staticSnapshot, {
        isRegistrySource: false,
        isLoading: registry.isLoading,
        error: registry.error,
        registryStatus,
        refresh,
        branchSnapshotVersion,
        activeBranchId,
      });
    }

    const notificationConfigurationVersion = [
      'notification-config',
      catalogGeneration ?? 'none',
      entitlementVersion ?? 'none',
      activeBranchId ?? 'none',
      locale,
    ].join('#');

    const resolveKnownRegistrySnapshot = (): NotificationSnapshot | null => {
      const last = lastRegistrySnapshotRef.current;
      if (last?.identityKey === identityKey) {
        return last.snapshot;
      }

      const notificationCached = readNotificationCacheForIdentity({
        tenantId,
        userId,
        rolesHash,
        activeBranchId,
        branchSnapshotVersion,
        whiteLabelSnapshotVersion,
        locale,
        catalogGeneration,
        entitlementVersion,
        notificationConfigurationVersion,
      });
      if (notificationCached) {
        return notificationCached;
      }

      const registryCached = readRegistryCache({ tenantId, userId, rolesHash });
      if (registryCached?.data.modules.length) {
        return resolveRegistrySnapshot(
          roles,
          registryCached.data.modules,
          registryCached.data.snapshot.catalogGeneration,
          registryCached.data.snapshot.entitlementVersion,
          identity,
          whiteLabelSnapshotVersion,
        );
      }

      return null;
    };

    if (registry.isLoading && registry.modules.length === 0) {
      const knownSnapshot = resolveKnownRegistrySnapshot();
      if (knownSnapshot) {
        return toContextValue(knownSnapshot, {
          isRegistrySource: true,
          isLoading: true,
          error: null,
          registryStatus,
          refresh,
          branchSnapshotVersion,
          activeBranchId,
        });
      }

      return toContextValue(
        buildRestrictedNotificationSnapshot(identity, whiteLabelSnapshotVersion, catalogGeneration, entitlementVersion),
        {
          isRegistrySource: true,
          isLoading: true,
          error: null,
          registryStatus: 'restricted',
          refresh,
          branchSnapshotVersion,
          activeBranchId,
        },
      );
    }

    const provisionalVersion = [
      catalogGeneration ?? 'none',
      entitlementVersion ?? 'none',
      activeBranchId ?? 'none',
      branchSnapshotVersion ?? 'none',
      'registry',
    ].join('#');

    const cacheKey = buildNotificationCacheKey({
      tenantId,
      userId,
      rolesHash,
      activeBranchId,
      branchSnapshotVersion,
      whiteLabelSnapshotVersion,
      locale,
      catalogGeneration,
      entitlementVersion,
      notificationConfigurationVersion,
      notificationSnapshotVersion: provisionalVersion,
      cacheVersion: NOTIFICATION_CACHE_VERSION,
      moduleCount: registry.modules.length,
      source: 'registry',
    });

    const cached = readNotificationCache(cacheKey);
    const snapshot =
      cached ??
      resolveRegistrySnapshot(roles, registry.modules, catalogGeneration, entitlementVersion, identity, whiteLabelSnapshotVersion);

    if (!cached) {
      const versionedKey = buildNotificationCacheKey({
        tenantId,
        userId,
        rolesHash,
        activeBranchId,
        branchSnapshotVersion,
        whiteLabelSnapshotVersion,
        locale,
        catalogGeneration,
        entitlementVersion,
        notificationConfigurationVersion: snapshot.notificationConfigurationVersion,
        notificationSnapshotVersion: snapshot.notificationSnapshotVersion,
        cacheVersion: NOTIFICATION_CACHE_VERSION,
        moduleCount: registry.modules.length,
        source: 'registry',
      });
      writeNotificationCache(versionedKey, snapshot);
    }

    lastRegistrySnapshotRef.current = { identityKey, snapshot };

    return toContextValue(snapshot, {
      isRegistrySource: true,
      isLoading: registry.isLoading,
      error: null,
      registryStatus,
      refresh,
      branchSnapshotVersion,
      activeBranchId,
    });
  }, [
    registry.error,
    registry.isError,
    registry.isLoading,
    registry.modules,
    registry.snapshot?.catalogGeneration,
    registry.snapshot?.entitlementVersion,
    refresh,
    refreshNonce,
    roles,
    rolesHash,
    tenantId,
    userId,
    useRegistry,
    branchSnapshotVersion,
    activeBranchId,
    whiteLabelSnapshotVersion,
    locale,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    (
      window as Window & {
        __BOOKING_NOTIFICATION_RUNTIME__?: {
          source: string;
          isRegistrySource: boolean;
          notificationSnapshotVersion: string;
          providerKey: string;
          tenantId: string;
          userId: string;
          branchId: string | null;
          branchSnapshotVersion: string | null;
          whiteLabelSnapshotVersion: string | null;
          catalogGeneration: number | null;
          entitlementVersion: string | null;
          registryStatus: string;
          channelCount: number;
          typeCount: number;
          surfaceCount: number;
          packCount: number;
          canViewNotificationCenter: boolean;
          canViewCommunicationHistory: boolean;
          canConfigureChannels: boolean;
          canConfigureTemplates: boolean;
        };
        __BOOKING_NOTIFICATION_ACTIONS__?: {
          refresh: () => Promise<void>;
        };
      }
    ).__BOOKING_NOTIFICATION_RUNTIME__ = {
      source: value.source,
      isRegistrySource: value.isRegistrySource,
      notificationSnapshotVersion: value.notificationSnapshotVersion,
      providerKey: value.providerKey,
      tenantId: value.snapshot.identity.tenantId,
      userId: value.snapshot.identity.userId,
      branchId: value.activeBranchId,
      branchSnapshotVersion: value.branchSnapshotVersion,
      whiteLabelSnapshotVersion: value.whiteLabelSnapshotVersion,
      catalogGeneration: value.catalogGeneration,
      entitlementVersion: value.entitlementVersion,
      registryStatus: value.registryStatus,
      channelCount: value.channels.length,
      typeCount: value.types.length,
      surfaceCount: value.surfaces.length,
      packCount: value.packs.length,
      canViewNotificationCenter: value.canViewNotificationCenter,
      canViewCommunicationHistory: value.canViewCommunicationHistory,
      canConfigureChannels: value.canConfigureChannels,
      canConfigureTemplates: value.canConfigureTemplates,
    };
    (
      window as Window & {
        __BOOKING_NOTIFICATION_ACTIONS__?: { refresh: () => Promise<void> };
      }
    ).__BOOKING_NOTIFICATION_ACTIONS__ = {
      refresh: value.refresh,
    };
  }, [value]);

  return <DynamicNotificationContext.Provider value={value}>{children}</DynamicNotificationContext.Provider>;
}

export function useNotification(): DynamicNotificationContextValue {
  const ctx = useContext(DynamicNotificationContext);
  if (!ctx) {
    throw new Error('useNotification must be used within DynamicNotificationProvider');
  }
  return ctx;
}

export function useOptionalNotification(): DynamicNotificationContextValue | null {
  return useContext(DynamicNotificationContext);
}
