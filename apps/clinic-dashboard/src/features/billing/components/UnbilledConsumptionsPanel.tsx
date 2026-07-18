import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { formatMessage } from '@/i18n/messages';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { formatBillingCurrency, formatBillingDate } from '../config/billing-config';
import { mapBillingApiError } from '../api/billing-api';
import { useBillConsumptions, useUnbilledConsumptions } from '../hooks/useBilling';
import styles from './UnbilledConsumptionsPanel.module.css';

interface UnbilledConsumptionsPanelProps {
  patientId: string;
  targetInvoiceId?: string;
  canCreate: boolean;
  onBilled?: (result: { invoiceId: string; invoiceNumber: string }) => void;
}

export function UnbilledConsumptionsPanel({
  patientId,
  targetInvoiceId,
  canCreate,
  onBilled,
}: UnbilledConsumptionsPanelProps) {
  const { t, locale } = useI18n();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const unbilledQuery = useUnbilledConsumptions(patientId);
  const billMutation = useBillConsumptions();
  const unbilled = unbilledQuery.data ?? [];

  useEffect(() => {
    setSelectedIds(new Set());
  }, [patientId, targetInvoiceId]);

  const allSelected = useMemo(
    () => unbilled.length > 0 && unbilled.every((row) => selectedIds.has(row.id)),
    [unbilled, selectedIds],
  );

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBill() {
    if (selectedIds.size === 0) {
      setErrorKey('noSelection');
      return;
    }
    if (!canCreate) {
      setErrorKey('noCreateAccess');
      return;
    }
    setErrorKey(null);
    setSuccess(null);
    try {
      const result = await billMutation.mutateAsync({
        patientId,
        consumptionIds: [...selectedIds],
        invoiceId: targetInvoiceId,
      });
      setSuccess(
        formatMessage(t('billing.unbilled.success'), {
          number: result.invoiceNumber,
          count: result.linkedConsumptionCount,
        }),
      );
      setSelectedIds(new Set());
      onBilled?.({ invoiceId: result.invoiceId, invoiceNumber: result.invoiceNumber });
    } catch (err) {
      setErrorKey(mapBillingApiError(err));
    }
  }

  if (unbilledQuery.isLoading) {
    return <p className={styles.hint} aria-busy="true">…</p>;
  }

  if (unbilledQuery.isError) {
    return <AuthAlert variant="error">{t('billing.loadError')}</AuthAlert>;
  }

  if (unbilled.length === 0) {
    return <p className={styles.empty}>{t('billing.unbilled.empty')}</p>;
  }

  return (
    <div className={styles.unbilledPanel}>
      {errorKey && (
        <AuthAlert variant="error">
          {t(`billing.errors.${errorKey}` as 'billing.errors.generic')}
        </AuthAlert>
      )}
      {success && <AuthAlert variant="success">{success}</AuthAlert>}

      <div className={styles.actions}>
        <label>
          <input type="checkbox" checked={allSelected} onChange={() => {
            if (allSelected) setSelectedIds(new Set());
            else setSelectedIds(new Set(unbilled.map((row) => row.id)));
          }} />{' '}
          {t('billing.unbilled.selectAll')}
        </label>
        {canCreate && (
          <AuthButton loading={billMutation.isPending} onClick={() => void handleBill()}>
            {targetInvoiceId ? t('billing.detail.addMaterials') : t('billing.unbilled.billSelected')}
          </AuthButton>
        )}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className={styles.hint}>{t('billing.unbilled.caption')}</caption>
          <thead>
            <tr>
              <th scope="col" aria-label="Select" />
              <th scope="col">{t('billing.unbilled.item')}</th>
              <th scope="col">{t('billing.unbilled.sku')}</th>
              <th scope="col">{t('billing.unbilled.quantity')}</th>
              <th scope="col">{t('billing.unbilled.unitPrice')}</th>
              <th scope="col">{t('billing.unbilled.consumedAt')}</th>
            </tr>
          </thead>
          <tbody>
            {unbilled.map((row) => (
              <tr key={row.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(row.id)}
                    aria-label={`${row.itemName} ${row.sku}`}
                    onChange={() => toggle(row.id)}
                  />
                </td>
                <td>{row.itemName}</td>
                <td>{row.sku}</td>
                <td>
                  {row.quantityUsed} {row.unit}
                </td>
                <td>
                  {row.unitPrice != null ? formatBillingCurrency(row.unitPrice, locale) : '—'}
                </td>
                <td>{formatBillingDate(row.consumedAt, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
