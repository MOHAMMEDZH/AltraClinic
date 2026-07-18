import { useI18n } from '@booking/i18n/react';
import { formatMessage } from '@/i18n/messages';
import type { AppointmentListItem } from '../types/scheduling.types';
import { formatTimeRange, formatServiceTypeLabel } from '../config/scheduling-config';
import { StatusBadge } from './StatusBadge';
import { AppointmentBranchLabel } from './AppointmentBranchLabel';
import styles from './AppointmentListTable.module.css';

interface AppointmentListTableProps {
  appointments: AppointmentListItem[];
  onSelect: (appointment: AppointmentListItem) => void;
  selectedId?: string | null;
  bulkMode?: boolean;
  bulkSelected?: Set<string>;
  onBulkToggle?: (id: string) => void;
  branchLabels?: Record<string, string>;
  showBranchLabels?: boolean;
}

function durationMinutes(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000);
}

export function AppointmentListTable({
  appointments,
  onSelect,
  selectedId,
  bulkMode,
  bulkSelected,
  onBulkToggle,
  branchLabels,
  showBranchLabels,
}: AppointmentListTableProps) {
  const { t, locale } = useI18n();

  if (!appointments.length) {
    return null;
  }

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <caption className={styles.caption}>{t('scheduling.list.caption')}</caption>
        <thead>
          <tr>
            {bulkMode && (
              <th scope="col" className={styles.checkCol}>
                <span className={styles.srOnly}>{t('scheduling.bulk.select')}</span>
              </th>
            )}
            <th scope="col">{t('scheduling.list.time')}</th>
            <th scope="col">{t('scheduling.list.patient')}</th>
            {showBranchLabels && <th scope="col">{t('scheduling.filter.branch')}</th>}
            <th scope="col">{t('scheduling.form.serviceType')}</th>
            <th scope="col">{t('scheduling.list.duration')}</th>
            <th scope="col">{t('scheduling.list.status')}</th>
            <th scope="col">{t('scheduling.list.notes')}</th>
          </tr>
        </thead>
        <tbody>
          {appointments.map((appt) => (
            <tr
              key={appt.id}
              className={selectedId === appt.id ? styles.rowSelected : undefined}
              onClick={() => onSelect(appt)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(appt);
                }
              }}
              tabIndex={0}
              role="button"
              aria-pressed={selectedId === appt.id}
            >
              {bulkMode && (
                <td className={styles.checkCol}>
                  <input
                    type="checkbox"
                    aria-label={formatMessage(t('scheduling.bulk.selectOne'), { name: appt.patientName })}
                    checked={bulkSelected?.has(appt.id) ?? false}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => onBulkToggle?.(appt.id)}
                  />
                </td>
              )}
              <td className={styles.timeCell}>
                {formatTimeRange(appt.start, appt.end, locale)}
              </td>
              <td className={styles.patientCell}>{appt.patientName}</td>
              {showBranchLabels && (
                <td>
                  {appt.branchId && branchLabels?.[appt.branchId]
                    ? branchLabels[appt.branchId]
                    : '—'}
                </td>
              )}
              <td>{formatServiceTypeLabel(appt.serviceType, t)}</td>
              <td>
                {formatMessage(t('scheduling.list.minutes'), {
                  n: durationMinutes(appt.start, appt.end),
                })}
              </td>
              <td>
                <StatusBadge status={appt.status} />
              </td>
              <td className={styles.notesCell}>{appt.notes ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
