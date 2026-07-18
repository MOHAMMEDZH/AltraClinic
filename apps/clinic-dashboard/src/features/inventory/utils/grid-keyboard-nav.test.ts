import { describe, expect, it } from 'vitest';
import { isGridNavKey, moveGridRowIndex } from './grid-keyboard-nav';

describe('grid-keyboard-nav', () => {
  it('detects grid navigation keys', () => {
    expect(isGridNavKey('ArrowDown')).toBe(true);
    expect(isGridNavKey('Home')).toBe(true);
    expect(isGridNavKey('Enter')).toBe(false);
  });

  it('moves down and up within bounds', () => {
    expect(moveGridRowIndex(0, 'ArrowDown', 5)).toBe(1);
    expect(moveGridRowIndex(4, 'ArrowDown', 5)).toBe(4);
    expect(moveGridRowIndex(2, 'ArrowUp', 5)).toBe(1);
    expect(moveGridRowIndex(0, 'ArrowUp', 5)).toBe(0);
  });

  it('jumps to first and last row', () => {
    expect(moveGridRowIndex(3, 'Home', 5)).toBe(0);
    expect(moveGridRowIndex(1, 'End', 5)).toBe(4);
  });

  it('returns null for non-navigation keys or empty grids', () => {
    expect(moveGridRowIndex(0, 'Tab', 5)).toBeNull();
    expect(moveGridRowIndex(0, 'ArrowDown', 0)).toBeNull();
  });
});
