import { Link } from 'react-router-dom';
import { ChevronRight, FileText } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import type { EncounterListItem } from '../types/emr.types';
import {
  formatEncounterDate,
  formatFollowUpDate,
  isPendingDocumentation,
  statusLabelKey,
} from '../config/emr-config';
import styles from './EncounterTable.module.css';

interface EncounterTableProps {
  encounters: EncounterListItem[];
  onSelect?: (encounter: EncounterListItem) => void;
}

export function EncounterTable({ encounters, onSelect }: EncounterTableProps) {
  const { t, locale, direction } = useI18n();

  if (!encounters.length) return null;

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <caption className={styles.caption}>{t('emr.list.caption')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('emr.list.patient')}</th>
            <th scope="col">{t('emr.list.complaint')}</th>
            <th scope="col">{t('emr.list.date')}</th>
            <th scope="col">{t('emr.list.diagnoses')}</th>
            <th scope="col">{t('emr.list.medications')}</th>
            <th scope="col">{t('emr.list.followUp')}</th>
            <th scope="col">{t('emr.list.status')}</th>
            <th scope="col"><span className={styles.srOnly}>{t('emr.list.actions')}</span></th>
          </tr>
        </thead>
        <tbody>
          {encounters.map((enc) => {
            const pending = isPendingDocumentation(enc);
            const statusKey = statusLabelKey(enc.status ?? 'in_progress');
            return (
              <tr key={enc.id} className={styles.row}>
                <td>
                  <Link to={`/patients/${enc.patientId}`} className={styles.patientLink}>
                    {enc.patientName}
                  </Link>
                </td>
                <td className={styles.complaintCell}>
                  {enc.chiefComplaint?.trim() || '—'}
                </td>
                <td className={styles.dateCell}>{formatEncounterDate(enc.createdAt, locale)}</td>
                <td className={styles.numCell}>{enc.diagnosesCount}</td>
                <td className={styles.numCell}>{enc.medicationsCount}</td>
                <td className={styles.dateCell}>{formatFollowUpDate(enc.followUpDate, locale)}</td>
                <td>
                  <span
                    className={[
                      styles.badge,
                      enc.status === 'signed'
                        ? styles.badgeSigned
                        : pending
                          ? styles.badgePending
                          : styles.badgeReady,
                    ].join(' ')}
                  >
                    {enc.status === 'signed' || enc.status === 'completed'
                      ? t(statusKey)
                      : pending
                        ? t('emr.list.pending')
                        : t('emr.list.ready')}
                  </span>
                </td>
                <td>
                  <Link
                    to={`/encounters/${enc.id}`}
                    className={styles.openLink}
                    onClick={() => onSelect?.(enc)}
                    aria-label={`${t('emr.viewEncounter')} — ${enc.patientName}`}
                  >
                    <FileText size={16} aria-hidden />
                    <ChevronRight
                      size={14}
                      aria-hidden
                      className={direction === 'rtl' ? styles.flipIcon : undefined}
                    />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
