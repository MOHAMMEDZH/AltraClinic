import { useI18n } from '@booking/i18n/react';
import { Link } from 'react-router-dom';
import { EmptyState } from '@/features/patients/components/EmptyState';
import type { InventoryMovement } from '../types/inventory.types';
import { formatInventoryDate, movementTypeLabelKey } from '../config/inventory-config';
import styles from './StockMovementTimeline.module.css';

interface StockMovementTimelineProps {
  movements: InventoryMovement[];
  loading?: boolean;
  showItem?: boolean;
}

export function StockMovementTimeline({ movements, loading, showItem = false }: StockMovementTimelineProps) {
  const { t, locale } = useI18n();

  if (loading && movements.length === 0) {
    return (
      <div className={styles.skeletonList} aria-hidden>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={styles.skeletonRow} />
        ))}
      </div>
    );
  }

  if (!loading && movements.length === 0) {
    return (
      <EmptyState
        title={t('inventory.movements.empty')}
        description={t('inventory.movements.emptyHint')}
      />
    );
  }

  return (
    <ol className={styles.list}>
      {movements.map((m) => (
        <li key={m.id} className={styles.item}>
          <div className={styles.marker} aria-hidden />
          <div className={styles.body}>
            <div className={styles.header}>
              <span className={`${styles.typeBadge} ${styles[`type_${m.movementType.toLowerCase()}`]}`}>
                {t(movementTypeLabelKey(m.movementType) as 'inventory.movementTypes.receive')}
              </span>
              <time className={styles.time} dateTime={m.createdAt}>
                {formatInventoryDate(m.createdAt, locale)}
              </time>
            </div>
            {showItem && (
              <p className={styles.itemLine}>
                <strong>{m.sku}</strong> — {m.itemName}
              </p>
            )}
            <p className={styles.qtyLine}>
              {t('inventory.movements.quantityChange')}:{' '}
              <span className={styles.qtyBefore}>{m.quantityBefore}</span>
              {' → '}
              <span className={styles.qtyAfter}>{m.quantityAfter}</span>{' '}
              {m.unit}
              {m.movementType === 'CONSUME' || m.movementType === 'RECEIVE' ? (
                <span className={styles.delta}>
                  {' '}
                  ({m.movementType === 'CONSUME' ? '−' : '+'}
                  {m.quantity})
                </span>
              ) : m.movementType === 'DISPOSE' ? (
                <span className={styles.delta}> (−{m.quantity})</span>
              ) : null}
            </p>
            {m.reason && (
              <p className={styles.meta}>
                {t('inventory.movements.reason')}: {m.reason}
              </p>
            )}
            {m.notes && (
              <p className={styles.meta}>
                {t('inventory.movements.notes')}: {m.notes}
              </p>
            )}
            {m.encounterId && (
              <p className={styles.meta}>
                {t('inventory.movements.encounter')}:{' '}
                <Link to={`/encounters/${m.encounterId}`} className={styles.encounterLink}>
                  {t('inventory.movements.viewEncounter')}
                </Link>
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
