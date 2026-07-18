import type { AnalyticsContribution, ModuleManifest } from '../types';
import { CANONICAL_ANALYTICS_DOMAINS } from './canonical-analytics-domains';
import { CANONICAL_ANALYTICS_HUBS, CANONICAL_ANALYTICS_HUB_COUNT } from './canonical-analytics-hubs';
import { CANONICAL_ANALYTICS_WIDGETS, CANONICAL_ANALYTICS_WIDGET_COUNT } from './canonical-analytics-widgets';
import {
  CANONICAL_ANALYTICS_DOMAIN_COUNT,
} from './canonical-analytics-domains';
import {
  CANONICAL_CROSS_MODULE_ANALYTICS,
  CANONICAL_CROSS_MODULE_ANALYTICS_COUNT,
  CANONICAL_ANALYTICS_ENTRY_COUNT,
} from './canonical-cross-module-analytics';
import {
  CANONICAL_ANALYTICS_FEATURE_IDS,
  type AnalyticsExportFormat,
  type AnalyticsPermissionAction,
  type CanonicalAnalyticsEntry,
  type CanonicalAnalyticsWidget,
} from './analytics-types';
import { validateCanonicalAnalyticsVocabulary } from './validate-canonical-analytics-vocabulary';

const CANONICAL_ENTRIES: CanonicalAnalyticsEntry[] = [
  ...CANONICAL_ANALYTICS_DOMAINS,
  ...CANONICAL_ANALYTICS_WIDGETS,
  ...CANONICAL_ANALYTICS_HUBS,
  ...CANONICAL_CROSS_MODULE_ANALYTICS,
];

function expectedDeepLinkTemplate(entry: CanonicalAnalyticsEntry): string {
  if (entry.analyticsKind === 'widget') {
    return `/analytics/builder?widget=${(entry as CanonicalAnalyticsWidget).widgetCatalogId}`;
  }
  return entry.deepLinkTemplate;
}

const CANONICAL_BY_EXTENSION_ID = new Map(
  CANONICAL_ENTRIES.map((entry) => [`${entry.moduleId}/analytics/${entry.localId}`, entry]),
);

const CANONICAL_ANALYTICS_IDS = new Set(CANONICAL_ENTRIES.map((entry) => entry.analyticsId));

const HUB_LOCAL_IDS = new Set(CANONICAL_ANALYTICS_HUBS.map((hub) => hub.localId));

const VALID_ACTIONS = new Set<AnalyticsPermissionAction>(['view', 'create', 'export']);
const VALID_EXPORT_FORMATS = new Set<AnalyticsExportFormat>(['pdf', 'csv', 'excel', 'json', 'xlsx']);
const VALID_FEATURE_IDS = new Set<string>(CANONICAL_ANALYTICS_FEATURE_IDS);
const PROVIDER_KEY_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)+$/;

function normalizePermissionResources(contrib: AnalyticsContribution): string[] {
  if (contrib.permissionResources?.length) return [...contrib.permissionResources];
  if (contrib.permissionResource) return [contrib.permissionResource];
  if (contrib.resourceId) return [contrib.resourceId];
  return [];
}

