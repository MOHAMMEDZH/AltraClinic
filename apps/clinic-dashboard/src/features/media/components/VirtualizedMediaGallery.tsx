import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { FixedSizeGrid as Grid, type GridChildComponentProps } from 'react-window';
import { useI18n } from '@booking/i18n/react';
import { MediaThumbnail } from './MediaThumbnail';
import { mediaDisplayTitle, mediaImagingType } from '../api/media-api';
import { GALLERY_COLUMN_MIN_WIDTH, GALLERY_ROW_HEIGHT } from '../config/imaging-config';
import { formatDentalDate } from '@/features/dental/config/dental-config';
import type { MediaListItem } from '../types/media.types';
import styles from './VirtualizedMediaGallery.module.css';

interface VirtualizedMediaGalleryProps {
  items: MediaListItem[];
  selectedId: string | null;
  compareMode: boolean;
  onSelect: (item: MediaListItem) => void;
  compact?: boolean;
}

interface CellData {
  items: MediaListItem[];
  columnCount: number;
  selectedId: string | null;
  onSelect: (item: MediaListItem) => void;
  locale: string;
  t: (key: string) => string;
}

function GalleryCell({ columnIndex, rowIndex, style, data }: GridChildComponentProps<CellData>) {
  const index = rowIndex * data.columnCount + columnIndex;
  const item = data.items[index];
  if (!item) return null;

  const imagingKey = mediaImagingType(item) as 'xray';

  return (
    <div style={style as CSSProperties} className={styles.cell}>
      <article className={styles.card} role="listitem">
        <MediaThumbnail
          mediaId={item.id}
          alt={mediaDisplayTitle(item)}
          selected={data.selectedId === item.id}
          onClick={() => data.onSelect(item)}
        />
        <div className={styles.cardMeta}>
          <p className={styles.cardTitle}>{mediaDisplayTitle(item)}</p>
          <p className={styles.cardSub}>
            {data.t(`dental.imaging.types.${imagingKey}`)} · {formatDentalDate(item.createdAt, data.locale)}
          </p>
        </div>
      </article>
    </div>
  );
}

export function VirtualizedMediaGallery({
  items,
  selectedId,
  compareMode,
  onSelect,
  compact,
}: VirtualizedMediaGalleryProps) {
  const { t, locale } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? 0;
      setWidth(next);
    });
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const columnWidth = compact ? GALLERY_COLUMN_MIN_WIDTH - 24 : GALLERY_COLUMN_MIN_WIDTH;
  const columnCount = Math.max(1, Math.floor(width / columnWidth) || 1);
  const rowCount = Math.ceil(items.length / columnCount);
  const gridHeight = Math.min(640, Math.max(320, rowCount * GALLERY_ROW_HEIGHT));
  const viewportHeight = items.length > 12 ? 640 : gridHeight;

  const itemData = useMemo<CellData>(
    () => ({ items, columnCount, selectedId, onSelect, locale, t }),
    [items, columnCount, selectedId, onSelect, locale, t],
  );

  const handleSelect = useCallback(
    (item: MediaListItem) => onSelect(item),
    [onSelect],
  );

  return (
    <div ref={containerRef} className={styles.wrap} role="list" aria-label={t('dental.imaging.gallery.label')}>
      {compareMode && (
        <p className={styles.compareHint} role="status">
          {t('dental.imaging.compare.selectHint')}
        </p>
      )}
      {width > 0 && (
        <Grid
          columnCount={columnCount}
          columnWidth={columnWidth}
          height={viewportHeight}
          rowCount={rowCount}
          rowHeight={GALLERY_ROW_HEIGHT}
          width={width}
          itemData={{ ...itemData, onSelect: handleSelect }}
          overscanRowCount={2}
        >
          {GalleryCell}
        </Grid>
      )}
      <p className={styles.count} aria-live="polite">
        {t('dental.imaging.gallery.count').replace('{count}', String(items.length))}
      </p>
    </div>
  );
}
