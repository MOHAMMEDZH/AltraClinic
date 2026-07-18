/** Visible row window for fixed-height virtual lists (react-window semantics). */
export function visibleItemRange(
  scrollOffset: number,
  viewportHeight: number,
  itemHeight: number,
  itemCount: number,
): { startIndex: number; endIndex: number; renderedCount: number } {
  if (itemCount <= 0 || itemHeight <= 0 || viewportHeight <= 0) {
    return { startIndex: 0, endIndex: 0, renderedCount: 0 };
  }
  const startIndex = Math.max(0, Math.floor(scrollOffset / itemHeight));
  const visibleRows = Math.ceil(viewportHeight / itemHeight) + 1;
  const endIndex = Math.min(itemCount, startIndex + visibleRows);
  return { startIndex, endIndex, renderedCount: endIndex - startIndex };
}

/** Memory-safe page size for infinite inbox scroll at 100k+ scale. */
export function maxLoadedPages(totalLoaded: number, pageSize: number, cap = 500): boolean {
  return totalLoaded / pageSize >= cap;
}
