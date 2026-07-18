import { FixedSizeList, type ListChildComponentProps } from 'react-window';
import styles from '../../notifications/notifications-layout.module.css';

const DEFAULT_ROW_HEIGHT = 52;
const DEFAULT_MAX_HEIGHT = 480;

interface RowData<T> {
  items: T[];
  renderRow: (item: T, index: number) => React.ReactNode;
}

export interface VirtualizedWorkflowTableProps<T> {
  items: T[];
  ariaLabel: string;
  header: React.ReactNode;
  renderRow: (item: T, index: number) => React.ReactNode;
  rowHeight?: number;
  maxHeight?: number;
  headerClassName?: string;
  rowClassName?: string;
}

export function VirtualizedWorkflowTable<T>({
  items,
  ariaLabel,
  header,
  renderRow,
  rowHeight = DEFAULT_ROW_HEIGHT,
  maxHeight = DEFAULT_MAX_HEIGHT,
  headerClassName,
  rowClassName,
}: VirtualizedWorkflowTableProps<T>) {
  const rowData: RowData<T> = { items, renderRow };

  return (
    <div className={styles.virtualTableWrap} role="region" aria-label={ariaLabel}>
      <div
        className={[styles.inboxVirtualHeader, headerClassName ?? ''].filter(Boolean).join(' ')}
        role="row"
      >
        {header}
      </div>
      <FixedSizeList
        height={Math.min(maxHeight, items.length * rowHeight + 8)}
        itemCount={items.length}
        itemSize={rowHeight}
        width="100%"
        itemData={rowData}
      >
        {({ index, style, data }) => {
          const item = data.items[index];
          if (!item) return null;
          return (
            <div
              style={style}
              className={[styles.inboxVirtualRow, rowClassName ?? ''].filter(Boolean).join(' ')}
              role="row"
            >
              {data.renderRow(item, index)}
            </div>
          );
        }}
      </FixedSizeList>
    </div>
  );
}
