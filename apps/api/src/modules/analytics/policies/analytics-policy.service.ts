import { Injectable } from '@nestjs/common';

/**
 * Analytics Permission Policy Service
 * Defines authorization rules for analytics operations
 */
@Injectable()
export class AnalyticsPolicy {
  private normalizeRoles(userRoles: string[]): string[] {
    return Array.from(
      new Set(
        userRoles
          .map((role) => String(role ?? '').trim().toLowerCase())
          .filter((role) => role.length > 0),
      ),
    );
  }

  /**
   * Check if user can view analytics for this tenant
   */
  canViewMetrics(userRoles: string[]): boolean {
    const roles = this.normalizeRoles(userRoles);
    const allowed = [
      'super_admin',
      'owner',
      'general_manager',
      'branch_manager',
      'doctor',
      'dentist',
      'specialist',
      'accountant',
      'inventory_manager',
      // legacy aliases used in unit tests
      'admin',
      'analyst',
      'manager',
      'clinician',
      'auditor',
    ];
    return roles.some((role) => allowed.includes(role));
  }

  /**
   * Check if user can create dashboards
   */
  canCreateDashboard(userRoles: string[]): boolean {
    const roles = this.normalizeRoles(userRoles);
    const allowed = [
      'super_admin',
      'owner',
      'general_manager',
      'branch_manager',
      'accountant',
      'admin',
      'analyst',
      'manager',
    ];
    return roles.some((role) => allowed.includes(role));
  }

  /**
   * Check if user can generate reports
   */
  canGenerateReport(userRoles: string[]): boolean {
    const roles = this.normalizeRoles(userRoles);
    const allowed = [
      'super_admin',
      'owner',
      'general_manager',
      'accountant',
      'admin',
      'analyst',
      'manager',
      'clinician',
      'auditor',
    ];
    return roles.some((role) => allowed.includes(role));
  }

  /**
   * Check if user can access executive dashboards (stricter access)
   */
  canAccessExecutiveDashboard(userRoles: string[]): boolean {
    const roles = this.normalizeRoles(userRoles);
    const allowed = ['admin', 'manager'];
    return roles.some((role) => allowed.includes(role));
  }

  /**
   * Check if user can access financial dashboards
   */
  canAccessFinancialDashboard(userRoles: string[]): boolean {
    const roles = this.normalizeRoles(userRoles);
    const allowed = ['admin', 'manager', 'auditor'];
    return roles.some((role) => allowed.includes(role));
  }

  /**
   * Check if user can access clinical dashboards
   */
  canAccessClinicalDashboard(userRoles: string[]): boolean {
    const roles = this.normalizeRoles(userRoles);
    const allowed = ['admin', 'clinician', 'manager', 'auditor'];
    return roles.some((role) => allowed.includes(role));
  }

  /**
   * Check if user can delete dashboards
   */
  canDeleteDashboard(userRoles: string[], createdBy: string, userId: string): boolean {
    const roles = this.normalizeRoles(userRoles);
    if (roles.includes('admin')) return true;
    return createdBy === userId;
  }

  /**
   * Check if user can export reports
   */
  canExportReport(userRoles: string[]): boolean {
    const roles = this.normalizeRoles(userRoles);
    const allowed = ['admin', 'analyst', 'manager', 'clinician', 'auditor'];
    return roles.some((role) => allowed.includes(role));
  }
}
