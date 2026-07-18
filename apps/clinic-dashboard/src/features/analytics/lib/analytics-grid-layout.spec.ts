import { describe, expect, it } from 'vitest';
import {
  autoPackGridLayout,
  clampGridItem,
  moveGridItem,
  resizeGridItem,
} from './analytics-grid-layout';

describe('analytics-grid-layout', () => {
  it('auto-packs new widgets into a 12-column grid', () => {
    const layout = autoPackGridLayout(['revenueTrend', 'appointmentTrend']);
    expect(layout).toHaveLength(2);
    expect(layout[0]).toMatchObject({ i: 'revenueTrend', x: 0, y: 0, w: 8, h: 2 });
    expect(layout[1]).toMatchObject({ i: 'appointmentTrend', x: 8, y: 0, w: 4, h: 2 });
  });

  it('preserves existing positions when toggling widgets', () => {
    const existing = autoPackGridLayout(['revenueTrend', 'appointmentTrend']);
    const moved = moveGridItem(existing, 'revenueTrend', 2, 3);
    const repacked = autoPackGridLayout(['appointmentTrend', 'revenueTrend'], moved);
    const revenue = repacked.find((item) => item.i === 'revenueTrend');
    expect(revenue).toMatchObject({ x: 2, y: 3 });
  });

  it('clamps resize and move within grid bounds', () => {
    const base = autoPackGridLayout(['revenueTrend']);
    const oversized = resizeGridItem(base, 'revenueTrend', 20, 10);
    expect(oversized[0]).toMatchObject({ w: 12, h: 4 });

    const moved = moveGridItem(oversized, 'revenueTrend', 20, -2);
    expect(clampGridItem(moved[0])).toMatchObject({ x: 0, y: 0 });
  });
});
