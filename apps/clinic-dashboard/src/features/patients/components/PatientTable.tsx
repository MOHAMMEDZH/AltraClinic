import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { formatMessage } from '@/i18n/messages';
import type { PatientListItem } from '../types';
import type { ListColumnId } from '../config/patients-config';
import {
  formatPatientDate,
  genderLabelKey,
  patientContactLine,
  patientFullName,
  patientInitials,
} from '../lib/patient-format';
import styles from './PatientTable.module.css';

interface PatientTableProps {
  items: PatientListItem[];
  visibleColumns: ListColumnId[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
}

export function PatientTable({
  items,
  visibleColumns,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  page,
  total,
  pageSize,
  onPageChange,
  loading,
}: PatientTableProps) {
  const { t, locale, direction } = useI18n();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const PrevIcon = direction === 'rtl' ? ChevronRight : ChevronLeft;
  const NextIcon = direction === 'rtl' ? ChevronLeft : ChevronRight;

  const col = (id: ListColumnId) => visibleColumns.includes(id);

  return (
    <div className={styles.wrap}>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <caption className={styles.srOnly}>{t('patients.listCaption')}</caption>
          <thead>
            <tr>
              <th scope="col" className={styles.checkCol}>
                <input
                  type="checkbox"
                  aria-label={t('patients.selectAll')}
                  checked={items.length > 0 && items.every((p) => selectedIds.has(p.id))}
                  onChange={onToggleSelectAll}
                />
              </th>
              {col('name') && <th scope="col">{t('patients.columns.name')}</th>}
              {col('phone') && <th scope="col">{t('patients.columns.phone')}</th>}
              {col('email') && <th scope="col">{t('patients.columns.email')}</th>}
              {col('dob') && <th scope="col">{t('patients.columns.dob')}</th>}
              {col('gender') && <th scope="col">{t('patients.columns.gender')}</th>}
              {col('nationalId') && <th scope="col">{t('patients.columns.nationalId')}</th>}
              {col('lastVisit') && <th scope="col">{t('patients.columns.lastVisit')}</th>}
              {col('status') && <th scope="col">{t('patients.columns.status')}</th>}
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`sk-${i}`} className={styles.skeletonRow}>
                  <td colSpan={visibleColumns.length + 1}>
                    <div className={styles.skeletonBar} />
                  </td>
                </tr>
              ))}
            {!loading &&
              items.map((patient) => (
                <tr key={patient.id} className={patient.archived ? styles.archivedRow : undefined}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={formatMessage(t('patients.selectPatient'), { name: patientFullName(patient, locale) })}
                      checked={selectedIds.has(patient.id)}
                      onChange={() => onToggleSelect(patient.id)}
                    />
                  </td>
                  {col('name') && (
                    <td>
                      <Link to={`/patients/${patient.id}`} className={styles.nameLink}>
                        <span className={styles.avatar} aria-hidden>
                          {patientInitials(patient)}
                        </span>
                        <span>
                          <span className={styles.namePrimary}>{patientFullName(patient, locale)}</span>
                          {patient.nationalId && (
                            <span className={styles.nameMeta}>{patient.nationalId}</span>
                          )}
                        </span>
                      </Link>
                    </td>
                  )}
                  {col('phone') && <td dir="ltr">{patient.phone ?? '—'}</td>}
                  {col('email') && <td dir="ltr">{patient.email ?? '—'}</td>}
                  {col('dob') && <td>{formatPatientDate(patient.dateOfBirth, locale)}</td>}
                  {col('gender') && <td>{t(genderLabelKey(patient.gender))}</td>}
                  {col('nationalId') && <td dir="ltr">{patient.nationalId ?? '—'}</td>}
                  {col('lastVisit') && (
                    <td>{formatPatientDate(patient.lastVisitAt, locale, { dateStyle: 'short', timeStyle: 'short' })}</td>
                  )}
                  {col('status') && (
                    <td>
                      <span className={[styles.statusBadge, patient.archived ? styles.statusArchived : styles.statusActive].join(' ')}>
                        {patient.archived ? t('patients.status.archived') : t('patients.status.active')}
                      </span>
                    </td>
                  )}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <ul className={styles.cardList}>
        {items.map((patient) => (
          <li key={`card-${patient.id}`}>
            <Link to={`/patients/${patient.id}`} className={styles.card}>
              <span className={styles.avatar}>{patientInitials(patient)}</span>
              <span className={styles.cardBody}>
                <span className={styles.namePrimary}>{patientFullName(patient, locale)}</span>
                <span className={styles.nameMeta}>{patientContactLine(patient)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <nav className={styles.pagination} aria-label={t('patients.pagination')}>
        <button
          type="button"
          className={styles.pageBtn}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <PrevIcon size={16} aria-hidden />
          {t('patients.prevPage')}
        </button>
        <span className={styles.pageInfo}>
          {formatMessage(t('patients.pageInfo'), {
            page: String(page),
            total: String(totalPages),
            count: String(total),
          })}
        </span>
        <button
          type="button"
          className={styles.pageBtn}
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {t('patients.nextPage')}
          <NextIcon size={16} aria-hidden />
        </button>
      </nav>
    </div>
  );
}
