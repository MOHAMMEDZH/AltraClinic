import type { NotificationCenterContribution, ModuleManifest } from '../types';
import {
  CANONICAL_NOTIFICATION_ENTRY_COUNT,
  CANONICAL_NOTIFICATION_SURFACES,
} from './canonical-notification-surfaces';
import { CANONICAL_NOTIFICATION_CHANNEL_COUNT } from './canonical-notification-channels';
import { CANONICAL_NOTIFICATION_TYPE_COUNT } from './canonical-notification-types';
import { CANONICAL_NOTIFICATION_TEMPLATE_COUNT } from './canonical-notification-templates';
import { CANONICAL_NOTIFICATION_PROVIDER_COUNT } from './canonical-notification-providers';
import { CANONICAL_NOTIFICATION_SURFACE_COUNT } from './canonical-notification-surfaces';
import { CANONICAL_NOTIFICATION_PACK_COUNT } from './canonical-notification-packs';
import {
  NOTIFICATION_BUILTIN_PROVIDER_KEY,
  CANONICAL_NOTIFICATION_FEATURE_IDS,
  type CanonicalNotificationCatalogEntry,
} from './notification-types';
import { validateCanonicalNotificationVocabulary } from './validate-canonical-notification-vocabulary';

const CANONICAL_BY_EXTENSION_ID = new Map<string, CanonicalNotificationCatalogEntry>(
  CANONICAL_NOTIFICATION_SURFACES.map((entry) => [`${entry.moduleId}/notification/${entry.localId}`, entry]),
);

const VALID_FEATURE_IDS = new Set<string>(CANONICAL_NOTIFICATION_FEATURE_IDS);
const PROVIDER_KEY_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)+$/;
const VALID_PERMISSION_ACTIONS = new Set(['view', 'create', 'update', 'delete', 'approve', 'export', 'manage']);

export function collectManifestNotificationContributions(manifests: ModuleManifest[]): NotificationCenterContribution[] {
  return manifests.flatMap((manifest) => manifest.extensions.notification ?? []);
}

