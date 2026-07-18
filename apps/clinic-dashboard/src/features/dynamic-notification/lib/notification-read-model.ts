import type { NotificationSnapshot } from './notification-types';

/** Notification Center surface configuration derived from NotificationSnapshot only. */
export interface NotificationCenterConfig {
  showCenter: boolean;
  surfaceId: string | null;
  route: string | null;
  canConfigureChannels: boolean;
  canConfigureTemplates: boolean;
  canViewDeliveryFailures: boolean;
  canViewCommunicationHistory: boolean;
  accessibleChannelIds: string[];
  accessibleTypeCount: number;
  source: NotificationSnapshot['source'] | null;
}

export function resolveNotificationCenterConfig(
  snapshot: NotificationSnapshot | null | undefined,
): NotificationCenterConfig {
  if (!snapshot?.canViewNotificationCenter) {
    return {
      showCenter: false,
      surfaceId: null,
      route: null,
      canConfigureChannels: false,
      canConfigureTemplates: false,
      canViewDeliveryFailures: false,
      canViewCommunicationHistory: false,
      accessibleChannelIds: [],
      accessibleTypeCount: 0,
      source: snapshot?.source ?? null,
    };
  }

  const centerSurface = snapshot.surfaces.find((s) => s.surfaceId === 'notification-center');

  return {
    showCenter: true,
    surfaceId: centerSurface?.surfaceId ?? 'notification-center',
    route: centerSurface?.route ?? '/settings/notifications/center',
    canConfigureChannels: snapshot.canConfigureChannels,
    canConfigureTemplates: snapshot.canConfigureTemplates,
    canViewDeliveryFailures: snapshot.canViewDeliveryFailures,
    canViewCommunicationHistory: snapshot.canViewCommunicationHistory,
    accessibleChannelIds: snapshot.channels.map((c) => c.channelId),
    accessibleTypeCount: snapshot.types.length,
    source: snapshot.source,
  };
}

export interface NotificationChannelDisplayRow {
  channelId: string;
  labelKey: string;
  enabled: boolean;
  runtimeImplemented: boolean;
  disabledReason: 'permission' | 'not-implemented' | 'restricted' | 'reference' | null;
}

/** Channel display rows derived from NotificationSnapshot accessibility only (never widens). */
export function resolveNotificationChannelsDisplay(
  snapshot: NotificationSnapshot | null | undefined,
): NotificationChannelDisplayRow[] {
  if (!snapshot) return [];

  const accessible: NotificationChannelDisplayRow[] = snapshot.channels.map((channel) => ({
    channelId: channel.channelId,
    labelKey: channel.labelKey,
    enabled: channel.runtimeImplemented,
    runtimeImplemented: channel.runtimeImplemented,
    disabledReason: channel.runtimeImplemented ? null : 'not-implemented',
  }));

  const disabled: NotificationChannelDisplayRow[] = snapshot.view.disabledChannels.map((entry) => ({
    channelId: entry.channelId,
    labelKey: `notification.channel.${entry.channelId}`,
    enabled: false,
    runtimeImplemented: false,
    disabledReason: entry.reason,
  }));

  const merged = new Map<string, NotificationChannelDisplayRow>();
  for (const row of [...accessible, ...disabled]) {
    if (!merged.has(row.channelId)) merged.set(row.channelId, row);
  }

  return [...merged.values()].sort((a, b) => a.channelId.localeCompare(b.channelId));
}
