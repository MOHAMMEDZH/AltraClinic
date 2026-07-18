import { useI18n } from '@booking/i18n/react';
import type { DentalProcedureRecord } from '../types/dental.types';
import { formatDentalDate, toothFdiLabel } from '../config/dental-config';
import styles from './ProcedureTimeline.module.css';

export function ProcedureTimeline({ procedures }: { procedures: DentalProcedureRecord[] }) {
  const { t, locale } = useI18n();

  if (!procedures.length) {
    return <p className={styles.empty}>{t('dental.procedures.none')}</p>;
  }

  return (
    <ol className={styles.list}>
      {procedures.map((proc) => (
        <li key={proc.id} className={styles.item}>
          <div className={styles.dot} aria-hidden />
          <div className={styles.body}>
            <p className={styles.title}>
              <span className={styles.code}>{proc.code}</span>
              {proc.description}
            </p>
            <p className={styles.meta}>
              {proc.performedAt && <span>{formatDentalDate(proc.performedAt, locale)}</span>}
              {proc.toothNumbers.length > 0 && (
                <span>
                  {t('dental.procedures.teeth')}:{' '}
                  {proc.toothNumbers.map((n) => `#${n} (${toothFdiLabel(n)})`).join(', ')}
                </span>
              )}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
