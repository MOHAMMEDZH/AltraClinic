/**
 * Flexible Step 20 — foundation + resolver precedence (unit / in-memory friendly).
 */
import { OperationalDecisionService } from '../application/operational-decision.service';

describe('Step 20 operational decision foundation', () => {
  it('percentage bucket is deterministic across instances', () => {
    const a = OperationalDecisionService.percentageBucket('ops.demo', 'tenant-1');
    const b = OperationalDecisionService.percentageBucket('ops.demo', 'tenant-1');
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(100);
  });

  it('percentage 0 excludes all; 100 includes all', () => {
    const svc = Object.create(OperationalDecisionService.prototype) as OperationalDecisionService;
    expect(svc.isTenantInPercentage('ops.x', 't1', 0)).toBe(false);
    expect(svc.isTenantInPercentage('ops.x', 't1', 100)).toBe(true);
  });

  it('boundary: bucket < pct included, bucket == pct excluded', () => {
    const key = 'ops.boundary';
    const tenantId = '11111111-1111-1111-1111-111111111111';
    const bucket = OperationalDecisionService.percentageBucket(key, tenantId);
    const svc = Object.create(OperationalDecisionService.prototype) as OperationalDecisionService;
    expect(svc.isTenantInPercentage(key, tenantId, bucket)).toBe(false);
    expect(svc.isTenantInPercentage(key, tenantId, bucket + 1)).toBe(true);
  });
});
