import { useI18n } from '@booking/i18n/react';
import { CheckCircle2, Circle, Clock, Lock } from 'lucide-react';
import type { TreatmentPhase, TreatmentPlanItem } from './treatment-plan.types';
import { formatDuration, formatPlanDate } from './treatment-plan-config';
import styles from './TreatmentPlanTimeline.module.css';

interface TreatmentPlanTimelineProps {
  phases: TreatmentPhase[];
  allItems: TreatmentPlanItem[];
  activeItemId?: string | null;
  onSelectItem?: (itemId: string) => void;
  compact?: boolean;
}

export function TreatmentPlanTimeline({
  phases,
  allItems,
  activeItemId,
  onSelectItem,
  compact,
}: TreatmentPlanTimelineProps) {
  const { t, locale } = useI18n();

  function itemIcon(item: TreatmentPlanItem) {
    if (item.status === 'completed') return <CheckCircle2 size={16} className={styles.iconDone} aria-hidden />;
    if (item.status === 'blocked') return <Lock size={16} className={styles.iconBlocked} aria-hidden />;
    if (item.status === 'in_progress' || item.status === 'scheduled') {
      return <Clock size={16} className={styles.iconActive} aria-hidden />;
    }
    return <Circle size={16} className={styles.iconPending} aria-hidden />;
  }

  function isBlocked(item: TreatmentPlanItem) {
    if (!item.dependsOnItemId) return false;
    const dep = allItems.find((i) => i.id === item.dependsOnItemId);
    return dep != null && dep.status !== 'completed';
  }

  return (
    <div className={compact ? styles.compact : styles.timeline} role="list" aria-label={t('dental.treatmentPlan.timeline.label')}>
      {phases.map((phase, pi) => (
        <section key={phase.id} className={styles.phase} role="listitem">
          <header className={styles.phaseHeader}>
            <span className={styles.visitBadge}>
              {t('dental.treatmentPlan.timeline.visit').replace('{n}', String(phase.visitNumber ?? pi + 1))}
            </span>
            <div>
              <h3 className={styles.phaseTitle}>{phase.name}</h3>
              {!compact && phase.estimatedVisitDate && (
                <p className={styles.phaseDate}>{formatPlanDate(phase.estimatedVisitDate, locale)}</p>
              )}
            </div>
          </header>
          <ol className={styles.items}>
            {phase.items.map((item) => {
              const blocked = isBlocked(item);
              const selected = activeItemId === item.id;
              const statusKey = item.status === 'in_progress' ? 'inProgress' : item.status;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={[styles.item, selected ? styles.itemActive : '', blocked ? styles.itemBlocked : ''].join(' ')}
                    onClick={() => onSelectItem?.(item.id)}
                    aria-current={selected ? 'step' : undefined}
                    disabled={!onSelectItem}
                  >
                    {itemIcon(item)}
                    <div className={styles.itemBody}>
                      <span className={styles.itemCode}>{item.code}</span>
                      <span className={styles.itemDesc}>{item.description}</span>
                      {!compact && (
                        <span className={styles.itemMeta}>
                          {formatDuration(item.estimatedMinutes, locale)}
                          {item.toothNumbers.length > 0 && ` · #${item.toothNumbers.join(', #')}`}
                        </span>
                      )}
                    </div>
                    <span className={[styles.statusPill, styles[`status_${item.status}`]].join(' ')}>
                      {t(`dental.treatmentPlan.itemStatus.${statusKey}` as 'dental.treatmentPlan.itemStatus.planned')}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
