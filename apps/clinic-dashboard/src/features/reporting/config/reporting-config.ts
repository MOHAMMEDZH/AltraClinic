import { hasPermission } from '@booking/permissions';
import type { ReportTemplate } from './reporting-catalog';

export type ReportingPermCheck = (resource: string, action: string) => boolean;

export function canViewReporting(perm: ReportingPermCheck): boolean {
  return (
    perm('api.reporting', 'view')
    || perm('api.analytics', 'view')
    || perm('api.billing', 'view')
    || perm('api.inventory', 'view')
  );
}

export function canCreateReports(perm: ReportingPermCheck): boolean {
  return perm('api.analytics', 'create') || perm('api.reporting', 'create');
}

export function canExportReports(perm: ReportingPermCheck): boolean {
  return perm('api.analytics', 'export') || perm('api.reporting', 'export');
}

export function templateVisible(template: ReportTemplate, perm: ReportingPermCheck): boolean {
  return perm(template.permission.resource, template.permission.action);
}

export function buildPermCheck(roles: string[]): ReportingPermCheck {
  return (resource, action) => hasPermission(roles, resource as never, action as never);
}

export const FAVORITES_STORAGE_KEY = 'clinic-report-favorites';
export const RECENTS_STORAGE_KEY = 'clinic-report-recents';
export const MAX_RECENTS = 12;
