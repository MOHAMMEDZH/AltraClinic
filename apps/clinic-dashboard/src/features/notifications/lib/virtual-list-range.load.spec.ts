import { describe, expect, it } from 'vitest';
import { maxLoadedPages, visibleItemRange } from '../lib/virtual-list-range';

const ROW_HEIGHT = 52;
const VIEWPORT_HEIGHT = 480;
const ITEM_COUNT = 100_000;

describe('notifications inbox virtualization (100k+)', () => {
  it('renders only a small window of rows at any scroll position', () => {
    const atTop = visibleItemRange(0, VIEWPORT_HEIGHT, ROW_HEIGHT, ITEM_COUNT);
    expect(atTop.renderedCount).toBeLessThan(20);
    expect(atTop.endIndex - atTop.startIndex).toBe(atTop.renderedCount);

    const midScroll = visibleItemRange(50_000 * ROW_HEIGHT, VIEWPORT_HEIGHT, ROW_HEIGHT, ITEM_COUNT);
    expect(midScroll.renderedCount).toBeLessThan(20);
    expect(midScroll.startIndex).toBeGreaterThan(49_000);

    const nearEnd = visibleItemRange((ITEM_COUNT - 100) * ROW_HEIGHT, VIEWPORT_HEIGHT, ROW_HEIGHT, ITEM_COUNT);
    expect(nearEnd.endIndex).toBeLessThanOrEqual(ITEM_COUNT);
    expect(nearEnd.renderedCount).toBeLessThan(20);
  });

  it('caps infinite-scroll memory growth for large inboxes', () => {
    const pageSize = 50;
    expect(maxLoadedPages(100_000, pageSize)).toBe(true);
    expect(maxLoadedPages(10_000, pageSize)).toBe(false);
  });

  it('handles empty and edge cases', () => {
    expect(visibleItemRange(0, VIEWPORT_HEIGHT, ROW_HEIGHT, 0)).toEqual({
      startIndex: 0,
      endIndex: 0,
      renderedCount: 0,
    });
  });
});
