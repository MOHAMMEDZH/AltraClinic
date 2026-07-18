import { Link, useNavigate } from 'react-router-dom';
import { Receipt } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { formatMessage } from '@/i18n/messages';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { patientProfileFromAppointment } from '@/lib/appointment-clinical-nav';
import { usePatient } from '@/features/patients/hooks/usePatients';
import { useQueueBoard } from '@/features/queue/hooks/useQueue';
import { useUpdateQueueTicketStatus } from '@/features/queue/hooks/useQueue';
import { useSchedulingContext } from '../hooks/useScheduling';
import type { AppointmentListItem, AppointmentAction } from '../types/scheduling.types';
import { formatProviderLabel, formatServiceTypeLabel, formatTimeRange } from '../config/scheduling-config';
import { StatusBadge } from './StatusBadge';
import { AppointmentClinicalQuickNav } from './AppointmentClinicalQuickNav';
import { AppointmentCommsPanel } from './AppointmentCommsPanel';
import { AppointmentDocumentsPanel } from './AppointmentDocumentsPanel';
import styles from './AppointmentDetailPanel.module.css';

interface AppointmentDetailPanelProps {
  appointment: AppointmentListItem & { cancellationReason?: string | null };
  canUpdate: boolean;
  canDelete?: boolean;
  canCheckIn?: boolean;
  canManageQueue?: boolean;
  canCreateInvoice?: boolean;
  busy?: boolean;
  checkInBusy?: boolean;
  invoiceBusy?: boolean;
  onAction: (action: AppointmentAction) => void;
  onRequestCancel: () => void;
  onDelete?: () => void;
  onReschedule: () => void;
  onRescheduleSeriesFuture?: () => void;
  onEditNotes: () => void;
  onFollowUp?: () => void;
  onCancelSeriesFuture?: () => void;
  onCheckIn?: () => void;
  onCreateInvoice?: () => void;
  onClose: () => void;
}

