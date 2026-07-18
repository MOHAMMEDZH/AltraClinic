import { useMemo, useRef, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import type { AppointmentListItem } from '../types/scheduling.types';
import {
  CALENDAR_HOURS,
  formatProviderLabel,
  formatTimeRange,
  statusBadgeClass,
} from '../config/scheduling-config';
import {
  layoutTimelineRowEvents,
  snapTimelineMinutes,
  TIMELINE_LANE_GAP,
  TIMELINE_LANE_HEIGHT,
  TIMELINE_PX_PER_HOUR,
} from '../lib/layout-timeline-events';
import styles from './TimelineScheduleGrid.module.css';

interface TimelineScheduleGridProps {
  date: Date;
  appointments: AppointmentListItem[];
  onSelect: (appointment: AppointmentListItem) => void;
  selectedId?: string | null;
  canDrag?: boolean;
  onReschedule?: (appointment: AppointmentListItem, start: string, end: string) => void;
  branchLabels?: Record<string, string>;
  showBranchLabels?: boolean;
}

const PX_PER_HOUR = TIMELINE_PX_PER_HOUR;
const TOTAL_HOURS = CALENDAR_HOURS.end - CALENDAR_HOURS.start;
const DRAG_THRESHOLD_PX = 6;

export function TimelineScheduleGrid({
  date,
  appointments,
  onSelect,
  selectedId,
  canDrag,
  onReschedule,
}: TimelineScheduleGridProps) {
  const { t, locale } = useI18n();
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragMovedRef = useRef(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const dayStart = useMemo(() => {
    const d = new Date(date);
    d.setHours(CALENDAR_HOURS.start, 0, 0, 0);
    return d;
  }, [date]);

  const timeFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }),
    [locale],
  );

  const hours = useMemo(() => {
    const list: number[] = [];
    for (let h = CALENDAR_HOURS.start; h <= CALENDAR_HOURS.end; h++) list.push(h);
    return list;
  }, []);

  const providers = useMemo(() => {
    const ids = new Set(appointments.map((a) => a.providerId));
    return Array.from(ids).sort();
  }, [appointments]);

  const byProvider = useMemo(() => {
    const map = new Map<string, ReturnType<typeof layoutTimelineRowEvents>>();
    for (const providerId of providers) {
      const providerAppts = appointments.filter((a) => a.providerId === providerId);
      map.set(providerId, layoutTimelineRowEvents(providerAppts, dayStart, PX_PER_HOUR));
    }
    return map;
  }, [appointments, dayStart, providers]);

  function handlePointerDown(
    e: React.PointerEvent<HTMLButtonElement>,
    appt: AppointmentListItem,
    providerId: string,
    durationMin: number,
    displayWidth: number,
    origLeft: number,
  ) {
    if (!canDrag || !onReschedule || e.button !== 0) return;

    const startClientX = e.clientX;
    let dragged = false;
    let el: HTMLElement | null = null;
    const trackWidth = TOTAL_HOURS * PX_PER_HOUR;

    const cleanup = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setDraggingId(null);
    };

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startClientX;
      if (!dragged && Math.abs(dx) < DRAG_THRESHOLD_PX) return;

      if (!dragged) {
        dragged = true;
        dragMovedRef.current = true;
        e.preventDefault();
        e.currentTarget.setPointerCapture(ev.pointerId);
        setDraggingId(appt.id);
        el = wrapRef.current?.querySelector(
          `[data-provider-id="${providerId}"] [data-appt-id="${appt.id}"]`,
        ) as HTMLElement | null;
      }

      if (!el) return;
      const maxLeft = trackWidth - displayWidth;
      const nextLeft = Math.max(0, Math.min(origLeft + (ev.clientX - startClientX), maxLeft));
      el.style.insetInlineStart = `${nextLeft}px`;
    };

    const onUp = (ev: PointerEvent) => {
      cleanup();

      if (!dragged) return;

      if (el) el.style.removeProperty('inset-inline-start');

      const dx = ev.clientX - startClientX;
      const maxLeft = trackWidth - displayWidth;
      const finalLeft = Math.max(0, Math.min(origLeft + dx, maxLeft));
      const snapped = snapTimelineMinutes(finalLeft, PX_PER_HOUR);
      const clamped = Math.max(0, Math.min(snapped, TOTAL_HOURS * 60 - durationMin));

      const newStart = new Date(dayStart);
      newStart.setMinutes(newStart.getMinutes() + clamped);
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

      <div ref={wrapRef} className={styles.wrap} role="region" aria-label={t('scheduling.views.timeline')}>
        <div className={styles.scrollBody}>
          <div className={styles.axis} aria-hidden>
            <span className={styles.axisSpacer} />
            <div className={styles.axisTicks} style={{ width: TOTAL_HOURS * PX_PER_HOUR }}>
              {hours.map((h) => (
                <span key={h} className={styles.tick} style={{ width: PX_PER_HOUR }}>
                  {timeFmt.format(new Date(date.getFullYear(), date.getMonth(), date.getDate(), h))}
                </span>
              ))}
            </div>
          </div>

          <div className={styles.rows}>
            {providers.map((providerId) => {
              const layout = byProvider.get(providerId)!;
              const rowHeight =
                layout.laneCount * (TIMELINE_LANE_HEIGHT + TIMELINE_LANE_GAP) + TIMELINE_LANE_GAP;

              return (
                <div key={providerId} className={styles.row}>
                  <span className={styles.rowLabel}>{formatProviderLabel(providerId)}</span>
                  <div
                    className={styles.track}
                    style={{ width: TOTAL_HOURS * PX_PER_HOUR, height: rowHeight }}
                    data-provider-id={providerId}
                  >
                    {hours.slice(0, -1).map((h) => (
                      <div
                        key={h}
                        className={styles.hourMark}
                        style={{ insetInlineStart: (h - CALENDAR_HOURS.start) * PX_PER_HOUR }}
                        aria-hidden
                      />
                    ))}

                    {layout.items.map(({ appt, left, displayWidth, durationMin, lane }) => {
                      const statusClass = statusBadgeClass(appt.status);
                      const tooltip = `${appt.patientName} · ${formatTimeRange(appt.start, appt.end, locale)}`;
                      const showTime = displayWidth >= 108;

                      return (
                        <button
                          key={appt.id}
                          type="button"
                          data-appt-id={appt.id}
                          title={tooltip}
                          className={[
                            styles.bar,
                            styles[`barStatus_${statusClass}`],
                            selectedId === appt.id ? styles.barSelected : '',
                            appt.isEmergency ? styles.barEmergency : '',
                            draggingId === appt.id ? styles.barDragging : '',
                            canDrag ? styles.barDraggable : '',
                          ].join(' ')}
                          style={{
                            insetInlineStart: left,
                            width: displayWidth,
                            top: lane * (TIMELINE_LANE_HEIGHT + TIMELINE_LANE_GAP) + 2,
                            height: TIMELINE_LANE_HEIGHT,
                          }}
                          onMouseDown={(e) => {
                            if (e.button === 0) e.preventDefault();
                          }}
                          onClick={() => handleSelect(appt)}
                          onPointerDown={(e) =>
                            handlePointerDown(e, appt, providerId, durationMin, displayWidth, left)
                          }
                          aria-pressed={selectedId === appt.id}
                        >
                          <span className={styles.barName}>{appt.patientName}</span>
                          {showTime && (
                            <span className={styles.barTime}>
                              {timeFmt.format(new Date(appt.start))}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
