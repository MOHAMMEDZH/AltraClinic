import { CANONICAL_NOTIFICATION_SURFACES } from './canonical-notification-surfaces';
import type { CanonicalNotificationCatalogEntry } from './notification-types';

/** Minimal static catalog entry shape for parity validation (Phase 41a). */
export interface StaticNotificationCatalogEntryLike {
  extensionId: string;
  moduleId: string;
  localId: string;
  notificationKind: 'channel' | 'type' | 'template' | 'provider' | 'surface' | 'pack';
  channelId?: string;
  typeId?: string;
  templateId?: string;
  providerId?: string;
  surfaceId?: string;
  packId?: string;
  categoryId?: string;
  ownerModuleId?: string;
  runtimeImplemented?: boolean;
  implementationStatus?: string;
  permissionResource: string;
  permissionAction: string;
  branchScope?: string;
  route?: string;
  deepLinkTemplate: string;
  providerKey: string;
  schemaVersion: string;
  sortOrder: number;
  contributionSchemaVersion: 1;
}

const CANONICAL_BY_EXTENSION_ID = new Map<string, CanonicalNotificationCatalogEntry>(
  CANONICAL_NOTIFICATION_SURFACES.map((entry) => [`${entry.moduleId}/notification/${entry.localId}`, entry]),
);

function compareOptionalField(errors: string[], id: string, field: string, actual: unknown, expected: unknown): void {
  if ((actual ?? null) !== (expected ?? null)) {
    errors.push(
      `Static notification catalog "${id}" ${field} mismatch: static=${String(actual ?? 'null')} canonical=${String(expected ?? 'null')}`,
    );
  }
}

/** Fail-closed field-by-field parity between STATIC_NOTIFICATION_CATALOG and canonical vocabulary. */
export function validateStaticNotificationCatalogParity(entries: readonly StaticNotificationCatalogEntryLike[]): string[] {
  const errors: string[] = [];
  const seenExtensionIds = new Set<string>();

  if (entries.length !== CANONICAL_NOTIFICATION_SURFACES.length) {
    errors.push(
      `Static notification catalog count mismatch: static=${entries.length} canonical=${CANONICAL_NOTIFICATION_SURFACES.length}`,
    );
  }

  for (const entry of entries) {
    if (seenExtensionIds.has(entry.extensionId)) {
      errors.push(`Duplicate static notification catalog extensionId "${entry.extensionId}"`);
    } else {
      seenExtensionIds.add(entry.extensionId);
    }

    const canonical = CANONICAL_BY_EXTENSION_ID.get(entry.extensionId);
    if (!canonical) {
      errors.push(`Orphan static notification catalog entry "${entry.extensionId}"`);
      continue;
    }

    compareEntryToCanonical(errors, entry, canonical);
  }

  for (const canonical of CANONICAL_NOTIFICATION_SURFACES) {
    const extensionId = `${canonical.moduleId}/notification/${canonical.localId}`;
    if (!entries.some((entry) => entry.extensionId === extensionId)) {
      errors.push(`Missing static notification catalog entry for canonical "${extensionId}"`);
    }
  }

  return errors;
}

function compareEntryToCanonical(
  errors: string[],
  entry: StaticNotificationCatalogEntryLike,
  canonical: CanonicalNotificationCatalogEntry,
): void {
  const id = entry.extensionId;
  compareOptionalField(errors, id, 'moduleId', entry.moduleId, canonical.moduleId);
  compareOptionalField(errors, id, 'localId', entry.localId, canonical.localId);
  compareOptionalField(errors, id, 'notificationKind', entry.notificationKind, canonical.notificationKind);
  compareOptionalField(errors, id, 'providerKey', entry.providerKey, canonical.providerKey);
  compareOptionalField(errors, id, 'sortOrder', entry.sortOrder, canonical.sortOrder);
  compareOptionalField(errors, id, 'deepLinkTemplate', entry.deepLinkTemplate, canonical.deepLinkTemplate);
  compareOptionalField(errors, id, 'permissionResource', entry.permissionResource, canonical.permissionResource);
  compareOptionalField(errors, id, 'permissionAction', entry.permissionAction, canonical.permissionAction);

  if (canonical.notificationKind === 'channel') {
    compareOptionalField(errors, id, 'channelId', entry.channelId, canonical.channelId);
    compareOptionalField(errors, id, 'runtimeImplemented', entry.runtimeImplemented, canonical.runtimeImplemented);
  }

  if (canonical.notificationKind === 'type') {
    compareOptionalField(errors, id, 'typeId', entry.typeId, canonical.typeId);
    compareOptionalField(errors, id, 'categoryId', entry.categoryId, canonical.categoryId);
  }

  if (canonical.notificationKind === 'template') {
    compareOptionalField(errors, id, 'templateId', entry.templateId, canonical.templateId);
    compareOptionalField(errors, id, 'typeId', entry.typeId, canonical.typeId);
  }

  if (canonical.notificationKind === 'provider') {
    compareOptionalField(errors, id, 'providerId', entry.providerId, canonical.providerId);
    compareOptionalField(errors, id, 'channelId', entry.channelId, canonical.channelId);
  }

  if (canonical.notificationKind === 'surface') {
    compareOptionalField(errors, id, 'surfaceId', entry.surfaceId, canonical.surfaceId);
    compareOptionalField(errors, id, 'route', entry.route, canonical.route);
  }

  if (canonical.notificationKind === 'pack') {
    compareOptionalField(errors, id, 'packId', entry.packId, canonical.packId);
  }
}
