import { useSearchParams } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { isFromAppointment, parseAppointmentContext } from '@/lib/appointment-clinical-nav';
import { formatTimeRange } from '../config/scheduling-config';
import { useAppointment } from './useScheduling';

export function useAppointmentContextDisplay() {
  const { locale } = useI18n();
  const [searchParams] = useSearchParams();
  const ctx = parseAppointmentContext(searchParams);
  const fromAppointment = isFromAppointment(ctx);
  const apptQuery = useAppointment(fromAppointment ? ctx.appointmentId : undefined);

  return {
    ctx,
    fromAppointment,
    patientName: apptQuery.data?.patientName,
    appointmentLabel: apptQuery.data
      ? formatTimeRange(apptQuery.data.start, apptQuery.data.end, locale)
      : undefined,
    loading: apptQuery.isLoading,
  };
}
