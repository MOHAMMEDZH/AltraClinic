import {
  CANONICAL_NOTIFICATION_CHANNELS,
  CANONICAL_NOTIFICATION_TYPES,
  CANONICAL_NOTIFICATION_TEMPLATES,
  CANONICAL_NOTIFICATION_PROVIDERS,
  CANONICAL_NOTIFICATION_SURFACES_NAV,
  CANONICAL_NOTIFICATION_PACKS,
  STATIC_NOTIFICATION_CATALOG_IS_RUNTIME_AUTHORITY,
  isStaticNotificationCatalogRuntimeAuthority,
} from '@booking/module-registry/notification';

export { STATIC_NOTIFICATION_CATALOG_IS_RUNTIME_AUTHORITY, isStaticNotificationCatalogRuntimeAuthority };

export interface NotificationCatalogEntry {
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
  supportsRichContent?: boolean;
  requiresRecipientAddress?: boolean;
  fallbackChannelId?: string;
  transactional?: boolean;
  requiresConsent?: boolean;
  consentPolicyId?: string;
  sensitive?: boolean;
  redactionPolicyId?: string;
  defaultChannelIds?: string[];
  locale?: string;
  publicationStatus?: string;
  phiClassification?: string;
  variableNames?: string[];
  vendor?: string;
  requiresCredentials?: boolean;
  includedTypeIds?: string[];
  version?: string;
  route?: string;
  requiredFeature?: string;
  branchScope?: string;
  permissionResource: string;
  permissionAction: string;
  labelKey: string;
  descriptionKey?: string;
  deepLinkTemplate: string;
  providerKey: string;
  schemaVersion: string;
  sortOrder: number;
  contributionSchemaVersion: 1;
}

function channelToEntry(channel: (typeof CANONICAL_NOTIFICATION_CHANNELS)[number]): NotificationCatalogEntry {
  return {
    extensionId: `${channel.moduleId}/notification/${channel.localId}`,
    moduleId: channel.moduleId,
    localId: channel.localId,
    notificationKind: 'channel',
    channelId: channel.channelId,
    ownerModuleId: channel.ownerModuleId,
    runtimeImplemented: channel.runtimeImplemented,
    implementationStatus: channel.implementationStatus,
    supportsRichContent: channel.supportsRichContent,
    requiresRecipientAddress: channel.requiresRecipientAddress,
    fallbackChannelId: channel.fallbackChannelId,
    permissionResource: channel.permissionResource,
    permissionAction: channel.permissionAction,
    labelKey: channel.labelKey,
    descriptionKey: channel.descriptionKey,
    deepLinkTemplate: channel.deepLinkTemplate,
    providerKey: channel.providerKey,
    schemaVersion: channel.schemaVersion,
    sortOrder: channel.sortOrder,
    contributionSchemaVersion: 1,
  };
}

function typeToEntry(type: (typeof CANONICAL_NOTIFICATION_TYPES)[number]): NotificationCatalogEntry {
  return {
    extensionId: `${type.moduleId}/notification/${type.localId}`,
    moduleId: type.moduleId,
    localId: type.localId,
    notificationKind: 'type',
    typeId: type.typeId,
    categoryId: type.categoryId,
    ownerModuleId: type.ownerModuleId,
    transactional: type.transactional,
    requiresConsent: type.requiresConsent,
    consentPolicyId: type.consentPolicyId,
    sensitive: type.sensitive,
    redactionPolicyId: type.redactionPolicyId,
    defaultChannelIds: [...type.defaultChannelIds],
    runtimeImplemented: type.runtimeImplemented,
    implementationStatus: type.implementationStatus,
    permissionResource: type.permissionResource,
    permissionAction: type.permissionAction,
    labelKey: type.labelKey,
    descriptionKey: type.descriptionKey,
    deepLinkTemplate: type.deepLinkTemplate,
    providerKey: type.providerKey,
    schemaVersion: type.schemaVersion,
    sortOrder: type.sortOrder,
    contributionSchemaVersion: 1,
  };
}

function templateToEntry(template: (typeof CANONICAL_NOTIFICATION_TEMPLATES)[number]): NotificationCatalogEntry {
  return {
    extensionId: `${template.moduleId}/notification/${template.localId}`,
    moduleId: template.moduleId,
    localId: template.localId,
    notificationKind: 'template',
    templateId: template.templateId,
    typeId: template.typeId,
    ownerModuleId: template.ownerModuleId,
    locale: template.locale,
    channelId: template.channelId,
    publicationStatus: template.publicationStatus,
    phiClassification: template.phiClassification,
    variableNames: [...template.variableNames],
    runtimeImplemented: template.runtimeImplemented,
    permissionResource: template.permissionResource,
    permissionAction: template.permissionAction,
    labelKey: template.labelKey,
    descriptionKey: template.descriptionKey,
    deepLinkTemplate: template.deepLinkTemplate,
    providerKey: template.providerKey,
    schemaVersion: template.schemaVersion,
    sortOrder: template.sortOrder,
    contributionSchemaVersion: 1,
  };
}

