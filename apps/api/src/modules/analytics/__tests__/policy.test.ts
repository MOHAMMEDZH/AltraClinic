import { AnalyticsPolicy } from '../policies/analytics-policy.service';

describe('Analytics Permission Policy', () => {
  let policy: AnalyticsPolicy;

  beforeEach(() => {
    policy = new AnalyticsPolicy();
  });

  describe('canViewMetrics', () => {
    it('should allow admin to view metrics', () => {
      expect(policy.canViewMetrics(['admin'])).toBe(true);
    });

    it('should allow analyst to view metrics', () => {
      expect(policy.canViewMetrics(['analyst'])).toBe(true);
    });

    it('should allow manager to view metrics', () => {
      expect(policy.canViewMetrics(['manager'])).toBe(true);
    });

    it('should deny patient from viewing metrics', () => {
      expect(policy.canViewMetrics(['patient'])).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(policy.canViewMetrics(['ADMIN'])).toBe(true);
      expect(policy.canViewMetrics(['AnAlYsT'])).toBe(true);
    });
  });

  describe('canCreateDashboard', () => {
    it('should allow admin to create dashboard', () => {
      expect(policy.canCreateDashboard(['admin'])).toBe(true);
    });

    it('should allow analyst to create dashboard', () => {
      expect(policy.canCreateDashboard(['analyst'])).toBe(true);
    });

    it('should deny clinician from creating dashboard', () => {
      expect(policy.canCreateDashboard(['clinician'])).toBe(false);
    });
  });

  describe('canGenerateReport', () => {
    it('should allow admin to generate report', () => {
      expect(policy.canGenerateReport(['admin'])).toBe(true);
    });

    it('should allow clinician to generate report', () => {
      expect(policy.canGenerateReport(['clinician'])).toBe(true);
    });

    it('should allow auditor to generate report', () => {
      expect(policy.canGenerateReport(['auditor'])).toBe(true);
    });
  });

  describe('canAccessExecutiveDashboard', () => {
    it('should only allow admin and manager', () => {
      expect(policy.canAccessExecutiveDashboard(['admin'])).toBe(true);
      expect(policy.canAccessExecutiveDashboard(['manager'])).toBe(true);
      expect(policy.canAccessExecutiveDashboard(['analyst'])).toBe(false);
      expect(policy.canAccessExecutiveDashboard(['clinician'])).toBe(false);
    });
  });

  describe('canAccessFinancialDashboard', () => {
    it('should allow admin, manager, and auditor', () => {
      expect(policy.canAccessFinancialDashboard(['admin'])).toBe(true);
      expect(policy.canAccessFinancialDashboard(['manager'])).toBe(true);
      expect(policy.canAccessFinancialDashboard(['auditor'])).toBe(true);
      expect(policy.canAccessFinancialDashboard(['clinician'])).toBe(false);
    });
  });

  describe('canAccessClinicalDashboard', () => {
    it('should allow clinical users', () => {
      expect(policy.canAccessClinicalDashboard(['admin'])).toBe(true);
      expect(policy.canAccessClinicalDashboard(['clinician'])).toBe(true);
      expect(policy.canAccessClinicalDashboard(['auditor'])).toBe(true);
      expect(policy.canAccessClinicalDashboard(['manager'])).toBe(true);
    });
  });

  describe('canDeleteDashboard', () => {
    it('should allow admin to delete any dashboard', () => {
      expect(policy.canDeleteDashboard(['admin'], 'user-2', 'user-1')).toBe(true);
    });

    it('should allow creator to delete their dashboard', () => {
      expect(policy.canDeleteDashboard(['analyst'], 'user-1', 'user-1')).toBe(true);
    });

    it('should deny non-admin non-creator from deleting', () => {
      expect(policy.canDeleteDashboard(['analyst'], 'user-2', 'user-1')).toBe(false);
    });
  });

  describe('canExportReport', () => {
    it('should allow most roles to export', () => {
      expect(policy.canExportReport(['admin'])).toBe(true);
      expect(policy.canExportReport(['analyst'])).toBe(true);
      expect(policy.canExportReport(['manager'])).toBe(true);
      expect(policy.canExportReport(['clinician'])).toBe(true);
      expect(policy.canExportReport(['auditor'])).toBe(true);
    });
  });
});
