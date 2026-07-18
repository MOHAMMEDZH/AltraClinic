import { useMemo } from 'react';
import { FixedSizeList, type ListChildComponentProps } from 'react-window';
import { useI18n } from '@booking/i18n/react';
import styles from '../analytics-layout.module.css';

interface AnalyticsVirtualizedTableProps {
  columns: string[];
  rows: Record<string, unknown>[];
  height?: number;
}

const ROW_HEIGHT = 44;

export function AnalyticsVirtualizedTable({
  columns,
  rows,
  height = 360,
}: AnalyticsVirtualizedTableProps) {
  const { t } = useI18n();
  const itemData = useMemo(() => ({ columns, rows }), [columns, rows]);

  if (rows.length === 0) {
    return <p className={styles.empty}>{t('analytics.domain.empty')}</p>;
  }

  return (
    <div role="region" aria-label={t('analytics.table.region')}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns.length}, minmax(120px, 1fr))`, gap: 'var(--space-2)', padding: 'var(--space-2)', borderBottom: '1px solid var(--color-border)' }}>
        {columns.map((col) => (
          <strong key={col}>{col}</strong>
        ))}
      </div>
      <FixedSizeList
        height={Math.min(height, rows.length * ROW_HEIGHT + 8)}
        itemCount={rows.length}
        itemSize={ROW_HEIGHT}
        width="100%"
        itemData={itemData}
      >
        {VirtualRow}
      </FixedSizeList>
    </div>
  );
}

function VirtualRow({ index, style, data }: ListChildComponentProps<{
  columns: string[];
  rows: Record<string, unknown>[];
}>) {
  const row = data.rows[index];
  return (
    <div
      style={{
        ...style,
        display: 'grid',
        gridTemplateColumns: `repeat(${data.columns.length}, minmax(120px, 1fr))`,
        gap: 'var(--space-2)',
        padding: '0 var(--space-2)',
        borderBottom: '1px solid var(--color-border)',
        alignItems: 'center',
      }}
    >
      {data.columns.map((col) => (
        <span key={col}>{String(row[col] ?? '')}</span>
      ))}
    </div>
  );
}