export function validateBuiltinNotificationIntegrity(manifests: ModuleManifest[]): string[] {
  const errors: string[] = [...validateCanonicalNotificationVocabulary()];

  const seenExtensionIds = new Map<string, string>();
  const seenDeepLinks = new Map<string, string>();
  const seenRoutes = new Map<string, string>();

  let manifestNotificationCount = 0;

  for (const manifest of manifests) {
    const notification = manifest.extensions.notification ?? [];
    manifestNotificationCount += notification.length;

    for (const contribution of notification) {
      const owner = contribution.extensionId;

      const priorExt = seenExtensionIds.get(contribution.extensionId);
      if (priorExt) {
        errors.push(`Duplicate notification extensionId "${contribution.extensionId}" (${priorExt} and ${owner})`);
      } else {
        seenExtensionIds.set(contribution.extensionId, owner);
      }

      if (!contribution.extensionId.startsWith(`${manifest.moduleId}/notification/`)) {
        errors.push(
          `Notification extensionId "${contribution.extensionId}" must be prefixed with ${manifest.moduleId}/notification/`,
        );
      }

      if (!contribution.providerKey) {
        errors.push(`Notification contribution ${owner} missing providerKey`);
      } else if (!PROVIDER_KEY_PATTERN.test(contribution.providerKey)) {
        errors.push(`Notification contribution ${owner} has invalid providerKey "${contribution.providerKey}"`);
      } else if (contribution.providerKey !== NOTIFICATION_BUILTIN_PROVIDER_KEY) {
        errors.push(`Notification contribution ${owner} must use providerKey "${NOTIFICATION_BUILTIN_PROVIDER_KEY}"`);
      }

      if (contribution.requiredFeature && !VALID_FEATURE_IDS.has(contribution.requiredFeature)) {
        errors.push(`Notification contribution ${owner} has invalid featureId "${contribution.requiredFeature}"`);
      }

      const permissionResource = contribution.permissionResource ?? contribution.resourceId;
      if (!permissionResource?.startsWith('api.')) {
        errors.push(`Notification contribution ${owner} has invalid permission resource`);
      }

      if (contribution.permissionAction && !VALID_PERMISSION_ACTIONS.has(contribution.permissionAction)) {
        errors.push(`Notification contribution ${owner} has invalid permissionAction`);
      }

      if (!contribution.deepLinkTemplate) {
        errors.push(`Notification contribution ${owner} missing deepLinkTemplate`);
      } else if (!contribution.deepLinkTemplate.startsWith('/')) {
        errors.push(`Notification contribution ${owner} deepLinkTemplate must start with "/"`);
      } else {
        const prior = seenDeepLinks.get(contribution.deepLinkTemplate);
        if (prior) {
          errors.push(`Duplicate deepLinkTemplate "${contribution.deepLinkTemplate}" (${prior} and ${owner})`);
        } else {
          seenDeepLinks.set(contribution.deepLinkTemplate, owner);
        }
      }

      if (contribution.route) {
        if (!contribution.route.startsWith('/')) {
          errors.push(`Notification contribution ${owner} has invalid route "${contribution.route}"`);
        }
        const priorRoute = seenRoutes.get(contribution.route);
        if (priorRoute) {
          errors.push(`Duplicate route "${contribution.route}" (${priorRoute} and ${owner})`);
        } else {
          seenRoutes.set(contribution.route, owner);
        }
      }

      const canonical = CANONICAL_BY_EXTENSION_ID.get(contribution.extensionId);
      if (!canonical) {
        errors.push(`Orphan notification contribution "${contribution.extensionId}" (no canonical entry)`);
        continue;
      }

      if (manifest.moduleId !== canonical.moduleId) {
        errors.push(
          `Notification "${contribution.localId}" ownership mismatch: manifest=${manifest.moduleId} canonical=${canonical.moduleId}`,
        );
      }

      if (contribution.notificationKind !== canonical.notificationKind) {
        errors.push(
          `Notification "${contribution.localId}" notificationKind mismatch: manifest=${contribution.notificationKind} canonical=${canonical.notificationKind}`,
        );
      }

      if ((contribution.providerKey ?? null) !== canonical.providerKey) {
        errors.push(
          `Notification "${contribution.localId}" providerKey mismatch: manifest=${contribution.providerKey ?? 'null'} canonical=${canonical.providerKey}`,
        );
      }

      compareNotificationFields(errors, contribution, canonical);
    }
  }

  for (const entry of CANONICAL_NOTIFICATION_SURFACES) {
    const extensionId = `${entry.moduleId}/notification/${entry.localId}`;
    if (!seenExtensionIds.has(extensionId)) {
      errors.push(`Missing notification contribution for canonical entry "${extensionId}"`);
    }
  }

  if (manifestNotificationCount !== CANONICAL_NOTIFICATION_ENTRY_COUNT) {
    errors.push(
      `Notification contribution count mismatch: manifests=${manifestNotificationCount} expected=${CANONICAL_NOTIFICATION_ENTRY_COUNT}`,
    );
  }

  if (CANONICAL_NOTIFICATION_CHANNEL_COUNT !== 8) {
    errors.push(`Canonical notification channel count must be 8 (got ${CANONICAL_NOTIFICATION_CHANNEL_COUNT})`);
  }
  if (CANONICAL_NOTIFICATION_TYPE_COUNT !== 32) {
    errors.push(`Canonical notification type count must be 32 (got ${CANONICAL_NOTIFICATION_TYPE_COUNT})`);
  }
  if (CANONICAL_NOTIFICATION_TEMPLATE_COUNT !== 32) {
    errors.push(`Canonical notification template count must be 32 (got ${CANONICAL_NOTIFICATION_TEMPLATE_COUNT})`);
  }
  if (CANONICAL_NOTIFICATION_PROVIDER_COUNT !== 6) {
    errors.push(`Canonical notification provider count must be 6 (got ${CANONICAL_NOTIFICATION_PROVIDER_COUNT})`);
  }
  if (CANONICAL_NOTIFICATION_SURFACE_COUNT !== 6) {
    errors.push(`Canonical notification surface count must be 6 (got ${CANONICAL_NOTIFICATION_SURFACE_COUNT})`);
  }
  if (CANONICAL_NOTIFICATION_PACK_COUNT !== 8) {
    errors.push(`Canonical notification pack count must be 8 (got ${CANONICAL_NOTIFICATION_PACK_COUNT})`);
  }

  return errors;
}

function compareNotificationFields(
  errors: string[],
  contribution: NotificationCenterContribution,
  canonical: CanonicalNotificationCatalogEntry,
): void {
  if (canonical.notificationKind === 'channel') {
    if (contribution.channelId !== canonical.channelId) {
      errors.push(`Notification "${contribution.localId}" channelId mismatch`);
    }
    if (contribution.runtimeImplemented !== canonical.runtimeImplemented) {
      errors.push(`Notification "${contribution.localId}" runtimeImplemented mismatch`);
    }
  }

  if (canonical.notificationKind === 'type') {
    if (contribution.typeId !== canonical.typeId) {
      errors.push(`Notification "${contribution.localId}" typeId mismatch`);
    }
    if (contribution.categoryId !== canonical.categoryId) {
      errors.push(`Notification "${contribution.localId}" categoryId mismatch`);
    }
  }

  if (canonical.notificationKind === 'template') {
    if (contribution.templateId !== canonical.templateId) {
      errors.push(`Notification "${contribution.localId}" templateId mismatch`);
    }
    if (contribution.typeId !== canonical.typeId) {
      errors.push(`Notification "${contribution.localId}" template typeId mismatch`);
    }
  }

  if (canonical.notificationKind === 'provider') {
    if (contribution.providerId !== canonical.providerId) {
      errors.push(`Notification "${contribution.localId}" providerId mismatch`);
    }
    if (contribution.channelId !== canonical.channelId) {
      errors.push(`Notification "${contribution.localId}" provider channelId mismatch`);
    }
  }

  if (canonical.notificationKind === 'surface') {
    if (contribution.surfaceId !== canonical.surfaceId) {
      errors.push(`Notification "${contribution.localId}" surfaceId mismatch`);
    }
  }

  if (canonical.notificationKind === 'pack') {
    if (contribution.packId !== canonical.packId) {
      errors.push(`Notification "${contribution.localId}" packId mismatch`);
    }
  }
}
