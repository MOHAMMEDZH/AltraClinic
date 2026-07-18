import { describe, expect, it } from 'vitest';
import {
  canCreateDental,
  canViewDental,
  countByStatus,
  resolveDentalViewMode,
  statusCssClass,
  toothFdiLabel,
} from './dental-config';

describe('dental-config', () => {
  it('gates dental permissions', () => {
    expect(canViewDental((a) => a === 'view')).toBe(true);
    expect(canCreateDental((a) => a === 'create')).toBe(true);
  });

  it('maps universal to FDI labels', () => {
    expect(toothFdiLabel(1)).toBe('18');
    expect(toothFdiLabel(9)).toBe('21');
  });

  it('resolves view modes', () => {
    expect(resolveDentalViewMode(['dentist'])).toBe('dentist');
    expect(resolveDentalViewMode(['owner'])).toBe('manager');
  });

  it('counts tooth statuses', () => {
    const counts = countByStatus([
      { status: 'healthy' },
      { status: 'decayed' },
      { status: 'healthy' },
    ]);
    expect(counts.healthy).toBe(2);
    expect(counts.decayed).toBe(1);
  });

  it('maps status css classes', () => {
    expect(statusCssClass('crown')).toBe('crown');
  });
});
