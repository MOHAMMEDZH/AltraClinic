import type { StaticAnalyticsCatalogEntryLike } from '@booking/module-registry/analytics';
import { BUILTIN_MODULE_MANIFESTS } from '@booking/module-registry';
import { validateAnalyticsLayerParity } from '@booking/module-registry/analytics';
import type { AnalyticsSnapshot } from './analytics-types';
import { STATIC_ANALYTICS_CATALOG } from './static-analytics-catalog';

export function assertAnalyticsCatalogValid(catalog = STATIC_ANALYTICS_CATALOG): string[] {
  return validateAnalyticsLayerParity(BUILTIN_MODULE_MANIFESTS, catalog as readonly StaticAnalyticsCatalogEntryLike[]);
}

export function assertAnalyticsSnapshotValid(snapshot: AnalyticsSnapshot): string[] {
  const errors: string[] = [];
  const seenAnalyticsIds = new Set<string>();

  for (const domain of snapshot.domains) {
    if (seenAnalyticsIds.has(domain.analyticsId)) {
      errors.push(`Duplicate domain analyticsId in snapshot: ${domain.analyticsId}`);
    }
    seenAnalyticsIds.add(domain.analyticsId);

    const catalogEntry = STATIC_ANALYTICS_CATALOG.find(
      (entry) => entry.extensionId === domain.extensionId,
    );
    if (!catalogEntry) {
      errors.push(`Snapshot domain missing catalog match: ${domain.extensionId}`);
    }
  }

  for (const widget of snapshot.widgets) {
    if (seenAnalyticsIds.has(widget.analyticsId)) {
      errors.push(`Duplicate widget analyticsId in snapshot: ${widget.analyticsId}`);
    }
    seenAnalyticsIds.add(widget.analyticsId);
  }

  for (const hub of snapshot.hubs) {
    if (seenAnalyticsIds.has(hub.analyticsId)) {
      errors.push(`Duplicate hub analyticsId in snapshot: ${hub.analyticsId}`);
    }
    seenAnalyticsIds.add(hub.analyticsId);
  }

  if (
    snapshot.canViewAnalytics !==
    (snapshot.domains.length > 0 ||
      snapshot.hubs.some((hub) => hub.hubId === 'catalog') ||
      snapshot.entries.some((entry) => entry.analyticsKind === 'domain'))
  ) {
    if (snapshot.domains.length === 0 && !snapshot.hubs.some((hub) => hub.hubId === 'catalog')) {
      if (snapshot.canViewAnalytics) {
        errors.push('Snapshot canViewAnalytics flag mismatch');
      }
    }
  }

  if (snapshot.canViewAnalytics !== snapshot.capabilities.canViewAnalytics) {
    errors.push('Snapshot canViewAnalytics capability mismatch');
  }
  if (snapshot.canCreateDashboards !== snapshot.capabilities.canCreateDashboards) {
    errors.push('Snapshot canCreateDashboards capability mismatch');
  }
  if (snapshot.canExportAnalytics !== snapshot.capabilities.canExportAnalytics) {
    errors.push('Snapshot canExportAnalytics capability mismatch');
  }
  if (snapshot.canScheduleAnalytics !== snapshot.capabilities.canScheduleAnalytics) {
    errors.push('Snapshot canScheduleAnalytics capability mismatch');
  }

  for (const domain of snapshot.domains) {
    if (!snapshot.deepLinkByAnalyticsId[domain.analyticsId]) {
      errors.push(`Missing deepLinkByAnalyticsId for ${domain.analyticsId}`);
    }
    if (!snapshot.labelKeyByAnalyticsId[domain.analyticsId]) {
      errors.push(`Missing labelKeyByAnalyticsId for ${domain.analyticsId}`);
    }
  }

  return errors;
}

export function assertAnalyticsCatalogLoaded(): void {
  const errors = assertAnalyticsCatalogValid();
  if (errors.length > 0) {
    throw new Error(`Invalid static analytics catalog:\n${errors.join('\n')}`);
  }
}
