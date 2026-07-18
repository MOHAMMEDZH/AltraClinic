import { hasPermission } from '@booking/permissions';
import type { AnalyticsDomainId } from './analytics-catalog';

export type AnalyticsPermCheck = (resource: string, action: string) => boolean;

export function buildAnalyticsPermCheck(roles: string[]): AnalyticsPermCheck {
  return (resource, action) => hasPermission(roles, resource as never, action as never);
}

export function canViewAnalytics(perm: AnalyticsPermCheck): boolean {
  return perm('api.analytics', 'view');
}

export function canCreateAnalytics(perm: AnalyticsPermCheck): boolean {
  return perm('api.analytics', 'create');
}

export function canExportAnalytics(perm: AnalyticsPermCheck): boolean {
  return perm('api.analytics', 'export');
}

export function canViewAnalyticsDomain(domainId: AnalyticsDomainId, perm: AnalyticsPermCheck): boolean {
  switch (domainId) {
    case 'executive':
    case 'operations':
    case 'patients':
    case 'staff':
    case 'branches':
      return canViewAnalytics(perm);
    case 'financial':
      return perm('api.analytics', 'view') || perm('api.billing', 'view');
    case 'inventory':
      return perm('api.analytics', 'view') || perm('api.inventory', 'view');
    case 'clinical':
      return perm('api.analytics', 'view') || perm('api.emr', 'view');
    case 'dental':
      return perm('api.analytics', 'view') || perm('api.dental', 'view');
    case 'beauty':
      return perm('api.analytics', 'view') || perm('api.beauty', 'view');
    case 'forecasting':
      return canCreateAnalytics(perm);
    default:
      return canViewAnalytics(perm);
  }
}

export const ANALYTICS_FAVORITES_KEY = 'clinic-analytics-favorites';
export const ANALYTICS_RECENTS_KEY = 'clinic-analytics-recents';
export const MAX_ANALYTICS_RECENTS = 8;