function providerToEntry(provider: (typeof CANONICAL_NOTIFICATION_PROVIDERS)[number]): NotificationCatalogEntry {
  return {
    extensionId: `${provider.moduleId}/notification/${provider.localId}`,
    moduleId: provider.moduleId,
    localId: provider.localId,
    notificationKind: 'provider',
    providerId: provider.providerId,
    channelId: provider.channelId,
    ownerModuleId: provider.ownerModuleId,
    vendor: provider.vendor,
    requiresCredentials: provider.requiresCredentials,
    runtimeImplemented: provider.runtimeImplemented,
    implementationStatus: provider.implementationStatus,
    permissionResource: provider.permissionResource,
    permissionAction: provider.permissionAction,
    labelKey: provider.labelKey,
    descriptionKey: provider.descriptionKey,
    deepLinkTemplate: provider.deepLinkTemplate,
    providerKey: provider.providerKey,
    schemaVersion: provider.schemaVersion,
    sortOrder: provider.sortOrder,
    contributionSchemaVersion: 1,
  };
}

function surfaceToEntry(surface: (typeof CANONICAL_NOTIFICATION_SURFACES_NAV)[number]): NotificationCatalogEntry {
  return {
    extensionId: `${surface.moduleId}/notification/${surface.localId}`,
    moduleId: surface.moduleId,
    localId: surface.localId,
    notificationKind: 'surface',
    surfaceId: surface.surfaceId,
    ownerModuleId: surface.ownerModuleId,
    permissionResource: surface.permissionResource,
    permissionAction: surface.permissionAction,
    requiredFeature: surface.requiredFeature,
    branchScope: surface.branchScope,
    route: surface.route,
    labelKey: surface.labelKey,
    descriptionKey: surface.descriptionKey,
    deepLinkTemplate: surface.deepLinkTemplate,
    providerKey: surface.providerKey,
    schemaVersion: surface.schemaVersion,
    sortOrder: surface.sortOrder,
    contributionSchemaVersion: 1,
  };
}

function packToEntry(pack: (typeof CANONICAL_NOTIFICATION_PACKS)[number]): NotificationCatalogEntry {
  return {
    extensionId: `${pack.moduleId}/notification/${pack.localId}`,
    moduleId: pack.moduleId,
    localId: pack.localId,
    notificationKind: 'pack',
    packId: pack.packId,
    includedTypeIds: [...pack.includedTypeIds],
    ownerModuleId: pack.ownerModuleId,
    permissionResource: pack.permissionResource,
    permissionAction: pack.permissionAction,
    branchScope: pack.branchScope,
    version: pack.version,
    labelKey: pack.labelKey,
    descriptionKey: pack.descriptionKey,
    deepLinkTemplate: pack.deepLinkTemplate,
    providerKey: pack.providerKey,
    schemaVersion: pack.schemaVersion,
    sortOrder: pack.sortOrder,
    contributionSchemaVersion: 1,
  };
}

/**
 * Parity baseline only — never runtime authority (Phase 41a).
 * No DynamicNotificationProvider exists yet; discoverability continues to route through the
 * registry snapshot / EffectiveModuleView, never direct catalog reads in UI.
 */
export const STATIC_NOTIFICATION_CATALOG: readonly NotificationCatalogEntry[] = [
  ...CANONICAL_NOTIFICATION_CHANNELS.map(channelToEntry),
  ...CANONICAL_NOTIFICATION_TYPES.map(typeToEntry),
  ...CANONICAL_NOTIFICATION_TEMPLATES.map(templateToEntry),
  ...CANONICAL_NOTIFICATION_PROVIDERS.map(providerToEntry),
  ...CANONICAL_NOTIFICATION_SURFACES_NAV.map(surfaceToEntry),
  ...CANONICAL_NOTIFICATION_PACKS.map(packToEntry),
] as const;

export function assertNotificationCatalogValid(): string[] {
  const errors: string[] = [];
  if (STATIC_NOTIFICATION_CATALOG_IS_RUNTIME_AUTHORITY !== false) {
    errors.push('STATIC_NOTIFICATION_CATALOG_IS_RUNTIME_AUTHORITY must be false');
  }
  const ids = new Set<string>();
  for (const entry of STATIC_NOTIFICATION_CATALOG) {
    if (ids.has(entry.extensionId)) {
      errors.push(`Duplicate extensionId ${entry.extensionId}`);
    }
    ids.add(entry.extensionId);
  }
  return errors;
}
