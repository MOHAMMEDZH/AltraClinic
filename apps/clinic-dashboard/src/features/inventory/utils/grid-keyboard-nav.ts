export type GridNavKey = 'ArrowDown' | 'ArrowUp' | 'Home' | 'End';

const GRID_NAV_KEYS = new Set<string>(['ArrowDown', 'ArrowUp', 'Home', 'End']);

export function isGridNavKey(key: string): key is GridNavKey {
  return GRID_NAV_KEYS.has(key);
}

/** Returns the next row index, or null when the key is not a grid navigation key. */
export function moveGridRowIndex(current: number, key: string, rowCount: number): number | null {
  if (rowCount <= 0 || !isGridNavKey(key)) return null;

  const clamped = Math.max(0, Math.min(rowCount - 1, current));

  switch (key) {
    case 'ArrowDown':
      return clamped >= rowCount - 1 ? clamped : clamped + 1;
    case 'ArrowUp':
      return clamped <= 0 ? clamped : clamped - 1;
    case 'Home':
      return 0;
    case 'End':
      return rowCount - 1;
    default:
      return null;
  }
}
