import {
  CANONICAL_NOTIFICATION_CATEGORIES,
  CANONICAL_NOTIFICATION_CATEGORY_COUNT,
  CANONICAL_NOTIFICATION_CATEGORY_IDS,
} from './canonical-notification-categories';
import {
  CANONICAL_NOTIFICATION_CHANNELS,
  CANONICAL_NOTIFICATION_CHANNEL_COUNT,
  CANONICAL_NOTIFICATION_CHANNEL_IDS,
} from './canonical-notification-channels';
import {
  CANONICAL_NOTIFICATION_TYPES,
  CANONICAL_NOTIFICATION_TYPE_COUNT,
  CANONICAL_NOTIFICATION_TYPE_IDS,
} from './canonical-notification-types';
import {
  CANONICAL_NOTIFICATION_TEMPLATES,
  CANONICAL_NOTIFICATION_TEMPLATE_COUNT,
} from './canonical-notification-templates';
import {
  CANONICAL_NOTIFICATION_PROVIDERS,
  CANONICAL_NOTIFICATION_PROVIDER_COUNT,
} from './canonical-notification-providers';
import {
  CANONICAL_NOTIFICATION_SURFACES_NAV,
  CANONICAL_NOTIFICATION_SURFACE_COUNT,
  CANONICAL_NOTIFICATION_SURFACE_IDS,
  CANONICAL_NOTIFICATION_ENTRY_COUNT,
} from './canonical-notification-surfaces';
import { CANONICAL_NOTIFICATION_PACKS, CANONICAL_NOTIFICATION_PACK_COUNT } from './canonical-notification-packs';
import {
  CANONICAL_NOTIFICATION_DELIVERY_POLICIES,
  CANONICAL_NOTIFICATION_DELIVERY_POLICY_IDS,
} from './canonical-delivery-policies';
import {
  CANONICAL_NOTIFICATION_RETRY_POLICIES,
  CANONICAL_NOTIFICATION_RETRY_POLICY_IDS,
} from './canonical-retry-policies';
import {
  CANONICAL_NOTIFICATION_CONSENT_POLICIES,
  CANONICAL_NOTIFICATION_CONSENT_POLICY_IDS,
} from './canonical-consent-policies';
import {
  CANONICAL_NOTIFICATION_PREFERENCE_POLICIES,
  CANONICAL_NOTIFICATION_PREFERENCE_POLICY_IDS,
} from './canonical-preference-policies';
import {
  CANONICAL_NOTIFICATION_ESCALATION_POLICIES,
  CANONICAL_NOTIFICATION_ESCALATION_POLICY_IDS,
} from './canonical-escalation-policies';
import {
  CANONICAL_NOTIFICATION_REDACTION_POLICIES,
  CANONICAL_NOTIFICATION_REDACTION_POLICY_IDS,
} from './canonical-redaction-policies';
import { CANONICAL_NOTIFICATION_RETENTION_POLICIES } from './canonical-retention-policies';
import { NOTIFICATION_BUILTIN_PROVIDER_KEY, CANONICAL_NOTIFICATION_FEATURE_IDS } from './notification-types';

const CATEGORY_IDS = new Set(CANONICAL_NOTIFICATION_CATEGORY_IDS);
const CHANNEL_IDS = new Set(CANONICAL_NOTIFICATION_CHANNEL_IDS);
const TYPE_IDS = new Set(CANONICAL_NOTIFICATION_TYPE_IDS);
const CONSENT_POLICY_IDS = new Set(CANONICAL_NOTIFICATION_CONSENT_POLICY_IDS);
const REDACTION_POLICY_IDS = new Set(CANONICAL_NOTIFICATION_REDACTION_POLICY_IDS);
const VALID_FEATURE_IDS = new Set<string>(CANONICAL_NOTIFICATION_FEATURE_IDS);
const PROVIDER_KEY_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)+$/;
const VALID_PERMISSION_ACTIONS = new Set(['view', 'create', 'update', 'delete', 'approve', 'export', 'manage']);
const VALID_IMPLEMENTATION_STATUSES = new Set(['not-implemented', 'stub', 'partial', 'full']);
const SECRET_VARIABLE_PATTERN = /password|secret|token|apikey|api[_-]?key|credential|ssn|otp|pin\b/i;

