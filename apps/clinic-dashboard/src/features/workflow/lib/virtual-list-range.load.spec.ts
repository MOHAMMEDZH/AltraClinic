import { describe, expect, it } from 'vitest';
import { maxLoadedPages, visibleItemRange } from './virtual-list-range';

const ROW_HEIGHT = 52;
const VIEWPORT_HEIGHT = 480;
const ITEM_COUNT = 100_000;

describe('workflow virtual list range', () => {
  it('computes visible window for large lists', () => {
    const atTop = visibleItemRange(0, VIEWPORT_HEIGHT, ROW_HEIGHT, ITEM_COUNT);
    expect(atTop.startIndex).toBe(0);
    expect(atTop.renderedCount).toBeGreaterThan(0);

    const midScroll = visibleItemRange(50_000 * ROW_HEIGHT, VIEWPORT_HEIGHT, ROW_HEIGHT, ITEM_COUNT);
    expect(midScroll.startIndex).toBe(50_000);
  });

  it('caps loaded pages for memory safety', () => {
    expect(maxLoadedPages(50 * 500, 50, 500)).toBe(true);
    expect(maxLoadedPages(50 * 100, 50, 500)).toBe(false);
  });
});
