export interface AnalyticsGridItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const DEFAULT_SIZE: Record<string, { w: number; h: number }> = {
  revenueTrend: { w: 8, h: 2 },
  appointmentTrend: { w: 4, h: 2 },
  patientGrowth: { w: 6, h: 2 },
  collectionGauge: { w: 3, h: 1 },
  utilizationGauge: { w: 3, h: 1 },
  branchComparison: { w: 12, h: 2 },
  providerPerformance: { w: 6, h: 2 },
  inventoryHealth: { w: 6, h: 2 },
};

export function autoPackGridLayout(widgetIds: string[], existing: AnalyticsGridItem[] = []): AnalyticsGridItem[] {
  const byId = new Map(existing.map((item) => [item.i, item]));
  const items: AnalyticsGridItem[] = [];
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;

  for (const id of widgetIds) {
    const prev = byId.get(id);
    if (prev) {
      items.push(prev);
      continue;
    }

    const size = DEFAULT_SIZE[id] ?? { w: 4, h: 2 };
    if (cursorX + size.w > 12) {
      cursorX = 0;
      cursorY += rowHeight || 1;
      rowHeight = 0;
    }

    items.push({ i: id, x: cursorX, y: cursorY, w: size.w, h: size.h });
    cursorX += size.w;
    rowHeight = Math.max(rowHeight, size.h);
  }

  return items;
}

export function clampGridItem(item: AnalyticsGridItem): AnalyticsGridItem {
  const w = Math.min(12, Math.max(2, item.w));
  const h = Math.min(4, Math.max(1, item.h));
  const x = Math.min(12 - w, Math.max(0, item.x));
  const y = Math.max(0, item.y);
  return { ...item, w, h, x, y };
}

export function moveGridItem(items: AnalyticsGridItem[], id: string, x: number, y: number): AnalyticsGridItem[] {
  return items.map((item) => (item.i === id ? clampGridItem({ ...item, x, y }) : item));
}

export function resizeGridItem(items: AnalyticsGridItem[], id: string, w: number, h: number): AnalyticsGridItem[] {
  return items.map((item) => (item.i === id ? clampGridItem({ ...item, w, h }) : item));
}
