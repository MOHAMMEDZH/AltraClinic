import { describe, expect, it } from '@jest/globals';
import { resolveTrendWindow, parseDashboardRange, trendDayCount } from './dashboard-range';

describe('dashboard-range', () => {
  const startOfDay = new Date('2026-06-15T00:00:00.000Z');

  it('parses preset ranges', () => {
    expect(parseDashboardRange('90d')).toBe('90d');
    expect(parseDashboardRange('custom')).toBe('custom');
    expect(parseDashboardRange(undefined)).toBe('7d');
  });

  it('counts trend days for presets', () => {
    expect(trendDayCount('90d')).toBe(90);
    expect(trendDayCount('30d')).toBe(30);
  });

  it('resolves custom from/to window', () => {
    const window = resolveTrendWindow(startOfDay, 'custom', '2026-06-01', '2026-06-15');
    expect(window.range).toBe('custom');
    expect(window.trendDays).toBe(15);
    expect(window.trendStart.toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });

  it('falls back to 30d when custom dates are invalid', () => {
    const window = resolveTrendWindow(startOfDay, 'custom', 'bad', '2026-06-15');
    expect(window.range).toBe('30d');
    expect(window.trendDays).toBe(30);
  });
});
