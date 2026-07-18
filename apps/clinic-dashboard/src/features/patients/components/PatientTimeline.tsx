import { Link } from 'react-router-dom';
import { Calendar, FileText, Image, Pill, Receipt, Smile, Stethoscope, Syringe, ClipboardList, Activity } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { formatPatientDate } from '../lib/patient-format';
import { timelineEntryHref } from '../lib/timeline-links';
import type { PatientTimelineEntry } from '../types';
import styles from './PatientTimeline.module.css';

const TYPE_ICONS = {
  appointment: Calendar,
  encounter: Stethoscope,
  invoice: Receipt,
  note: FileText,
  document: FileText,
  imaging: Image,
  audit: ClipboardList,
  perio: Smile,
  diagnosis: Syringe,
  prescription: Pill,
  treatment: Stethoscope,
  ortho: Activity,
  implant: Smile,
  dental_note: FileText,
  procedure: Smile,
};

interface PatientTimelineProps {
  patientId: string;
  items: PatientTimelineEntry[];
  loading?: boolean;
  emptyLabel: string;
}

function imagingTypeLabel(
  t: (key: string) => string,
  imagingType: string | null | undefined,
): string | null {
  if (!imagingType) return null;
  const key = `dental.imaging.types.${imagingType}`;
  const label = t(key);
  return label === key ? imagingType : label;
}

export function PatientTimeline({ patientId, items, loading, emptyLabel }: PatientTimelineProps) {
  const { locale, t } = useI18n();

  if (loading) {
    return (
      <ul className={styles.list} aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className={styles.item}>
            <div className={styles.skeletonIcon} />
            <div className={styles.skeletonLine} />
          </li>
        ))}
      </ul>
    );
  }

  if (items.length === 0) {
    return <p className={styles.empty}>{emptyLabel}</p>;
  }

  return (
    <ol className={styles.list}>
      {items.map((entry) => {
        const Icon = TYPE_ICONS[entry.type] ?? FileText;
        const imagingLabel =
          entry.type === 'imaging'
            ? imagingTypeLabel(t, entry.subtitle ?? (entry.metadata?.imagingType as string | undefined))
            : null;
        const href = timelineEntryHref(patientId, entry);
        const title =
          href ? (
            <Link to={href} className={styles.link}>
              {entry.type === 'imaging'
                ? entry.title
                : entry.type === 'perio'
                  ? t('dental.perio.timeline.title')
                  : entry.title}
            </Link>
          ) : entry.type === 'imaging' ? (
            <Link to={`/dental/imaging/${patientId}`} className={styles.link}>
              {entry.title}
            </Link>
          ) : entry.type === 'perio' ? (
            <Link to={`/dental/chart/${patientId}?tab=perio`} className={styles.link}>
              {t('dental.perio.timeline.title')}
            </Link>
          ) : (
            entry.title
          );

        return (
          <li key={`${entry.type}-${entry.id}`} className={styles.item}>
            <span className={[styles.iconWrap, entry.type === 'imaging' ? styles.iconImaging : ''].join(' ')} aria-hidden>
              <Icon size={16} />
            </span>
            <div className={styles.body}>
              <div className={styles.row}>
                <span className={styles.title}>{title}</span>
                <time className={styles.time} dateTime={entry.occurredAt}>
                  {formatPatientDate(entry.occurredAt, locale, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </time>
              </div>
              {imagingLabel && <p className={styles.subtitle}>{imagingLabel}</p>}
              {entry.type !== 'imaging' && entry.subtitle && (
                <p className={styles.subtitle}>{entry.subtitle}</p>
              )}
              {entry.status && <span className={styles.status}>{entry.status}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
