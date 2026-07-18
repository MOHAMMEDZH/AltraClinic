import { useMemo, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { formatMessage } from '@/i18n/messages';
import { Modal } from '@/features/patients/components/Modal';
import type { AppointmentListItem } from '../types/scheduling.types';
import { addDays, startOfMonth, startOfWeek } from '../config/scheduling-config';
import { dayKeyFromDate, useCrossDayAppointmentDrag } from '../hooks/useCrossDayAppointmentDrag';
import { AppointmentBranchLabel } from './AppointmentBranchLabel';
import { StatusBadge } from './StatusBadge';
import styles from './MonthScheduleGrid.module.css';

const VISIBLE_IN_CELL = 3;

interface MonthScheduleGridProps {
  anchorDate: Date;
  appointments: AppointmentListItem[];
  onSelect: (appointment: AppointmentListItem) => void;
  onDaySelect: (date: Date) => void;
  selectedId?: string | null;
  canDrag?: boolean;
  onReschedule?: (appointment: AppointmentListItem, start: string, end: string) => void;
  branchLabels?: Record<string, string>;
  showBranchLabels?: boolean;
}

interface MonthEventChipProps {
  appt: AppointmentListItem;
  dayKey: string;
  selectedId?: string | null;
  draggingId?: string | null;
  canDrag?: boolean;
  variant?: 'cell' | 'dialog';
  branchLabels?: Record<string, string>;
  showBranchLabels?: boolean;
  timeFmt: Intl.DateTimeFormat;
  onSelect: (appointment: AppointmentListItem) => void;
  onChipPointerDown: (e: React.PointerEvent<HTMLElement>, appt: AppointmentListItem, dayKey: string) => void;
  handleSelectClick: (appt: AppointmentListItem, onSelect: (a: AppointmentListItem) => void) => void;
}

function MonthEventChip({
  appt,
  dayKey,
  selectedId,
  draggingId,
  canDrag,
  variant = 'cell',
  branchLabels,
  showBranchLabels,
  timeFmt,
  onSelect,
  onChipPointerDown,
  handleSelectClick,
}: MonthEventChipProps) {
  const chipClass = variant === 'dialog' ? styles.dialogEvent : styles.event;

  return (
    <div
      role="button"
      tabIndex={0}
      className={[
        chipClass,
        selectedId === appt.id ? styles.eventSelected : '',
        draggingId === appt.id ? styles.eventDragging : '',
        canDrag && variant === 'cell' ? styles.eventDraggable : '',
      ].join(' ')}
      onClick={(e) => {
        e.stopPropagation();
        handleSelectClick(appt, onSelect);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onSelect(appt);
        }
      }}
      onPointerDown={variant === 'cell' ? (e) => onChipPointerDown(e, appt, dayKey) : undefined}
      aria-pressed={selectedId === appt.id}
    >
      <span className={styles.eventTime}>{timeFmt.format(new Date(appt.start))}</span>
      <span className={variant === 'dialog' ? styles.dialogEventPatient : styles.eventPatient}>
        {appt.patientName}
      </span>
      {variant === 'dialog' && <StatusBadge status={appt.status} />}
      <AppointmentBranchLabel
        branchId={appt.branchId}
        branchLabels={branchLabels}
        show={showBranchLabels}
      />
    </div>
  );
}

