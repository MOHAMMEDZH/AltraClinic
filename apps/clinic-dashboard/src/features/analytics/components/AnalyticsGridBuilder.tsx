import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { useDynamicAnalytics } from '@/features/dynamic-analytics/context/DynamicAnalyticsProvider';
import { findWidgetInSnapshot } from '@/features/dynamic-analytics/lib/analytics-domain-adapter';
import {
  clampGridItem,
  moveGridItem,
  resizeGridItem,
  type AnalyticsGridItem,
} from '../lib/analytics-grid-layout';
import gridStyles from './AnalyticsGridBuilder.module.css';
import styles from '../analytics-layout.module.css';

interface AnalyticsGridBuilderProps {
  selectedWidgetIds: string[];
  layout: AnalyticsGridItem[];
  onLayoutChange: (layout: AnalyticsGridItem[]) => void;
}

export function AnalyticsGridBuilder({
  selectedWidgetIds,
  layout,
  onLayoutChange,
}: AnalyticsGridBuilderProps) {
  const { t } = useI18n();
  const { snapshot } = useDynamicAnalytics();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const visibleLayout = layout.filter((item) => selectedWidgetIds.includes(item.i));

  const cellFromPointer = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const colWidth = rect.width / 12;
    const rowHeight = 120 + 12;
    const x = Math.min(11, Math.max(0, Math.floor((clientX - rect.left) / colWidth)));
    const y = Math.max(0, Math.floor((clientY - rect.top) / rowHeight));
    return { x, y };
  }, []);

  useEffect(() => {
    if (!draggingId && !resizingId) return;

    function onMove(e: PointerEvent) {
      if (draggingId) {
        const cell = cellFromPointer(e.clientX - dragOffset.current.x, e.clientY - dragOffset.current.y);
        onLayoutChange(moveGridItem(layout, draggingId, cell.x, cell.y));
      }
      if (resizingId) {
        const item = layout.find((l) => l.i === resizingId);
        const canvas = canvasRef.current;
        if (!item || !canvas) return;
        const rect = canvas.getBoundingClientRect();
        const colWidth = rect.width / 12;
        const rowHeight = 120 + 12;
        const w = Math.round((e.clientX - rect.left - item.x * colWidth) / colWidth);
        const h = Math.round((e.clientY - rect.top - item.y * rowHeight) / rowHeight);
        onLayoutChange(resizeGridItem(layout, resizingId, w, h));
      }
    }

    function onUp() {
      setDraggingId(null);
      setResizingId(null);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [draggingId, resizingId, layout, onLayoutChange, cellFromPointer]);

  return (
    <div
      ref={canvasRef}
      className={gridStyles.gridCanvas}
      aria-label={t('analytics.builder.gridCanvas')}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const widgetId = e.dataTransfer.getData('text/analytics-widget');
        if (!widgetId || !selectedWidgetIds.includes(widgetId)) return;
        const cell = cellFromPointer(e.clientX, e.clientY);
        onLayoutChange(
          layout.map((item) => (item.i === widgetId ? clampGridItem({ ...item, x: cell.x, y: cell.y }) : item)),
        );
      }}
    >
      {visibleLayout.map((item) => {
        const widget = findWidgetInSnapshot(snapshot, item.i);
        return (
          <article
            key={item.i}
            className={[gridStyles.gridItem, draggingId === item.i ? gridStyles.gridItemDragging : ''].join(' ')}
            style={{
              gridColumn: `${item.x + 1} / span ${item.w}`,
              gridRow: `${item.y + 1} / span ${item.h}`,
            }}
          >
            <div
              className={gridStyles.gridItemHeader}
              onPointerDown={(e) => {
                setDraggingId(item.i);
                dragOffset.current = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
              }}
            >
              <span className={gridStyles.dragHandle} aria-hidden>
                ⋮⋮
              </span>
              <strong>{widget ? t(widget.titleKey as 'analytics.title') : item.i}</strong>
            </div>
            <p className={styles.kpiHint}>
              {widget ? t(widget.descriptionKey as 'analytics.subtitle') : null}
            </p>
            <span
              className={gridStyles.resizeHandle}
              role="presentation"
              onPointerDown={(e) => {
                e.stopPropagation();
                setResizingId(item.i);
              }}
            />
          </article>
        );
      })}
    </div>
  );
}

export function makeWidgetDraggable(widgetId: string) {
  return {
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData('text/analytics-widget', widgetId);
      e.dataTransfer.effectAllowed = 'move';
    },
  };
}
