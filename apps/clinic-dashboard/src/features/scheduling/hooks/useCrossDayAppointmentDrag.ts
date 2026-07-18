import { useCallback, useRef, useState } from 'react';
import type { AppointmentListItem } from '../types/scheduling.types';
import { parseAnchorDate, toDateInputValue } from '../config/scheduling-config';
import { isSameCalendarDay, rescheduleAppointmentToDay } from '../lib/scheduling-drag.util';

const DRAG_THRESHOLD_PX = 6;

export function dayKeyFromDate(date: Date): string {
  return toDateInputValue(date);
}

interface UseCrossDayAppointmentDragOptions {
  canDrag?: boolean;
  onReschedule?: (appointment: AppointmentListItem, start: string, end: string) => void;
  appointmentsById: Map<string, AppointmentListItem>;
}

interface DragState {
  apptId: string;
  origDayKey: string;
  startX: number;
  startY: number;
  moved: boolean;
  pointerId: number;
  captureEl: HTMLElement | null;
}

export function useCrossDayAppointmentDrag({
  canDrag,
  onReschedule,
  appointmentsById,
}: UseCrossDayAppointmentDragOptions) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const clickSuppressedRef = useRef(false);

  const resolveDayKey = useCallback((x: number, y: number) => {
    const under = document.elementFromPoint(x, y);
    return under?.closest('[data-day-key]')?.getAttribute('data-day-key') ?? null;
  }, []);

  const finishDrag = useCallback(
    (clientX: number, clientY: number) => {
      const state = dragRef.current;
      dragRef.current = null;
      setDraggingId(null);
      setDropTargetKey(null);

      if (state?.captureEl?.hasPointerCapture(state.pointerId)) {
        state.captureEl.releasePointerCapture(state.pointerId);
      }

      if (!state?.moved || !canDrag || !onReschedule) {
        clickSuppressedRef.current = false;
        return;
      }

      clickSuppressedRef.current = true;
      const targetKey = resolveDayKey(clientX, clientY);
      if (!targetKey || targetKey === state.origDayKey) return;

      const appt = appointmentsById.get(state.apptId);
      const targetDay = parseAnchorDate(targetKey);
      if (!appt) return;

      const origDay = new Date(appt.start);
      if (isSameCalendarDay(origDay, targetDay)) return;

      const { start, end } = rescheduleAppointmentToDay(appt, targetDay);
      onReschedule(appt, start, end);
    },
    [appointmentsById, canDrag, onReschedule, resolveDayKey],
  );

  const onChipPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>, appt: AppointmentListItem, origDayKey: string) => {
      if (!canDrag || !onReschedule || e.button !== 0) return;

      const onMove = (ev: PointerEvent) => {
        const state = dragRef.current;
        if (!state || ev.pointerId !== state.pointerId) return;

        const dx = ev.clientX - state.startX;
        const dy = ev.clientY - state.startY;
        if (!state.moved) {
          if (Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD_PX) return;
          state.moved = true;
          setDraggingId(state.apptId);
          state.captureEl?.setPointerCapture(ev.pointerId);
        }

        setDropTargetKey(resolveDayKey(ev.clientX, ev.clientY));
      };

      const onUp = (ev: PointerEvent) => {
        const state = dragRef.current;
        if (!state || ev.pointerId !== state.pointerId) return;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        finishDrag(ev.clientX, ev.clientY);
      };

      dragRef.current = {
        apptId: appt.id,
        origDayKey,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
        pointerId: e.pointerId,
        captureEl: e.currentTarget,
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [canDrag, finishDrag, onReschedule, resolveDayKey],
  );

  const handleSelectClick = useCallback(
    (appt: AppointmentListItem, onSelect: (a: AppointmentListItem) => void) => {
      if (clickSuppressedRef.current) {
        clickSuppressedRef.current = false;
        return;
      }
      onSelect(appt);
    },
    [],
  );

  return {
    draggingId,
    dropTargetKey,
    onChipPointerDown,
    handleSelectClick,
  };
}
