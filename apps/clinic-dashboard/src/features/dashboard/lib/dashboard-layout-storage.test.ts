import { describe, expect, it } from 'vitest';
import {
  applyLayoutPreferences,
  createDefaultLayoutPrefs,
  moveWidgetInOrder,
  toggleWidgetVisibility,
} from './dashboard-layout-storage';
import type { DashboardWidgetId } from '../config/dashboard-config';

const WIDGETS = [
  'kpi-overview',
  'quick-actions',
  'queue-status',
  'revenue-summary',
] as DashboardWidgetId[];

describe('dashboard-layout-storage', () => {
  it('hides widgets from saved preferences', () => {
    const prefs = createDefaultLayoutPrefs(WIDGETS);
    const hidden = toggleWidgetVisibility(prefs, 'queue-status', false);
    const result = applyLayoutPreferences(WIDGETS, hidden);
    expect(result).not.toContain('queue-status');
    expect(result).toContain('kpi-overview');
  });

  it('reorders visible widgets', () => {
    let prefs = createDefaultLayoutPrefs(WIDGETS);
    prefs = moveWidgetInOrder(prefs, 'revenue-summary', 'up');
    prefs = moveWidgetInOrder(prefs, 'revenue-summary', 'up');
    const result = applyLayoutPreferences(WIDGETS, prefs);
    expect(result.indexOf('revenue-summary')).toBeLessThan(result.indexOf('queue-status'));
  });

  it('ignores saved ids outside role defaults', () => {
    const prefs = createDefaultLayoutPrefs([...WIDGETS, 'doctor-performance' as DashboardWidgetId]);
    const result = applyLayoutPreferences(WIDGETS, prefs);
    expect(result).not.toContain('doctor-performance');
  });
});
