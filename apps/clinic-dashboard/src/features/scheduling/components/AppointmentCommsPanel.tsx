import { useState } from 'react';
import { Bell, Mail, MessageCircle, Smartphone } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { sendPatientNotification } from '@/features/patients/lib/patient-notifications';
import { buildWhatsAppUrl, renderWhatsAppTemplate } from '@/features/patients/lib/whatsapp-message';
import type { AppointmentListItem } from '../types/scheduling.types';
import styles from './AppointmentCommsPanel.module.css';

interface AppointmentCommsPanelProps {
  appointment: AppointmentListItem;
  patientPhone?: string | null;
  patientEmail?: string | null;
}

export function AppointmentCommsPanel({
  appointment,
  patientPhone,
  patientEmail,
}: AppointmentCommsPanelProps) {
  const { t } = useI18n();
  const { getValidAccessToken, user } = useAuth();
  const roles = user?.roles ?? [];
  const canNotify = hasPermission(roles, 'api.notifications', 'create');
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reminderBody = renderWhatsAppTemplate(t, 'patients.whatsapp.templates.appointmentReminder', {
    name: appointment.patientName,
  });
  const reminderTitle = t('patients.whatsapp.templateNames.appointmentReminder');

  const sendMutation = useMutation({
    mutationFn: async (channel: 'whatsapp' | 'email' | 'sms') => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return sendPatientNotification(token, user.tenantId, {
        patientId: appointment.patientId,
        channel,
        title: reminderTitle,
        body: reminderBody,
        branchId: user.branchId,
      });
    },
    onSuccess: () => {
      setError(null);
      setSuccess(t('scheduling.comms.sent'));
    },
    onError: (err) => {
      setSuccess(null);
      setError(err instanceof Error ? err.message : t('scheduling.comms.noPermission'));
    },
  });

  function openWhatsApp() {
    if (!patientPhone) return;
    window.open(buildWhatsAppUrl(patientPhone, reminderBody), '_blank', 'noopener,noreferrer');
  }

  return (
    <section className={styles.panel} aria-labelledby="appt-comms-heading">
      <h3 id="appt-comms-heading" className={styles.title}>
        {t('scheduling.comms.title')}
      </h3>
      {success && <AuthAlert variant="success">{success}</AuthAlert>}
      {error && <AuthAlert variant="error">{error}</AuthAlert>}
      <div className={styles.actions}>
        <AuthButton
          variant="secondary"
          disabled={!canNotify}
          loading={sendMutation.isPending}
          onClick={() => void sendMutation.mutateAsync('whatsapp')}
        >
          <Bell size={16} aria-hidden />
          {t('scheduling.comms.sendReminder')}
        </AuthButton>
        <AuthButton
          variant="secondary"
          disabled={!canNotify || !patientEmail}
          loading={sendMutation.isPending}
          onClick={() => void sendMutation.mutateAsync('email')}
        >
          <Mail size={16} aria-hidden />
          {t('scheduling.comms.sendEmail')}
        </AuthButton>
        <AuthButton
          variant="secondary"
          disabled={!canNotify || !patientPhone}
          loading={sendMutation.isPending}
          onClick={() => void sendMutation.mutateAsync('sms')}
        >
          <Smartphone size={16} aria-hidden />
          {t('scheduling.comms.sendSms')}
        </AuthButton>
        <AuthButton variant="ghost" disabled={!patientPhone} onClick={openWhatsApp}>
          <MessageCircle size={16} aria-hidden />
          {t('scheduling.comms.openWhatsapp')}
        </AuthButton>
      </div>
    </section>
  );
}
