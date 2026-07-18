import {
  NOTIFICATION_BUILTIN_PROVIDER_KEY,
  NOTIFICATION_CONTRIBUTION_SCHEMA_VERSION,
  type CanonicalNotificationSurface,
} from './notification-types';
import { CANONICAL_NOTIFICATION_CHANNELS, CANONICAL_NOTIFICATION_CHANNEL_COUNT } from './canonical-notification-channels';
import { CANONICAL_NOTIFICATION_TYPES, CANONICAL_NOTIFICATION_TYPE_COUNT } from './canonical-notification-types';
import {
  CANONICAL_NOTIFICATION_TEMPLATES,
  CANONICAL_NOTIFICATION_TEMPLATE_COUNT,
} from './canonical-notification-templates';
import {
  CANONICAL_NOTIFICATION_PROVIDERS,
  CANONICAL_NOTIFICATION_PROVIDER_COUNT,
} from './canonical-notification-providers';
import { CANONICAL_NOTIFICATION_PACKS, CANONICAL_NOTIFICATION_PACK_COUNT } from './canonical-notification-packs';
import type { LicensedModuleId } from '../types';

const OWNER_MODULE_ID: LicensedModuleId = 'notifications';

type SurfaceInput = {
  surfaceId: string;
  route: string;
  permissionAction: 'view' | 'manage';
  branchScope: 'tenant' | 'branch';
  sortOrder: number;
};

function defineSurface(input: SurfaceInput): CanonicalNotificationSurface {
  return {
    surfaceId: input.surfaceId,
    localId: `surface-${input.surfaceId}`,
    notificationKind: 'surface',
    moduleId: OWNER_MODULE_ID,
    ownerModuleId: OWNER_MODULE_ID,
    providerKey: NOTIFICATION_BUILTIN_PROVIDER_KEY,
    labelKey: `notification.surface.${input.surfaceId}`,
    descriptionKey: `notification.surface.${input.surfaceId}.description`,
    route: input.route,
    deepLinkTemplate: input.route,
    permissionResource: 'api.notifications',
    permissionAction: input.permissionAction,
    requiredFeature: 'notificationCenter',
    branchScope: input.branchScope,
    schemaVersion: '1',
    sortOrder: input.sortOrder,
    contributionSchemaVersion: NOTIFICATION_CONTRIBUTION_SCHEMA_VERSION,
  };
}

/** Canonical notification center navigation surfaces — Phase 41a foundation (6 surfaces). */
export const CANONICAL_NOTIFICATION_SURFACES_NAV: readonly CanonicalNotificationSurface[] = [
  defineSurface({
    surfaceId: 'notification-center',
    route: '/settings/notifications/center',
    permissionAction: 'view',
    branchScope: 'branch',
    sortOrder: 10,
  }),
  defineSurface({
    surfaceId: 'notification-preferences',
    route: '/settings/notifications/preferences',
    permissionAction: 'view',
    branchScope: 'branch',
    sortOrder: 20,
  }),
  defineSurface({
    surfaceId: 'template-management',
    route: '/settings/notifications/templates',
    permissionAction: 'manage',
    branchScope: 'tenant',
    sortOrder: 30,
  }),
  defineSurface({
    surfaceId: 'channel-management',
    route: '/settings/notifications/channels',
    permissionAction: 'manage',
    branchScope: 'tenant',
    sortOrder: 40,
  }),
  defineSurface({
    surfaceId: 'delivery-failures',
    route: '/settings/notifications/delivery-failures',
    permissionAction: 'view',
    branchScope: 'branch',
    sortOrder: 50,
  }),
  defineSurface({
    surfaceId: 'communication-history',
    route: '/settings/notifications/history',
    permissionAction: 'view',
    branchScope: 'branch',
    sortOrder: 60,
  }),
] as const;

export const CANONICAL_NOTIFICATION_SURFACE_COUNT = CANONICAL_NOTIFICATION_SURFACES_NAV.length;
export const CANONICAL_NOTIFICATION_SURFACE_IDS = CANONICAL_NOTIFICATION_SURFACES_NAV.map((s) => s.surfaceId);

/**
 * Aggregated catalog: channels → types → templates → providers → surfaces → packs.
 * CANONICAL_NOTIFICATION_ENTRY_COUNT = 8 + 32 + 32 + 6 + 6 + 8 = 92.
 */
export const CANONICAL_NOTIFICATION_SURFACES: readonly (
  | (typeof CANONICAL_NOTIFICATION_CHANNELS)[number]
  | (typeof CANONICAL_NOTIFICATION_TYPES)[number]
  | (typeof CANONICAL_NOTIFICATION_TEMPLATES)[number]
  | (typeof CANONICAL_NOTIFICATION_PROVIDERS)[number]
  | (typeof CANONICAL_NOTIFICATION_SURFACES_NAV)[number]
  | (typeof CANONICAL_NOTIFICATION_PACKS)[number]
)[] = [
  ...CANONICAL_NOTIFICATION_CHANNELS,
  ...CANONICAL_NOTIFICATION_TYPES,
  ...CANONICAL_NOTIFICATION_TEMPLATES,
  ...CANONICAL_NOTIFICATION_PROVIDERS,
  ...CANONICAL_NOTIFICATION_SURFACES_NAV,
  ...CANONICAL_NOTIFICATION_PACKS,
] as const;

export const CANONICAL_NOTIFICATION_CATALOG_COUNT = CANONICAL_NOTIFICATION_SURFACES.length;

export const CANONICAL_NOTIFICATION_ENTRY_COUNT =
  CANONICAL_NOTIFICATION_CHANNEL_COUNT +
  CANONICAL_NOTIFICATION_TYPE_COUNT +
  CANONICAL_NOTIFICATION_TEMPLATE_COUNT +
  CANONICAL_NOTIFICATION_PROVIDER_COUNT +
  CANONICAL_NOTIFICATION_SURFACE_COUNT +
  CANONICAL_NOTIFICATION_PACK_COUNT;