/** Fail-closed validation of canonical notification vocabulary (Phase 41a). Metadata only. */
export function validateCanonicalNotificationVocabulary(): string[] {
  const errors: string[] = [];

  if (CANONICAL_NOTIFICATION_CATEGORY_COUNT !== 24) {
    errors.push(`Canonical notification category count must be 24 (got ${CANONICAL_NOTIFICATION_CATEGORY_COUNT})`);
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
  if (CANONICAL_NOTIFICATION_ENTRY_COUNT !== 92) {
    errors.push(`Canonical notification entry count must be 92 (got ${CANONICAL_NOTIFICATION_ENTRY_COUNT})`);
  }
  if (CANONICAL_NOTIFICATION_DELIVERY_POLICIES.length !== 11) {
    errors.push(`Canonical notification delivery policy count must be 11 (got ${CANONICAL_NOTIFICATION_DELIVERY_POLICIES.length})`);
  }
  if (CANONICAL_NOTIFICATION_RETRY_POLICIES.length !== 6) {
    errors.push(`Canonical notification retry policy count must be 6 (got ${CANONICAL_NOTIFICATION_RETRY_POLICIES.length})`);
  }
  if (CANONICAL_NOTIFICATION_CONSENT_POLICIES.length !== 6) {
    errors.push(`Canonical notification consent policy count must be 6 (got ${CANONICAL_NOTIFICATION_CONSENT_POLICIES.length})`);
  }
  if (CANONICAL_NOTIFICATION_PREFERENCE_POLICIES.length !== 4) {
    errors.push(`Canonical notification preference policy count must be 4 (got ${CANONICAL_NOTIFICATION_PREFERENCE_POLICIES.length})`);
  }
  if (CANONICAL_NOTIFICATION_ESCALATION_POLICIES.length !== 4) {
    errors.push(`Canonical notification escalation policy count must be 4 (got ${CANONICAL_NOTIFICATION_ESCALATION_POLICIES.length})`);
  }
  if (CANONICAL_NOTIFICATION_REDACTION_POLICIES.length !== 7) {
    errors.push(`Canonical notification redaction policy count must be 7 (got ${CANONICAL_NOTIFICATION_REDACTION_POLICIES.length})`);
  }
  if (CANONICAL_NOTIFICATION_RETENTION_POLICIES.length !== 6) {
    errors.push(`Canonical notification retention policy count must be 6 (got ${CANONICAL_NOTIFICATION_RETENTION_POLICIES.length})`);
  }

  if (new Set(CANONICAL_NOTIFICATION_CATEGORY_IDS).size !== CANONICAL_NOTIFICATION_CATEGORY_IDS.length) {
    errors.push('Duplicate notification categoryId in vocabulary');
  }
  if (new Set(CANONICAL_NOTIFICATION_CHANNEL_IDS).size !== CANONICAL_NOTIFICATION_CHANNEL_IDS.length) {
    errors.push('Duplicate notification channelId in vocabulary');
  }
  if (new Set(CANONICAL_NOTIFICATION_TYPE_IDS).size !== CANONICAL_NOTIFICATION_TYPE_IDS.length) {
    errors.push('Duplicate notification typeId in vocabulary');
  }
  if (new Set(CANONICAL_NOTIFICATION_SURFACE_IDS).size !== CANONICAL_NOTIFICATION_SURFACE_IDS.length) {
    errors.push('Duplicate notification surfaceId in vocabulary');
  }

  for (const policySet of [
    { name: 'delivery', ids: CANONICAL_NOTIFICATION_DELIVERY_POLICY_IDS },
    { name: 'retry', ids: CANONICAL_NOTIFICATION_RETRY_POLICY_IDS },
    { name: 'consent', ids: CANONICAL_NOTIFICATION_CONSENT_POLICY_IDS },
    { name: 'preference', ids: CANONICAL_NOTIFICATION_PREFERENCE_POLICY_IDS },
    { name: 'escalation', ids: CANONICAL_NOTIFICATION_ESCALATION_POLICY_IDS },
    { name: 'redaction', ids: CANONICAL_NOTIFICATION_REDACTION_POLICY_IDS },
  ]) {
    if (new Set(policySet.ids).size !== policySet.ids.length) {
      errors.push(`Duplicate notification ${policySet.name}PolicyId in vocabulary`);
    }
  }

  for (const policies of [
    CANONICAL_NOTIFICATION_DELIVERY_POLICIES,
    CANONICAL_NOTIFICATION_RETRY_POLICIES,
    CANONICAL_NOTIFICATION_CONSENT_POLICIES,
    CANONICAL_NOTIFICATION_PREFERENCE_POLICIES,
    CANONICAL_NOTIFICATION_ESCALATION_POLICIES,
    CANONICAL_NOTIFICATION_REDACTION_POLICIES,
    CANONICAL_NOTIFICATION_RETENTION_POLICIES,
  ]) {
    for (const policy of policies) {
      if (policy.failureBehavior?.failClosed !== true) {
        errors.push(`Notification policy "${policy.policyId}" must declare failureBehavior.failClosed=true`);
      }
    }
  }

  const seenLocalIds = new Map<string, string>();
  const seenDeepLinks = new Map<string, string>();
  const seenRoutes = new Map<string, string>();
  const seenExtensionIds = new Map<string, string>();

  function checkCommon(owner: string, entry: {
    moduleId: string;
    ownerModuleId: string;
    providerKey: string;
    permissionResource: string;
    permissionAction: string;
    schemaVersion: string;
    deepLinkTemplate: string;
    localId: string;
    contributionSchemaVersion: number;
  }): void {
    if (entry.moduleId !== entry.ownerModuleId) {
      errors.push(`${owner} moduleId must equal ownerModuleId`);
    }
    if (entry.providerKey !== NOTIFICATION_BUILTIN_PROVIDER_KEY || !PROVIDER_KEY_PATTERN.test(entry.providerKey)) {
      errors.push(`${owner} has invalid providerKey "${entry.providerKey}"`);
    }
    if (!entry.permissionResource?.startsWith('api.')) {
      errors.push(`${owner} has invalid permissionResource "${entry.permissionResource}"`);
    }
    if (!VALID_PERMISSION_ACTIONS.has(entry.permissionAction)) {
      errors.push(`${owner} has invalid permissionAction "${entry.permissionAction}"`);
    }
    if (entry.schemaVersion !== '1') {
      errors.push(`${owner} schemaVersion must be "1"`);
    }
    if (entry.contributionSchemaVersion !== 1) {
      errors.push(`${owner} contributionSchemaVersion must be 1`);
    }
    if (!entry.deepLinkTemplate?.startsWith('/')) {
      errors.push(`${owner} deepLinkTemplate must start with "/"`);
    } else {
      const prior = seenDeepLinks.get(entry.deepLinkTemplate);
      if (prior) {
        errors.push(`Duplicate deepLinkTemplate "${entry.deepLinkTemplate}" (${prior} and ${owner})`);
      } else {
        seenDeepLinks.set(entry.deepLinkTemplate, owner);
      }
    }
    const localKey = `${entry.moduleId}::${entry.localId}`;
    const priorLocal = seenLocalIds.get(localKey);
    if (priorLocal) {
      errors.push(`Duplicate notification localId "${entry.localId}" within module (${priorLocal} and ${owner})`);
    } else {
      seenLocalIds.set(localKey, owner);
    }
    if (seenExtensionIds.has(owner)) {
      errors.push(`Duplicate notification extensionId "${owner}"`);
    } else {
      seenExtensionIds.set(owner, owner);
    }
  }

  for (const category of CANONICAL_NOTIFICATION_CATEGORIES) {
    if (!category.ownerModuleId) {
      errors.push(`Category "${category.categoryId}" missing ownerModuleId`);
    }
  }

  for (const channel of CANONICAL_NOTIFICATION_CHANNELS) {
    const owner = `${channel.moduleId}/notification/${channel.localId}`;
    checkCommon(owner, channel);
    if (channel.permissionAction !== 'view') {
      errors.push(`Channel ${owner} permissionAction must be "view"`);
    }
    if (!VALID_IMPLEMENTATION_STATUSES.has(channel.implementationStatus)) {
      errors.push(`Channel ${owner} has invalid implementationStatus "${channel.implementationStatus}"`);
    }
    if (channel.runtimeImplemented && channel.implementationStatus === 'not-implemented') {
      errors.push(`Channel ${owner} runtimeImplemented=true conflicts with implementationStatus="not-implemented"`);
    }
    if (!channel.runtimeImplemented && channel.implementationStatus === 'full') {
      errors.push(`Channel ${owner} runtimeImplemented=false conflicts with implementationStatus="full"`);
    }
    if (channel.fallbackChannelId && !CHANNEL_IDS.has(channel.fallbackChannelId)) {
      errors.push(`Channel ${owner} references invalid fallbackChannelId "${channel.fallbackChannelId}"`);
    }
  }

  for (const type of CANONICAL_NOTIFICATION_TYPES) {
    const owner = `${type.moduleId}/notification/${type.localId}`;
    checkCommon(owner, type);
    if (type.permissionAction !== 'view') {
      errors.push(`Type ${owner} permissionAction must be "view"`);
    }
    if (!CATEGORY_IDS.has(type.categoryId)) {
      errors.push(`Type ${owner} references invalid categoryId "${type.categoryId}"`);
    }
    if (!VALID_IMPLEMENTATION_STATUSES.has(type.implementationStatus)) {
      errors.push(`Type ${owner} has invalid implementationStatus "${type.implementationStatus}"`);
    }
    if (type.requiresConsent && !type.consentPolicyId) {
      errors.push(`Type ${owner} requiresConsent=true must declare consentPolicyId`);
    }
    if (type.consentPolicyId && !CONSENT_POLICY_IDS.has(type.consentPolicyId)) {
      errors.push(`Type ${owner} references invalid consentPolicyId "${type.consentPolicyId}"`);
    }
    if (type.sensitive && !type.redactionPolicyId) {
      errors.push(`Type ${owner} sensitive=true must declare redactionPolicyId`);
    }
    if (type.redactionPolicyId && !REDACTION_POLICY_IDS.has(type.redactionPolicyId)) {
      errors.push(`Type ${owner} references invalid redactionPolicyId "${type.redactionPolicyId}"`);
    }
    if (!type.defaultChannelIds.length) {
      errors.push(`Type ${owner} must declare at least one defaultChannelId`);
    }
    for (const channelId of type.defaultChannelIds) {
      if (!CHANNEL_IDS.has(channelId)) {
        errors.push(`Type ${owner} references invalid defaultChannelId "${channelId}"`);
      }
    }
  }

  for (const template of CANONICAL_NOTIFICATION_TEMPLATES) {
    const owner = `${template.moduleId}/notification/${template.localId}`;
    checkCommon(owner, template);
    if (template.permissionAction !== 'view') {
      errors.push(`Template ${owner} permissionAction must be "view"`);
    }
    if (!TYPE_IDS.has(template.typeId)) {
      errors.push(`Template ${owner} references invalid typeId "${template.typeId}"`);
    }
    if (!CHANNEL_IDS.has(template.channelId)) {
      errors.push(`Template ${owner} references invalid channelId "${template.channelId}"`);
    }
    if (template.locale !== 'en') {
      errors.push(`Template ${owner} locale must be "en" (Phase 41a foundation, single locale)`);
    }
    if (template.publicationStatus !== 'draft' && template.publicationStatus !== 'published') {
      errors.push(`Template ${owner} has invalid publicationStatus "${template.publicationStatus}"`);
    }
    for (const variableName of template.variableNames) {
      if (SECRET_VARIABLE_PATTERN.test(variableName)) {
        errors.push(`Template ${owner} declares a secret-like variable name "${variableName}" (fail-closed)`);
      }
    }
  }

  for (const provider of CANONICAL_NOTIFICATION_PROVIDERS) {
    const owner = `${provider.moduleId}/notification/${provider.localId}`;
    checkCommon(owner, provider);
    if (provider.permissionAction !== 'view') {
      errors.push(`Provider ${owner} permissionAction must be "view"`);
    }
    if (!CHANNEL_IDS.has(provider.channelId)) {
      errors.push(`Provider ${owner} references invalid channelId "${provider.channelId}"`);
    }
    if (provider.requiresCredentials !== false) {
      errors.push(`Provider ${owner} requiresCredentials must be false (fail-closed, no credential storage)`);
    }
    if (provider.vendor !== 'platform') {
      errors.push(`Provider ${owner} vendor must be "platform" (no external vendor names)`);
    }
    if (!VALID_IMPLEMENTATION_STATUSES.has(provider.implementationStatus)) {
      errors.push(`Provider ${owner} has invalid implementationStatus "${provider.implementationStatus}"`);
    }
  }

  for (const surface of CANONICAL_NOTIFICATION_SURFACES_NAV) {
    const owner = `${surface.moduleId}/notification/${surface.localId}`;
    checkCommon(owner, surface);
    if (!surface.route?.startsWith('/settings/notifications/')) {
      errors.push(`Surface ${owner} route must be under "/settings/notifications/" (got "${surface.route}")`);
    } else {
      const priorRoute = seenRoutes.get(surface.route);
      if (priorRoute) {
        errors.push(`Duplicate route "${surface.route}" (${priorRoute} and ${owner})`);
      } else {
        seenRoutes.set(surface.route, owner);
      }
    }
    if (surface.requiredFeature && !VALID_FEATURE_IDS.has(surface.requiredFeature)) {
      errors.push(`Surface ${owner} has invalid featureId "${surface.requiredFeature}"`);
    }
  }

  for (const pack of CANONICAL_NOTIFICATION_PACKS) {
    const owner = `${pack.moduleId}/notification/${pack.localId}`;
    checkCommon(owner, pack);
    if (!pack.includedTypeIds.length) {
      errors.push(`Pack ${owner} must include at least one typeId`);
    }
    for (const typeId of pack.includedTypeIds) {
      if (!TYPE_IDS.has(typeId)) {
        errors.push(`Pack ${owner} references invalid typeId "${typeId}"`);
      }
    }
  }

  return errors;
}
