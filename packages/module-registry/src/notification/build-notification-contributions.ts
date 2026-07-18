import type { NotificationCenterContribution, LicensedModuleId } from '../types';
import { moduleNotification } from '../builtin/extension-builders';
import { CANONICAL_NOTIFICATION_CHANNELS } from './canonical-notification-channels';
import { CANONICAL_NOTIFICATION_TYPES } from './canonical-notification-types';
import { CANONICAL_NOTIFICATION_TEMPLATES } from './canonical-notification-templates';
import { CANONICAL_NOTIFICATION_PROVIDERS } from './canonical-notification-providers';
import { CANONICAL_NOTIFICATION_SURFACES_NAV } from './canonical-notification-surfaces';
import { CANONICAL_NOTIFICATION_PACKS } from './canonical-notification-packs';
import type {
  CanonicalNotificationChannel,
  CanonicalNotificationPack,
  CanonicalNotificationProvider,
  CanonicalNotificationSurface,
  CanonicalNotificationTemplate,
  CanonicalNotificationType,
} from './notification-types';

function channelToContribution(channel: CanonicalNotificationChannel): NotificationCenterContribution {
  return moduleNotification(channel.moduleId, channel.localId, {
    notificationKind: 'channel',
    ownerModuleId: channel.ownerModuleId,
    providerKey: channel.providerKey,
    channelId: channel.channelId,
    runtimeImplemented: channel.runtimeImplemented,
    implementationStatus: channel.implementationStatus,
    supportsRichContent: channel.supportsRichContent,
    requiresRecipientAddress: channel.requiresRecipientAddress,
    fallbackChannelId: channel.fallbackChannelId,
    permissionResource: channel.permissionResource,
    permissionAction: channel.permissionAction,
    labelKey: channel.labelKey,
    descriptionKey: channel.descriptionKey,
    sortOrder: channel.sortOrder,
    deepLinkTemplate: channel.deepLinkTemplate,
    schemaVersion: channel.schemaVersion,
    contributionSchemaVersion: channel.contributionSchemaVersion,
  });
}

function typeToContribution(type: CanonicalNotificationType): NotificationCenterContribution {
  return moduleNotification(type.moduleId, type.localId, {
    notificationKind: 'type',
    ownerModuleId: type.ownerModuleId,
    providerKey: type.providerKey,
    typeId: type.typeId,
    categoryId: type.categoryId,
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
    sortOrder: type.sortOrder,
    deepLinkTemplate: type.deepLinkTemplate,
    schemaVersion: type.schemaVersion,
    contributionSchemaVersion: type.contributionSchemaVersion,
  });
}

function templateToContribution(template: CanonicalNotificationTemplate): NotificationCenterContribution {
  return moduleNotification(template.moduleId, template.localId, {
    notificationKind: 'template',
    ownerModuleId: template.ownerModuleId,
    providerKey: template.providerKey,
    templateId: template.templateId,
    typeId: template.typeId,
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
    sortOrder: template.sortOrder,
    deepLinkTemplate: template.deepLinkTemplate,
    schemaVersion: template.schemaVersion,
    contributionSchemaVersion: template.contributionSchemaVersion,
  });
}

function providerToContribution(provider: CanonicalNotificationProvider): NotificationCenterContribution {
  return moduleNotification(provider.moduleId, provider.localId, {
    notificationKind: 'provider',
    ownerModuleId: provider.ownerModuleId,
    providerKey: provider.providerKey,
    providerId: provider.providerId,
    channelId: provider.channelId,
    vendor: provider.vendor,
    requiresCredentials: provider.requiresCredentials,
    runtimeImplemented: provider.runtimeImplemented,
    implementationStatus: provider.implementationStatus,
    permissionResource: provider.permissionResource,
    permissionAction: provider.permissionAction,
    labelKey: provider.labelKey,
    descriptionKey: provider.descriptionKey,
    sortOrder: provider.sortOrder,
    deepLinkTemplate: provider.deepLinkTemplate,
    schemaVersion: provider.schemaVersion,
    contributionSchemaVersion: provider.contributionSchemaVersion,
  });
}

function surfaceToContribution(surface: CanonicalNotificationSurface): NotificationCenterContribution {
  return moduleNotification(surface.moduleId, surface.localId, {
    notificationKind: 'surface',
    ownerModuleId: surface.ownerModuleId,
    providerKey: surface.providerKey,
    surfaceId: surface.surfaceId,
    route: surface.route,
    permissionResource: surface.permissionResource,
    permissionAction: surface.permissionAction,
    requiredFeature: surface.requiredFeature,
    branchScope: surface.branchScope,
    labelKey: surface.labelKey,
    descriptionKey: surface.descriptionKey,
    sortOrder: surface.sortOrder,
    deepLinkTemplate: surface.deepLinkTemplate,
    schemaVersion: surface.schemaVersion,
    contributionSchemaVersion: surface.contributionSchemaVersion,
  });
}

function packToContribution(pack: CanonicalNotificationPack): NotificationCenterContribution {
  return moduleNotification(pack.moduleId, pack.localId, {
    notificationKind: 'pack',
    ownerModuleId: pack.ownerModuleId,
    providerKey: pack.providerKey,
    packId: pack.packId,
    includedTypeIds: [...pack.includedTypeIds],
    version: pack.version,
    permissionResource: pack.permissionResource,
    permissionAction: pack.permissionAction,
    branchScope: pack.branchScope,
    labelKey: pack.labelKey,
    descriptionKey: pack.descriptionKey,
    sortOrder: pack.sortOrder,
    deepLinkTemplate: pack.deepLinkTemplate,
    schemaVersion: pack.schemaVersion,
    contributionSchemaVersion: pack.contributionSchemaVersion,
  });
}

export function buildNotificationContributionsForModule(moduleId: LicensedModuleId): NotificationCenterContribution[] {
  const channels = CANONICAL_NOTIFICATION_CHANNELS.filter((entry) => entry.moduleId === moduleId).map(
    channelToContribution,
  );
  const types = CANONICAL_NOTIFICATION_TYPES.filter((entry) => entry.moduleId === moduleId).map(typeToContribution);
  const templates = CANONICAL_NOTIFICATION_TEMPLATES.filter((entry) => entry.moduleId === moduleId).map(
    templateToContribution,
  );
  const providers = CANONICAL_NOTIFICATION_PROVIDERS.filter((entry) => entry.moduleId === moduleId).map(
    providerToContribution,
  );
  const surfaces = CANONICAL_NOTIFICATION_SURFACES_NAV.filter((entry) => entry.moduleId === moduleId).map(
    surfaceToContribution,
  );
  const packs = CANONICAL_NOTIFICATION_PACKS.filter((entry) => entry.moduleId === moduleId).map(packToContribution);
  return [...channels, ...types, ...templates, ...providers, ...surfaces, ...packs];
}

export function buildAllNotificationContributions(): NotificationCenterContribution[] {
  return [
    ...CANONICAL_NOTIFICATION_CHANNELS.map(channelToContribution),
    ...CANONICAL_NOTIFICATION_TYPES.map(typeToContribution),
    ...CANONICAL_NOTIFICATION_TEMPLATES.map(templateToContribution),
    ...CANONICAL_NOTIFICATION_PROVIDERS.map(providerToContribution),
    ...CANONICAL_NOTIFICATION_SURFACES_NAV.map(surfaceToContribution),
    ...CANONICAL_NOTIFICATION_PACKS.map(packToContribution),
  ];
}

export function listAllBuiltinNotificationContributions(): NotificationCenterContribution[] {
  return buildAllNotificationContributions();
}
