import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { EmptyState } from '@/features/patients/components/EmptyState';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { Modal } from '@/features/patients/components/Modal';
import type { InventoryBatch } from '../types/inventory.types';
import { batchExpiryStatus, formatInventoryDate } from '../config/inventory-config';
import styles from './BatchList.module.css';

interface BatchListProps {
  batches: InventoryBatch[];
  loading?: boolean;
  canDispose?: boolean;
  showItemLink?: boolean;
  onDispose?: (batchId: string, quantity: number, reason: string, notes?: string) => Promise<void>;
  disposing?: boolean;
}

export function BatchList({
  batches,
  loading,
  canDispose = false,
  showItemLink = false,
  onDispose,
  disposing = false,
}: BatchListProps) {
  const { t, locale } = useI18n();
  const [disposeTarget, setDisposeTarget] = useState<InventoryBatch | null>(null);
  const [disposeQty, setDisposeQty] = useState(1);
  const [disposeReason, setDisposeReason] = useState('');
  const [disposeNotes, setDisposeNotes] = useState('');

  if (loading && batches.length === 0) {
    return (
      <div className={styles.batchList} aria-hidden>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={styles.skeleton} />
        ))}
      </div>
    );
  }

  if (!loading && batches.length === 0) {
    return (
      <EmptyState
        title={t('inventory.batches.empty')}
        description={t('inventory.batches.emptyHint')}
      />
    );
  }

  async function confirmDispose() {
    if (!disposeTarget || !onDispose) return;
    await onDispose(
      disposeTarget.batchId,
      disposeQty,
      disposeReason.trim(),
      disposeNotes.trim() || undefined,
    );
    setDisposeTarget(null);
    setDisposeReason('');
    setDisposeNotes('');
  }

  return (
    <>
      <div className={styles.batchList}>
        {batches.map((batch) => {
          const expiry = batchExpiryStatus(batch);
          const canDisposeBatch =
            canDispose &&
            batch.status === 'ACTIVE' &&
            batch.quantityOnHand > 0 &&
            (expiry === 'expired' || expiry === 'expiring');

          return (
            <article key={batch.batchId} className={styles.row}>
              <div className={styles.rowHeader}>
                <span className={styles.lot}>
                  {batch.lotNumber ? batch.lotNumber : t('inventory.batches.noLot')}
                </span>
                <span className={`${styles.badge} ${styles[`badge_${expiry}`]}`}>
                  {t(`inventory.batches.expiryStatus.${expiry}`)}
                </span>
                <span className={styles.badge}>{t(`inventory.batches.status.${batch.status.toLowerCase()}`)}</span>
              </div>
              {showItemLink && batch.sku && (
                <p className={styles.meta}>
                  <Link to={`/inventory/items/${batch.itemId}`}>
                    {batch.sku}
                    {batch.itemName ? ` — ${batch.itemName}` : ''}
                  </Link>
                </p>
              )}
              <p className={styles.meta}>
                {t('inventory.batches.quantity')}: {batch.quantityOnHand} {batch.unit}
              </p>
              <p className={styles.meta}>
                {t('inventory.batches.expiry')}: {formatInventoryDate(batch.expiryDate, locale)}
              </p>
              <p className={styles.meta}>
                {t('inventory.batches.received')}: {formatInventoryDate(batch.receivedAt, locale)}
              </p>
              {canDisposeBatch && onDispose && (
                <div className={styles.actions}>
                  <AuthButton
                    variant="secondary"
                    onClick={() => {
                      setDisposeTarget(batch);
                      setDisposeQty(batch.quantityOnHand);
                      setDisposeReason('');
                      setDisposeNotes('');
                    }}
                  >
                    {t('inventory.dispose.action')}
                  </AuthButton>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <Modal
        open={disposeTarget != null}
        title={t('inventory.dispose.title')}
        onClose={() => setDisposeTarget(null)}
      >
        {disposeTarget && (
          <>
            <p>{t('inventory.dispose.confirm')}</p>
            <AuthFormField label={t('inventory.dispose.quantity')} required>
              <input
                type="number"
                min={1}
                max={disposeTarget.quantityOnHand}
                value={disposeQty}
                onChange={(e) => setDisposeQty(Number(e.target.value) || 1)}
              />
            </AuthFormField>
            <AuthFormField label={t('inventory.dispose.reason')} required>
              <input value={disposeReason} onChange={(e) => setDisposeReason(e.target.value)} />
            </AuthFormField>
            <AuthFormField label={t('inventory.dispose.notes')}>
              <textarea rows={2} value={disposeNotes} onChange={(e) => setDisposeNotes(e.target.value)} />
            </AuthFormField>
            <div className={styles.modalActions}>
              <AuthButton variant="ghost" onClick={() => setDisposeTarget(null)}>
                {t('inventory.form.cancel')}
              </AuthButton>
              <AuthButton
                variant="danger"
                loading={disposing}
                disabled={!disposeReason.trim()}
                onClick={() => void confirmDispose()}
              >
                {t('inventory.dispose.confirmAction')}
              </AuthButton>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
