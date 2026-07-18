import { useMemo } from 'react';
import { useI18n } from '@booking/i18n/react';
import type { AppointmentListItem } from '../types/scheduling.types';
import { addDays, startOfWeek } from '../config/scheduling-config';
import { dayKeyFromDate, useCrossDayAppointmentDrag } from '../hooks/useCrossDayAppointmentDrag';
import { StatusBadge } from './StatusBadge';
import { AppointmentBranchLabel } from './AppointmentBranchLabel';
import styles from './WeekScheduleGrid.module.css';

interface WeekScheduleGridProps {
  anchorDate: Date;
  appointments: AppointmentListItem[];
  onSelect: (appointment: AppointmentListItem) => void;
  selectedId?: string | null;
  canDrag?: boolean;
  onReschedule?: (appointment: AppointmentListItem, start: string, end: string) => void;
  branchLabels?: Record<string, string>;
  showBranchLabels?: boolean;
}

export function WeekScheduleGrid({
  anchorDate,
  appointments,
  onSelect,
  selectedId,
  canDrag,
  onReschedule,
  branchLabels,
  showBranchLabels,
}: WeekScheduleGridProps) {
  const { t, locale } = useI18n();

  const weekStart = useMemo(() => startOfWeek(anchorDate), [anchorDate]);

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const appointmentsById = useMemo(() => {
    const map = new Map<string, AppointmentListItem>();
    for (const appt of appointments) map.set(appt.id, appt);
    return map;
  }, [appointments]);

  const { draggingId, dropTargetKey, onChipPointerDown, handleSelectClick } = useCrossDayAppointmentDrag({
    canDrag,
    onReschedule,
    appointmentsById,
  });

  const dayFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
    [locale],
  );

  const timeFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }),
    [locale],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, AppointmentListItem[]>();
    for (const d of days) {
      map.set(dayKeyFromDate(d), []);
    }
    for (const appt of appointments) {
      const key = dayKeyFromDate(new Date(appt.start));
      if (map.has(key)) map.get(key)!.push(appt);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    }
    return map;
  }, [appointments, days]);

  const hasAny = appointments.length > 0;

  if (!hasAny) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>{t('scheduling.calendar.noAppointments')}</p>
        <p className={styles.emptyHint}>{t('scheduling.calendar.noAppointmentsHint')}</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {canDrag && <p className={styles.dragHint}>{t('scheduling.drag.weekHint')}</p>}

      <div className={styles.grid} role="grid" aria-label={t('scheduling.views.week')}>
        {days.map((day) => {
          const key = dayKeyFromDate(day);
          const dayAppts = byDay.get(key) ?? [];
          const isToday = dayKeyFromDate(new Date()) === key;
          return (
            <section
              key={key}
              data-day-key={key}
              className={[
                styles.dayCol,
                isToday ? styles.today : '',
                dropTargetKey === key ? styles.dayColDropTarget : '',
              ].join(' ')}
              aria-label={dayFmt.format(day)}
            >
              <header className={styles.dayHeader}>
                <span className={styles.dayName}>{dayFmt.format(day)}</span>
                <span className={styles.dayCount}>{dayAppts.length}</span>
              </header>
              <ul className={styles.list}>
                {dayAppts.map((appt) => (
                  <li key={appt.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      className={[
                        styles.chip,
                        selectedId === appt.id ? styles.chipSelected : '',
                        draggingId === appt.id ? styles.chipDragging : '',
                        canDrag ? styles.chipDraggable : '',
                      ].join(' ')}
                      onClick={() => handleSelectClick(appt, onSelect)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelect(appt);
                        }
                      }}
                      onPointerDown={(e) => onChipPointerDown(e, appt, key)}
                      aria-pressed={selectedId === appt.id}
                    >
                      <span className={styles.chipTime}>{timeFmt.format(new Date(appt.start))}</span>
                      <span className={styles.chipPatient}>{appt.patientName}</span>
                      <AppointmentBranchLabel
                        branchId={appt.branchId}
                        branchLabels={branchLabels}
                        show={showBranchLabels}
                      />
                      <StatusBadge status={appt.status} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