export function MonthScheduleGrid({
  anchorDate,
  appointments,
  onSelect,
  onDaySelect,
  selectedId,
  canDrag,
  onReschedule,
  branchLabels,
  showBranchLabels,
}: MonthScheduleGridProps) {
  const { t, locale } = useI18n();
  const [overflowDay, setOverflowDay] = useState<Date | null>(null);
  const monthStart = useMemo(() => startOfMonth(anchorDate), [anchorDate]);

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

  const weeks = useMemo(() => {
    const gridStart = startOfWeek(monthStart);
    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) cells.push(addDays(gridStart, i));
    const rows: Date[][] = [];
    for (let w = 0; w < 6; w++) rows.push(cells.slice(w * 7, w * 7 + 7));
    return rows;
  }, [monthStart]);

  const byDay = useMemo(() => {
    const map = new Map<string, AppointmentListItem[]>();
    for (const appt of appointments) {
      const key = dayKeyFromDate(new Date(appt.start));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(appt);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    }
    return map;
  }, [appointments]);

  const dayFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: 'short' }),
    [locale],
  );
  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }),
    [locale],
  );
  const dayTitleFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
    [locale],
  );
  const timeFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }),
    [locale],
  );

  const monthLabel = dateFmt.format(monthStart);
  const currentMonth = monthStart.getMonth();
  const overflowDayKey = overflowDay ? dayKeyFromDate(overflowDay) : null;
  const overflowAppts = overflowDayKey ? (byDay.get(overflowDayKey) ?? []) : [];

  function selectFromOverflow(appt: AppointmentListItem) {
    onSelect(appt);
    setOverflowDay(null);
  }

  return (
    <div className={styles.container}>
      {canDrag && <p className={styles.dragHint}>{t('scheduling.drag.monthHint')}</p>}

      <div className={styles.wrap} role="grid" aria-label={`${t('scheduling.views.month')} — ${monthLabel}`}>
        <div className={styles.weekHeader} role="row">
          {weeks[0]?.map((day) => (
            <div key={dayFmt.format(day)} className={styles.weekday} role="columnheader">
              {dayFmt.format(day)}
            </div>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0].toISOString()} className={styles.weekRow} role="row">
            {week.map((day) => {
              const key = dayKeyFromDate(day);
              const dayAppts = byDay.get(key) ?? [];
              const inMonth = day.getMonth() === currentMonth;
              const isToday = dayKeyFromDate(new Date()) === key;
              const visible = dayAppts.slice(0, VISIBLE_IN_CELL);
              const overflow = dayAppts.length - visible.length;
              return (
                <div
                  key={key}
                  data-day-key={key}
                  className={[
                    styles.cell,
                    !inMonth ? styles.outside : '',
                    isToday ? styles.today : '',
                    dropTargetKey === key ? styles.cellDropTarget : '',
                    dayAppts.length > VISIBLE_IN_CELL ? styles.cellBusy : '',
                  ].join(' ')}
                  role="gridcell"
                >
                  <button
                    type="button"
                    className={styles.dayBtn}
                    onClick={() => onDaySelect(day)}
                    aria-label={formatMessage(t('scheduling.month.selectDay'), {
                      date: day.toLocaleDateString(locale),
                    })}
                  >
                    {day.getDate()}
                  </button>
                  <ul className={styles.events}>
                    {visible.map((appt) => (
                      <li key={appt.id}>
                        <MonthEventChip
                          appt={appt}
                          dayKey={key}
                          selectedId={selectedId}
                          draggingId={draggingId}
                          canDrag={canDrag}
                          branchLabels={branchLabels}
                          showBranchLabels={showBranchLabels}
                          timeFmt={timeFmt}
                          onSelect={onSelect}
                          onChipPointerDown={onChipPointerDown}
                          handleSelectClick={handleSelectClick}
                        />
                      </li>
                    ))}
                    {overflow > 0 && (
                      <li>
                        <button
                          type="button"
                          className={styles.moreBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOverflowDay(day);
                          }}
                          aria-label={formatMessage(t('scheduling.month.showAll'), {
                            n: dayAppts.length,
                            date: day.toLocaleDateString(locale),
                          })}
                        >
                          {formatMessage(t('scheduling.month.more'), { n: overflow })}
                        </button>
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <Modal
        open={overflowDay !== null}
        title={
          overflowDay
            ? formatMessage(t('scheduling.month.overflowTitle'), {
                date: dayTitleFmt.format(overflowDay),
              })
            : ''
        }
        onClose={() => setOverflowDay(null)}
        size="md"
        footer={
          overflowDay ? (
            <button
              type="button"
              className={styles.openDayBtn}
              onClick={() => {
                onDaySelect(overflowDay);
                setOverflowDay(null);
              }}
            >
              {t('scheduling.month.openDayView')}
            </button>
          ) : undefined
        }
      >
        <ul className={styles.dialogList}>
          {overflowAppts.map((appt) => (
            <li key={appt.id}>
              <MonthEventChip
                appt={appt}
                dayKey={overflowDayKey ?? dayKeyFromDate(new Date(appt.start))}
                selectedId={selectedId}
                variant="dialog"
                branchLabels={branchLabels}
                showBranchLabels={showBranchLabels}
                timeFmt={timeFmt}
                onSelect={selectFromOverflow}
                onChipPointerDown={onChipPointerDown}
                handleSelectClick={handleSelectClick}
              />
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}
