import {
  ANALYTICS_AGGREGATE_CAPABILITY_IDS,
  type AnalyticsAggregateCapabilityContractEntry,
} from './analytics-types';
import { CANONICAL_ANALYTICS_DOMAINS } from './canonical-analytics-domains';
import { CANONICAL_ANALYTICS_HUBS } from './canonical-analytics-hubs';
import { CANONICAL_REPORT_TEMPLATES } from '../reporting/canonical-report-templates';

/**
 * Aggregate analytics capability contract (Phase 34a M4).
 * Architecture-only — runtime derivation is implemented in Phase 34b DynamicAnalyticsProvider.
 * UI must never recompute these from RBAC or licensing matrices in registry mode.
 */
export const ANALYTICS_AGGREGATE_CAPABILITY_CONTRACT: readonly AnalyticsAggregateCapabilityContractEntry[] = [
  {
    capabilityId: 'canViewAnalytics',
    derivedFrom: 'snapshot',
    requiredSnapshotSignals: [
      'entries.some(analyticsKind=domain && userVisible)',
      'hubs.catalog.userVisible',
      'bootstrap.analyticsModule.userAccessible',
    ],
    forbiddenClientDuplication: true,
  },
  {
    capabilityId: 'canCreateDashboards',
    derivedFrom: 'snapshot',
    requiredSnapshotSignals: [
      'hubs.builder.userVisible',
      'entries.some(permissionAction=create && userAccessible)',
      'forecasting.domain.userAccessible',
    ],
    forbiddenClientDuplication: true,
  },
  {
    capabilityId: 'canExportAnalytics',
    derivedFrom: 'snapshot',
    requiredSnapshotSignals: [
      'hubs.export-center.userVisible',
      'entries.some(permissionAction=export && userAccessible)',
      'hubs.export-center.exportFormats.length > 0',
    ],
    forbiddenClientDuplication: true,
  },
  {
    capabilityId: 'canScheduleAnalytics',
    derivedFrom: 'snapshot',
    requiredSnapshotSignals: [
      'reportLinkIds.some(scheduleAllowed=true && featureId=analytics)',
      'canExportAnalytics',
      'entries.some(permissionAction=create && userAccessible)',
    ],
    forbiddenClientDuplication: true,
  },
] as const;

const SCHEDULABLE_ANALYTICS_REPORT_COUNT = CANONICAL_REPORT_TEMPLATES.filter(
  (template) => template.featureId === 'analytics' && template.scheduleAllowed === true,
).length;

/** Fail-closed validation that vocabulary supports aggregate capability derivation in 34b. */
export function validateAnalyticsCapabilityContract(): string[] {
  const errors: string[] = [];

  if (ANALYTICS_AGGREGATE_CAPABILITY_CONTRACT.length !== ANALYTICS_AGGREGATE_CAPABILITY_IDS.length) {
    errors.push('Analytics aggregate capability contract must define all capability IDs');
  }

  const domainCount = CANONICAL_ANALYTICS_DOMAINS.length;
  if (domainCount < 1) {
    errors.push('canViewAnalytics requires at least one canonical analytics domain');
  }

  const builderHub = CANONICAL_ANALYTICS_HUBS.find((hub) => hub.hubId === 'builder');
  if (!builderHub || builderHub.permissionAction !== 'create') {
    errors.push('canCreateDashboards requires builder hub with permissionAction create');
  }

  const exportHub = CANONICAL_ANALYTICS_HUBS.find((hub) => hub.hubId === 'export-center');
  if (!exportHub || exportHub.permissionAction !== 'export') {
    errors.push('canExportAnalytics requires export-center hub with permissionAction export');
  }
  if (!exportHub?.exportFormats?.length) {
    errors.push('canExportAnalytics requires export-center hub exportFormats metadata');
  }

  const catalogHub = CANONICAL_ANALYTICS_HUBS.find((hub) => hub.hubId === 'catalog');
  if (!catalogHub || catalogHub.permissionAction !== 'view') {
    errors.push('canViewAnalytics requires catalog hub with permissionAction view');
  }

  if (SCHEDULABLE_ANALYTICS_REPORT_COUNT < 1) {
    errors.push('canScheduleAnalytics requires at least one scheduleAllowed analytics report template');
  }

  const forecastingDomain = CANONICAL_ANALYTICS_DOMAINS.find((domain) => domain.domainId === 'forecasting');
  if (!forecastingDomain || forecastingDomain.permissionAction !== 'create') {
    errors.push('canCreateDashboards vocabulary should include forecasting domain with create action');
  }

  for (const entry of ANALYTICS_AGGREGATE_CAPABILITY_CONTRACT) {
    if (entry.derivedFrom !== 'snapshot') {
      errors.push(`Capability "${entry.capabilityId}" must derive from snapshot only`);
    }
    if (!entry.forbiddenClientDuplication) {
      errors.push(`Capability "${entry.capabilityId}" must forbid client duplication`);
    }
    if (!entry.requiredSnapshotSignals.length) {
      errors.push(`Capability "${entry.capabilityId}" must declare requiredSnapshotSignals`);
    }
  }

  return errors;
}