export function AppointmentDetailPanel({
  appointment,
  canUpdate,
  canDelete,
  canCheckIn,
  canManageQueue,
  canCreateInvoice,
  busy,
  checkInBusy,
  invoiceBusy,
  onAction,
  onRequestCancel,
  onDelete,
  onReschedule,
  onRescheduleSeriesFuture,
  onEditNotes,
  onFollowUp,
  onCancelSeriesFuture,
  onCheckIn,
  onCreateInvoice,
  onClose,
}: AppointmentDetailPanelProps) {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const schedulingContext = useSchedulingContext();
  const clinicTimezone = schedulingContext.data?.timezone;
  const patientQuery = usePatient(appointment.patientId);
  const queueQuery = useQueueBoard(appointment.branchId ?? undefined);
  const queueStatusMutation = useUpdateQueueTicketStatus();

  const queueTicket = [
    ...(queueQuery.data?.waiting ?? []),
    ...(queueQuery.data?.serving ?? []),
  ].find((ticket) => ticket.appointmentId === appointment.id);

  const isTerminal =
    appointment.status === 'cancelled' ||
    appointment.status === 'completed' ||
    appointment.status === 'no_show';

  async function handleQueueAction(status: 'serving' | 'completed') {
    if (!queueTicket) return;
    await queueStatusMutation.mutateAsync({ queueTicketId: queueTicket.queueTicketId, status });
  }

  return (
    <aside className={styles.panel} aria-labelledby="appt-detail-title">
      <header className={styles.header}>
        <h2 id="appt-detail-title" className={styles.title}>
          {t('scheduling.detail.title')}
        </h2>
        <button type="button" className={styles.closeBtn} onClick={onClose}>
          {t('scheduling.actions.close')}
        </button>
      </header>

      <dl className={styles.meta}>
        <div>
          <dt>{t('scheduling.detail.patient')}</dt>
          <dd>
            <Link to={patientProfileFromAppointment(appointment.patientId, appointment.id)} className={styles.link}>
              {appointment.patientName}
            </Link>
          </dd>
        </div>
        <div>
          <dt>{t('scheduling.detail.provider')}</dt>
          <dd>{formatProviderLabel(appointment.providerId)}</dd>
        </div>
        <div>
          <dt>{t('scheduling.form.serviceType')}</dt>
          <dd>{formatServiceTypeLabel(appointment.serviceType, t)}</dd>
        </div>
        {appointment.isEmergency && (
          <div>
            <dt>{t('scheduling.form.emergency')}</dt>
            <dd>{t('scheduling.emergency.yes')}</dd>
          </div>
        )}
        {appointment.resourceName && (
          <div>
            <dt>{t('scheduling.form.resource')}</dt>
            <dd>{appointment.resourceName}</dd>
          </div>
        )}
        <div>
          <dt>{t('scheduling.detail.dateTime')}</dt>
          <dd>{formatTimeRange(appointment.start, appointment.end, locale, clinicTimezone)}</dd>
        </div>
        <div>
          <dt>{t('scheduling.detail.status')}</dt>
          <dd>
            <StatusBadge status={appointment.status} />
          </dd>
        </div>
        {appointment.status === 'cancelled' && appointment.cancellationReason && (
          <div>
            <dt>{t('scheduling.detail.cancellationReason')}</dt>
            <dd>{appointment.cancellationReason}</dd>
          </div>
        )}
        {queueTicket && (
          <>
            <div>
              <dt>{t('scheduling.detail.queueStatus')}</dt>
              <dd>{t(`scheduling.queue.ticketStatus.${queueTicket.status}`)}</dd>
            </div>
            {queueTicket.position != null && (
              <div>
                <dt>{t('scheduling.detail.queuePosition')}</dt>
                <dd>#{queueTicket.position}</dd>
              </div>
            )}
            {queueTicket.estimatedWaitMinutes != null && queueTicket.status === 'waiting' && (
              <div>
                <dt>{t('scheduling.detail.estimatedWait')}</dt>
                <dd>
                  {formatMessage(t('scheduling.queueOverview.minutes'), {
                    n: queueTicket.estimatedWaitMinutes,
                  })}
                </dd>
              </div>
            )}
          </>
        )}
        <div>
          <dt>{t('scheduling.detail.notes')}</dt>
          <dd>{appointment.notes?.trim() ? appointment.notes : t('scheduling.detail.noNotes')}</dd>
        </div>
      </dl>

      <AppointmentClinicalQuickNav appointment={appointment} />

      <AppointmentCommsPanel
        appointment={appointment}
        patientPhone={patientQuery.data?.phone}
        patientEmail={patientQuery.data?.email}
      />

      <AppointmentDocumentsPanel appointmentId={appointment.id} patientId={appointment.patientId} />

      {canCreateInvoice && onCreateInvoice && !isTerminal && (
        <div className={styles.checkInRow}>
          <AuthButton loading={invoiceBusy} variant="secondary" onClick={onCreateInvoice}>
            <Receipt size={16} aria-hidden />
            {t('scheduling.billing.createInvoice')}
          </AuthButton>
        </div>
      )}

      {canCheckIn && onCheckIn && !isTerminal && !queueTicket && (
        <div className={styles.checkInRow}>
          <AuthButton loading={checkInBusy} onClick={onCheckIn}>
            {t('scheduling.actions.checkIn')}
          </AuthButton>
        </div>
      )}

      {canManageQueue && queueTicket && !isTerminal && (
        <div className={styles.queueActions}>
          {queueTicket.status === 'waiting' && (
            <AuthButton
              loading={queueStatusMutation.isPending}
              onClick={() => void handleQueueAction('serving')}
            >
              {t('scheduling.queue.startServing')}
            </AuthButton>
          )}
          {queueTicket.status === 'serving' && (
            <AuthButton
              variant="secondary"
              loading={queueStatusMutation.isPending}
              onClick={() => void handleQueueAction('completed')}
            >
              {t('scheduling.queue.completeVisit')}
            </AuthButton>
          )}
          <AuthButton variant="ghost" onClick={() => navigate('/queue')}>
            {t('scheduling.queueOverview.openQueue')}
          </AuthButton>
        </div>
      )}

      {canUpdate && !isTerminal && (
        <div className={styles.actions}>
          {appointment.status === 'pending' && (
            <AuthButton disabled={busy} onClick={() => onAction('confirm')}>
              {t('scheduling.actions.confirm')}
            </AuthButton>
          )}
          <AuthButton variant="secondary" disabled={busy} onClick={onReschedule}>
            {t('scheduling.actions.reschedule')}
          </AuthButton>
          {appointment.recurrenceSeriesId && onRescheduleSeriesFuture && (
            <AuthButton variant="secondary" disabled={busy} onClick={onRescheduleSeriesFuture}>
              {t('scheduling.series.rescheduleFuture')}
            </AuthButton>
          )}
          <AuthButton variant="secondary" disabled={busy} onClick={onEditNotes}>
            {t('scheduling.actions.edit')}
          </AuthButton>
          {onFollowUp && (
            <AuthButton variant="secondary" disabled={busy} onClick={onFollowUp}>
              {t('scheduling.followUp.schedule')}
            </AuthButton>
          )}
          {appointment.recurrenceSeriesId && onCancelSeriesFuture && (
            <AuthButton variant="danger" disabled={busy} onClick={onCancelSeriesFuture}>
              {t('scheduling.series.cancelFuture')}
            </AuthButton>
          )}
          <AuthButton variant="secondary" disabled={busy} onClick={() => onAction('complete')}>
            {t('scheduling.actions.complete')}
          </AuthButton>
          <AuthButton variant="secondary" disabled={busy} onClick={() => onAction('no_show')}>
            {t('scheduling.actions.noShow')}
          </AuthButton>
          <AuthButton variant="danger" disabled={busy} onClick={onRequestCancel}>
            {t('scheduling.actions.cancel')}
          </AuthButton>
        </div>
      )}

      {canDelete && onDelete && (
        <div className={styles.checkInRow}>
          <AuthButton variant="ghost" disabled={busy} onClick={onDelete}>
            {t('scheduling.actions.delete')}
          </AuthButton>
        </div>
      )}
    </aside>
  );
}
