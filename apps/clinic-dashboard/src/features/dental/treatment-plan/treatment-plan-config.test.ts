import { describe, expect, it } from 'vitest';
import { calcInsuranceDefaults, formatCurrency, statusTone } from './treatment-plan-config';

describe('treatment-plan-config', () => {
  it('calcInsuranceDefaults splits cost by coverage', () => {
    const r = calcInsuranceDefaults(1000, 80);
    expect(r.insuranceEstimate).toBe(800);
    expect(r.patientPortion).toBe(200);
  });

  it('formatCurrency returns localized string', () => {
    expect(formatCurrency(1200, 'en-US')).toMatch(/\$1,200/);
  });

  it('statusTone maps draft to muted', () => {
    expect(statusTone('draft')).toBe('muted');
  });
});
