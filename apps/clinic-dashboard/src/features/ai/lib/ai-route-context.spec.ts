import { describe, expect, it } from 'vitest';
import { inferAiModule, parseAiRouteContext } from './ai-route-context';

describe('ai-route-context', () => {
  it('infers module from pathname', () => {
    expect(inferAiModule('/patients/p1')).toBe('patients');
    expect(inferAiModule('/inventory/items/i1')).toBe('inventory');
    expect(inferAiModule('/analytics/financial')).toBe('analytics');
    expect(inferAiModule('/dental/chart/p1')).toBe('dental');
  });

  it('parses patient, inventory, report, and analytics context', () => {
    const ctx = parseAiRouteContext(
      '/inventory/items/item-1',
      { itemId: 'item-1' },
      new URLSearchParams(),
    );
    expect(ctx.module).toBe('inventory');
    expect(ctx.inventoryItemId).toBe('item-1');

    const reportCtx = parseAiRouteContext('/reports/revenue-summary', { reportId: 'revenue-summary' });
    expect(reportCtx.reportId).toBe('revenue-summary');
    expect(reportCtx.module).toBe('reporting');

    const analyticsCtx = parseAiRouteContext('/analytics/operations', {});
    expect(analyticsCtx.analyticsDomain).toBe('operations');
  });

  it('parses dental and beauty patient context', () => {
    const dental = parseAiRouteContext('/dental/chart/p1', { patientId: 'p1' });
    expect(dental.patientId).toBe('p1');
    expect(dental.dentalPatientId).toBe('p1');

    const beauty = parseAiRouteContext('/beauty/workspace/p2', { patientId: 'p2' });
    expect(beauty.beautyPatientId).toBe('p2');
  });

  it('reads appointment highlight from search params', () => {
    const ctx = parseAiRouteContext(
      '/appointments',
      {},
      new URLSearchParams('highlight=appt-1'),
    );
    expect(ctx.appointmentId).toBe('appt-1');
    expect(ctx.module).toBe('scheduling');
  });

  it('reads appointment from scheduling selected param and clinical nav', () => {
    const selected = parseAiRouteContext('/appointments', {}, new URLSearchParams('selected=appt-2'));
    expect(selected.appointmentId).toBe('appt-2');

    const clinical = parseAiRouteContext(
      '/patients/p1',
      { patientId: 'p1' },
      new URLSearchParams('from=appointment&appointmentId=appt-3'),
    );
    expect(clinical.appointmentId).toBe('appt-3');
    expect(clinical.patientId).toBe('p1');
  });
});