export function validateBuiltinAnalyticsIntegrity(manifests: ModuleManifest[]): string[] {
  const errors: string[] = [...validateCanonicalAnalyticsVocabulary()];

  const seenExtensionIds = new Map<string, string>();
  const seenAnalyticsIds = new Map<string, string>();
  const seenWidgetCatalogIds = new Map<string, string>();
  const seenWidgetLocalIds = new Map<string, string>();
  const seenDomainRoutes = new Map<string, string>();
  const seenDeepLinks = new Map<string, string>();

  let manifestAnalyticsCount = 0;

  for (const manifest of manifests) {
    const analytics = manifest.extensions.analytics ?? [];
    manifestAnalyticsCount += analytics.length;

    for (const contribution of analytics) {
      const owner = contribution.extensionId;

      const priorExt = seenExtensionIds.get(contribution.extensionId);
      if (priorExt) {
        errors.push(`Duplicate analytics extensionId "${contribution.extensionId}" (${priorExt} and ${owner})`);
      } else {
        seenExtensionIds.set(contribution.extensionId, owner);
      }

      const priorAnalytics = seenAnalyticsIds.get(contribution.analyticsId);
      if (priorAnalytics) {
        errors.push(`Duplicate analyticsId "${contribution.analyticsId}" (${priorAnalytics} and ${owner})`);
      } else {
        seenAnalyticsIds.set(contribution.analyticsId, owner);
      }

      if (contribution.widgetCatalogId) {
        const priorCatalogId = seenWidgetCatalogIds.get(contribution.widgetCatalogId);
        if (priorCatalogId) {
          errors.push(
            `Duplicate widgetCatalogId "${contribution.widgetCatalogId}" (${priorCatalogId} and ${owner})`,
          );
        } else {
          seenWidgetCatalogIds.set(contribution.widgetCatalogId, owner);
        }
      }

      if (contribution.analyticsKind === 'widget' && contribution.localId) {
        const priorLocalId = seenWidgetLocalIds.get(contribution.localId);
        if (priorLocalId) {
          errors.push(`Duplicate widget localId "${contribution.localId}" (${priorLocalId} and ${owner})`);
        } else {
          seenWidgetLocalIds.set(contribution.localId, owner);
        }
      }

      if (!contribution.extensionId.startsWith(`${manifest.moduleId}/analytics/`)) {
        errors.push(
          `Analytics extensionId "${contribution.extensionId}" must be prefixed with ${manifest.moduleId}/analytics/`,
        );
      }

      if (HUB_LOCAL_IDS.has(contribution.localId) && manifest.moduleId !== 'analytics') {
        errors.push(`Hub "${contribution.localId}" must be declared on analytics module (found on ${manifest.moduleId})`);
      }

      const action = contribution.permissionAction;
      if (!action || !VALID_ACTIONS.has(action)) {
        errors.push(`Analytics contribution ${owner} has invalid permissionAction "${String(action)}"`);
      }

      const resources = normalizePermissionResources(contribution);
      if (!resources.length) {
        errors.push(`Analytics contribution ${owner} missing permissionResource(s)`);
      } else {
        for (const resource of resources) {
          if (!resource.startsWith('api.')) {
            errors.push(`Analytics contribution ${owner} has invalid permission resource "${resource}"`);
          }
        }
      }

      if (contribution.featureId && !VALID_FEATURE_IDS.has(contribution.featureId)) {
        errors.push(`Analytics contribution ${owner} has invalid featureId "${contribution.featureId}"`);
      }

      if (!contribution.deepLinkTemplate) {
        errors.push(`Analytics contribution ${owner} missing deepLinkTemplate`);
      } else {
        if (!contribution.deepLinkTemplate.startsWith('/')) {
          errors.push(`Analytics contribution ${owner} deepLinkTemplate must start with "/"`);
        }
        const prior = seenDeepLinks.get(contribution.deepLinkTemplate);
        if (prior) {
          errors.push(`Duplicate deepLinkTemplate "${contribution.deepLinkTemplate}" (${prior} and ${owner})`);
        } else {
          seenDeepLinks.set(contribution.deepLinkTemplate, owner);
        }
      }

      if (contribution.route) {
        if (!contribution.route.startsWith('/')) {
          errors.push(`Analytics contribution ${owner} has invalid route "${contribution.route}"`);
        }
        if (contribution.analyticsKind === 'domain' || contribution.analyticsKind === 'hub') {
          const priorRoute = seenDomainRoutes.get(contribution.route);
          if (priorRoute) {
            errors.push(`Duplicate route "${contribution.route}" (${priorRoute} and ${owner})`);
          } else {
            seenDomainRoutes.set(contribution.route, owner);
          }
        }
      }

      if (!contribution.providerKey) {
        errors.push(`Analytics contribution ${owner} missing providerKey`);
      } else if (!PROVIDER_KEY_PATTERN.test(contribution.providerKey)) {
        errors.push(`Analytics contribution ${owner} has invalid providerKey "${contribution.providerKey}"`);
      }

      if (contribution.exportFormats?.length) {
        for (const format of contribution.exportFormats) {
          if (!VALID_EXPORT_FORMATS.has(format)) {
            errors.push(`Analytics contribution ${owner} has invalid exportFormat "${String(format)}"`);
          }
        }
      }

      const canonical = CANONICAL_BY_EXTENSION_ID.get(contribution.extensionId);
      if (!canonical) {
        errors.push(`Orphan analytics contribution "${contribution.extensionId}" (no canonical entry)`);
        continue;
      }

      if (manifest.moduleId !== canonical.moduleId) {
        errors.push(
          `Analytics "${contribution.analyticsId}" ownership mismatch: manifest=${manifest.moduleId} canonical=${canonical.moduleId}`,
        );
      }

      if (contribution.analyticsId !== canonical.analyticsId) {
        errors.push(
          `Analytics "${contribution.localId}" analyticsId mismatch: manifest=${contribution.analyticsId} canonical=${canonical.analyticsId}`,
        );
      }

      if (contribution.analyticsKind !== canonical.analyticsKind) {
        errors.push(
          `Analytics "${contribution.localId}" analyticsKind mismatch: manifest=${contribution.analyticsKind} canonical=${canonical.analyticsKind}`,
        );
      }

      if (contribution.categoryId !== canonical.categoryId) {
        errors.push(
          `Analytics "${contribution.localId}" categoryId mismatch: manifest=${contribution.categoryId} canonical=${canonical.categoryId}`,
        );
      }

      if (contribution.dataDomain !== canonical.dataDomain) {
        errors.push(
          `Analytics "${contribution.localId}" dataDomain mismatch: manifest=${contribution.dataDomain} canonical=${canonical.dataDomain}`,
        );
      }

      if (contribution.permissionAction !== canonical.permissionAction) {
        errors.push(
          `Analytics "${contribution.localId}" permissionAction mismatch: manifest=${contribution.permissionAction} canonical=${canonical.permissionAction}`,
        );
      }

      if (contribution.deepLinkTemplate !== expectedDeepLinkTemplate(canonical)) {
        errors.push(
          `Analytics "${contribution.localId}" deepLinkTemplate mismatch: manifest=${contribution.deepLinkTemplate} canonical=${expectedDeepLinkTemplate(canonical)}`,
        );
      }

      if ((contribution.route ?? null) !== ('route' in canonical ? canonical.route ?? null : null)) {
        errors.push(
          `Analytics "${contribution.localId}" route mismatch: manifest=${contribution.route ?? 'null'} canonical=${'route' in canonical ? canonical.route ?? 'null' : 'null'}`,
        );
      }

      if ((contribution.featureId ?? null) !== (canonical.featureId ?? null)) {
        errors.push(
          `Analytics "${contribution.localId}" featureId mismatch: manifest=${contribution.featureId ?? 'null'} canonical=${canonical.featureId ?? 'null'}`,
        );
      }

      if ((contribution.providerKey ?? null) !== canonical.providerKey) {
        errors.push(
          `Analytics "${contribution.localId}" providerKey mismatch: manifest=${contribution.providerKey ?? 'null'} canonical=${canonical.providerKey}`,
        );
      }
    }
  }

  for (const analyticsId of CANONICAL_ANALYTICS_IDS) {
    if (!seenAnalyticsIds.has(analyticsId)) {
      errors.push(`Missing analytics contribution for canonical analyticsId "${analyticsId}"`);
    }
  }

  if (manifestAnalyticsCount !== CANONICAL_ANALYTICS_ENTRY_COUNT) {
    errors.push(
      `Analytics contribution count mismatch: manifests=${manifestAnalyticsCount} expected=${CANONICAL_ANALYTICS_ENTRY_COUNT}`,
    );
  }

  if (CANONICAL_ANALYTICS_DOMAIN_COUNT !== 11) {
    errors.push(`Canonical analytics domain count must be 11 (got ${CANONICAL_ANALYTICS_DOMAIN_COUNT})`);
  }

  if (CANONICAL_ANALYTICS_WIDGET_COUNT !== 8) {
    errors.push(`Canonical analytics widget count must be 8 (got ${CANONICAL_ANALYTICS_WIDGET_COUNT})`);
  }

  if (CANONICAL_ANALYTICS_HUB_COUNT !== 3) {
    errors.push(`Canonical analytics hub count must be 3 (got ${CANONICAL_ANALYTICS_HUB_COUNT})`);
  }

  if (CANONICAL_CROSS_MODULE_ANALYTICS_COUNT !== 3) {
    errors.push(`Canonical cross-module analytics count must be 3 (got ${CANONICAL_CROSS_MODULE_ANALYTICS_COUNT})`);
  }

  return errors;
}
