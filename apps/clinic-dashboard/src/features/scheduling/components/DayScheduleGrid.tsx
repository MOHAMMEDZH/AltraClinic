import { useMemo, useRef, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import type { AppointmentListItem } from '../types/scheduling.types';
import { CALENDAR_HOURS, formatTimeRange, statusBadgeClass } from '../config/scheduling-config';
import {
  DAY_GRID_HOUR_HEIGHT,
  DAY_GRID_MIN_EVENT_HEIGHT,
  layoutDayGridAppointments,
  snapDayGridMinutes,
} from '../lib/layout-day-events';
import styles from './DayScheduleGrid.module.css';

interface DayScheduleGridProps {
  date: Date;
  appointments: AppointmentListItem[];
  onSelect: (appointment: AppointmentListItem) => void;
  selectedId?: string | null;
  canDrag?: boolean;
  onReschedule?: (appointment: AppointmentListItem, start: string, end: string) => void;
  branchLabels?: Record<string, string>;
  showBranchLabels?: boolean;
}

const HOUR_HEIGHT = DAY_GRID_HOUR_HEIGHT;
const TOTAL_HOURS = CALENDAR_HOURS.end - CALENDAR_HOURS.start;
const DRAG_THRESHOLD_PX = 6;

export function DayScheduleGrid({
  date,
  appointments,
  onSelect,
  selectedId,
  canDrag,
  onReschedule,
}: DayScheduleGridProps) {
  const { t, locale } = useI18n();
  const gridRef = useRef<HTMLDivElement>(null);
  const dragMovedRef = useRef(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const timeFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }),
    [locale],
  );

  const dayStart = useMemo(() => {
    const d = new Date(date);
    d.setHours(CALENDAR_HOURS.start, 0, 0, 0);
    return d;
  }, [date]);

  const hours = useMemo(() => {
    const list: number[] = [];
    for (let h = CALENDAR_HOURS.start; h <= CALENDAR_HOURS.end; h++) list.push(h);
    return list;
  }, []);

  const positioned = useMemo(
    () => layoutDayGridAppointments(appointments, dayStart, HOUR_HEIGHT),
    [appointments, dayStart],
  );

  function handlePointerDown(
    e: React.PointerEvent<HTMLButtonElement>,
    appt: AppointmentListItem,
    durationMin: number,
    origTop: number,
  ) {
    if (!canDrag || !onReschedule || e.button !== 0) return;

    const startClientY = e.clientY;
    let dragged = false;
    let el: HTMLElement | null = null;

    const cleanup = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setDraggingId(null);
    };

    const onMove = (ev: PointerEvent) => {
      const dy = ev.clientY - startClientY;
      if (!dragged && Math.abs(dy) < DRAG_THRESHOLD_PX) return;

      if (!dragged) {
        dragged = true;
        dragMovedRef.current = true;
        e.preventDefault();
        e.currentTarget.setPointerCapture(ev.pointerId);
        setDraggingId(appt.id);
        el = gridRef.current?.querySelector(`[data-appt-id="${appt.id}"]`) as HTMLElement | null;
      }

      if (!el) return;
      const maxTop = TOTAL_HOURS * HOUR_HEIGHT - DAY_GRID_MIN_EVENT_HEIGHT;
      const nextTop = Math.max(0, Math.min(origTop + (ev.clientY - startClientY), maxTop));
      el.style.top = `${nextTop}px`;
    };

    const onUp = (ev: PointerEvent) => {
      cleanup();

      if (!dragged) return;

      if (el) el.style.removeProperty('top');

      const dy = ev.clientY - startClientY;
      const maxTop = TOTAL_HOURS * HOUR_HEIGHT - DAY_GRID_MIN_EVENT_HEIGHT;
      const finalTop = Math.max(0, Math.min(origTop + dy, maxTop));
      const rawMinutes = (finalTop / HOUR_HEIGHT) * 60;
      const snapped = snapDayGridMinutes(
        Math.max(0, Math.min(rawMinutes, TOTAL_HOURS * 60 - durationMin)),
      );

      const newStart = new Date(dayStart);
      newStart.setMinutes(newStart.getMinutes() + snapped);
      const newEnd = new Date(newStart);
      newEnd.setMinutes(newEnd.getMinutes() + durationMin);

      if (newStart.toISOString() !== appt.start) {
        onReschedule(appt, newStart.toISOString(), newEnd.toISOString());
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function handleSelect(appt: AppointmentListItem) {
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }
    onSelect(appt);
  }

  if (!appointments.length) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>{t('scheduling.calendar.noAppointments')}</p>
        <p className={styles.emptyHint}>{t('scheduling.calendar.noAppointmentsHint')}</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {canDrag && <p className={styles.dragHint}>{t('scheduling.drag.hint')}</p>}

      <div className={styles.wrap}>
        <div className={styles.timeCol} aria-hidden>
          {hours.slice(0, -1).map((h) => {
            const label = new Intl.DateTimeFormat(locale, {
              hour: 'numeric',
              minute: '2-digit',
            }).format(new Date(date.getFullYear(), date.getMonth(), date.getDate(), h));
            return (
              <div key={h} className={styles.timeLabel} style={{ height: HOUR_HEIGHT }}>
                {label}
              </div>
            );
          })}
        </div>

        <div
          className={styles.gridCol}
          role="grid"
          aria-label={t('scheduling.views.day')}
          style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}
        >
          <div className={styles.gridRows} aria-hidden>
            {hours.slice(0, -1).map((h) => (
              <div key={h} className={styles.hourRow} style={{ height: HOUR_HEIGHT }} />
            ))}
          </div>

          <div ref={gridRef} className={styles.eventsLayer}>
            {positioned.map(({ appt, top, height, durationMin, leftPct, widthPct, column }) => {
              const narrow = widthPct < 42;
              const short = height < 44;
              const showRange = !narrow && !short;
              const statusClass = statusBadgeClass(appt.status);
              const tooltip = `${appt.patientName} · ${formatTimeRange(appt.start, appt.end, locale)}`;

              return (
                <button
                  key={appt.id}
                  type="button"
                  data-appt-id={appt.id}
                  title={tooltip}
                  className={[
                    styles.event,
                    styles[`eventStatus_${statusClass}`],
                    short ? styles.eventShort : '',
                    narrow ? styles.eventNarrow : '',
                    selectedId === appt.id ? styles.eventSelected : '',
                    appt.isEmergency ? styles.eventEmergency : '',
                    draggingId === appt.id ? styles.eventDragging : '',
                    canDrag ? styles.eventDraggable : '',
                  ].join(' ')}
                  style={{
                    top,
                    height,
                    left: `${leftPct}%`,
                    width: `calc(${widthPct}% - 4px)`,
                    marginLeft: column === 0 ? 0 : 2,
                    zIndex: selectedId === appt.id ? 10 : column + 1,
                  }}
                  onMouseDown={(e) => {
                    if (e.button === 0) e.preventDefault();
                  }}
                  onClick={() => handleSelect(appt)}
                  onPointerDown={(e) => handlePointerDown(e, appt, durationMin, top)}
                  aria-pressed={selectedId === appt.id}
                >
                  {showRange ? (
                    <span className={styles.eventTime}>
                      {formatTimeRange(appt.start, appt.end, locale)}
                    </span>
                  ) : (
                    <span className={styles.eventTime}>
                      {timeFmt.format(new Date(appt.start))}
                    </span>
                  )}
                  <span className={styles.eventPatient}>{appt.patientName}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
