import {
  PLATFORM_DASHBOARD_METRICS,
  SECTION_ORDER,
  assertMetricRegistryIntegrity,
} from '../application/metric-registry';

describe('Platform dashboard metric registry', () => {
  it('passes integrity checks', () => {
    expect(() => assertMetricRegistryIntegrity()).not.toThrow();
  });

  it('has unique metric ids', () => {
    const ids = PLATFORM_DASHBOARD_METRICS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every metric declares at least one required permission', () => {
    for (const metric of PLATFORM_DASHBOARD_METRICS) {
      expect(metric.requiredPermissions.length).toBeGreaterThan(0);
    }
  });

  it('every metric belongs to a known section', () => {
    for (const metric of PLATFORM_DASHBOARD_METRICS) {
      expect(SECTION_ORDER).toContain(metric.section);
    }
  });

  it('unavailable metrics carry a reasonCode and no resolver', () => {
    const unavailable = PLATFORM_DASHBOARD_METRICS.filter((m) => m.availability === 'unavailable');
    expect(unavailable.length).toBeGreaterThan(0);
    for (const metric of unavailable) {
      expect(metric.reasonCode).toBeTruthy();
      expect(metric.resolverKey).toBeUndefined();
    }
  });

  it('registers exactly the frozen unavailable reason codes', () => {
    const reasonById = new Map(
      PLATFORM_DASHBOARD_METRICS.filter((m) => m.reasonCode).map((m) => [m.id, m.reasonCode]),
    );
    expect(reasonById.get('planVersion.distribution')).toBe('no_plan_version_source');
    expect(reasonById.get('specialty.distribution')).toBe('free_text_specialty_unsafe');
    expect(reasonById.get('addon.summary')).toBe('no_addon_source');
    expect(reasonById.get('override.summary')).toBe('no_override_source');
    expect(reasonById.get('override.expiring')).toBe('no_override_source');
    expect(reasonById.get('entitlement.conflicts')).toBe('no_conflict_source');
    expect(reasonById.get('limit.utilization')).toBe('no_aggregate_usage_source');
    expect(reasonById.get('operations.health')).toBe('health_adapter_deferred');
    expect(reasonById.get('backup.summary')).toBe('backup_not_platform_jwt_boundary');
    expect(reasonById.get('incidents.open')).toBe('incidents_in_process_tenant_scoped');
    expect(reasonById.get('sales.summary')).toBe('no_sales_source');
    expect(reasonById.get('audit.preview')).toBe('no_platform_audit_summary');
  });

  it('labels legacy plan tier as legacy — never as a plan version', () => {
    const legacy = PLATFORM_DASHBOARD_METRICS.find((m) => m.id === 'legacyPlan.assignment');
    expect(legacy).toBeDefined();
    expect(legacy?.availability).toBe('available_legacy');
    const haystack = `${legacy?.id} ${legacy?.labelKey} ${legacy?.sourceKey} ${legacy?.definitionKey}`.toLowerCase();
    expect(haystack).not.toContain('planversion');
    expect(haystack).not.toContain('plan_version');
    expect(haystack).not.toContain('plan.version');

    // The dedicated plan-version metric must remain unavailable (no source yet).
    const planVersion = PLATFORM_DASHBOARD_METRICS.find((m) => m.id === 'planVersion.distribution');
    expect(planVersion?.availability).toBe('unavailable');
  });

  it('requires plan.view for the legacy plan metric', () => {
    const legacy = PLATFORM_DASHBOARD_METRICS.find((m) => m.id === 'legacyPlan.assignment');
    expect(legacy?.requiredPermissions).toContain('plan.view');
  });
});
