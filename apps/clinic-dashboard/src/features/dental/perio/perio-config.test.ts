import { describe, expect, it } from 'vitest';
import { buildDefaultTeeth, maxPocketDepth, pdSeverity, suggestPerioProcedures } from './perio-config';
import { PERIO_SITES } from './perio.types';

describe('perio-config', () => {
  it('builds 32 default teeth with six sites each', () => {
    const teeth = buildDefaultTeeth();
    expect(teeth).toHaveLength(32);
    expect(PERIO_SITES.every((id) => teeth[0].sites[id]?.pd === 0)).toBe(true);
  });

  it('classifies pocket depth severity', () => {
    expect(pdSeverity(3)).toBe('healthy');
    expect(pdSeverity(4)).toBe('watch');
    expect(pdSeverity(6)).toBe('severe');
    expect(pdSeverity(8)).toBe('critical');
  });

  it('computes max pocket depth per tooth', () => {
    const tooth = buildDefaultTeeth()[0];
    tooth.sites.mb.pd = 5;
    expect(maxPocketDepth(tooth)).toBe(5);
  });

  it('suggests SRP for moderate periodontitis patterns', () => {
    const suggestions = suggestPerioProcedures({
      teethCharted: 28,
      sitesProbed: 168,
      bopCount: 40,
      bopPercent: 24,
      sitesPd4Plus: 12,
      sitesPd5Plus: 6,
      sitesPd6Plus: 2,
      maxPocketDepth: 6,
      avgPocketDepth: 3.2,
      teethWithMobility: 1,
      teethWithFurcation: 1,
      avgPlaqueIndex: 1.5,
      stage: 'moderate',
      alerts: [],
    });
    expect(suggestions.some((s) => s.code === 'D4341')).toBe(true);
  });
});
