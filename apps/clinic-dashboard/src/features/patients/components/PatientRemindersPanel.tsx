import { useState } from 'react';
import { Bell, Calendar, HeartPulse } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useI18n } from '@booking/i18n/react';
import { hasPermission } from '@booking/permissions';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { buildWhatsAppUrl, renderWhatsAppTemplate } from '../lib/whatsapp-message';
import { sendPatientNotification } from '../lib/patient-notifications';
import { patientFullName } from '../lib/patient-format';
import type { PatientDetail } from '../types';
import styles from './PatientRemindersPanel.module.css';

interface PatientRemindersPanelProps {
  patient: Pick<
    PatientDetail,
    'id' | 'phone' | 'firstName' | 'lastName' | 'firstNameAr' | 'lastNameAr' | 'profileData'
  >;
}

export function PatientRemindersPanel({ patient }: PatientRemindersPanelProps) {
  const { t, locale } = useI18n();
  const { getValidAccessToken, user } = useAuth();
  const roles = user?.roles ?? [];
  const canCreateNotification = hasPermission(roles, 'api.notifications', 'create');
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const name = patientFullName(patient, locale);
  const whatsappEnabled = patient.profileData?.communication?.whatsapp !== false;
  const appointmentReminders = patient.profileData?.communication?.appointmentReminders !== false;
  const followUpReminders = patient.profileData?.communication?.followUpReminders !== false;

  const sendMutation = useMutation({
    mutationFn: async (kind: 'appointmentReminder' | 'followUp') => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      const templateKey =
        kind === 'appointmentReminder'
          ? 'patients.whatsapp.templates.appointmentReminder'
          : 'patients.whatsapp.templates.followUp';
      const body = renderWhatsAppTemplate(t, templateKey, { name });
      const title =
        kind === 'appointmentReminder'
          ? t('patients.whatsapp.templateNames.appointmentReminder')
          : t('patients.whatsapp.templateNames.followUp');
      return sendPatientNotification(token, user.tenantId, {
        patientId: patient.id,
        channel: 'whatsapp',
        title,
        body,
        branchId: user.branchId,
      });
    },
    onSuccess: () => {
      setError(null);
      setSuccess(t('patients.reminders.sent'));
    },
    onError: (err) => {
      setSuccess(null);
      setError(err instanceof Error ? err.message : t('patients.error.generic'));
    },
  });

  function openManualWhatsApp(kind: 'appointmentReminder' | 'followUp') {
    if (!patient.phone) return;
    const templateKey =
      kind === 'appointmentReminder'
        ? 'patients.whatsapp.templates.appointmentReminder'
        : 'patients.whatsapp.templates.followUp';
    const message = renderWhatsAppTemplate(t, templateKey, { name });
    window.open(buildWhatsAppUrl(patient.phone, message), '_blank', 'noopener,noreferrer');
  }

  return (
    <section className={styles.panel} aria-labelledby="patient-reminders-heading">
      <h3 id="patient-reminders-heading" className={styles.title}>
        {t('patients.reminders.title')}
      </h3>
      <p className={styles.intro}>{t('patients.reminders.intro')}</p>

      {!patient.phone && <AuthAlert variant="warning">{t('patients.comm.noContact')}</AuthAlert>}
      {!whatsappEnabled && (
        <AuthAlert variant="warning">{t('patients.whatsapp.optedOut')}</AuthAlert>
      )}

      {success && <AuthAlert variant="success">{success}</AuthAlert>}
      {error && <AuthAlert variant="error">{error}</AuthAlert>}

      <div className={styles.actions}>
        <AuthButton
          variant="secondary"
          disabled={
            !canCreateNotification ||
            !patient.phone ||
            !whatsappEnabled ||
            !appointmentReminders
          }
          loading={sendMutation.isPending}
          onClick={() => void sendMutation.mutateAsync('appointmentReminder')}
        >
          <Calendar size={16} aria-hidden />
          {t('patients.reminders.sendAppointment')}
        </AuthButton>
        <AuthButton
          variant="secondary"
          disabled={
            !canCreateNotification || !patient.phone || !whatsappEnabled || !followUpReminders
          }
          loading={sendMutation.isPending}
          onClick={() => void sendMutation.mutateAsync('followUp')}
        >
          <HeartPulse size={16} aria-hidden />
          {t('patients.reminders.sendFollowUp')}
        </AuthButton>
        <AuthButton
          variant="ghost"
          disabled={!patient.phone}
          onClick={() => openManualWhatsApp('appointmentReminder')}
        >
          <Bell size={16} aria-hidden />
          {t('patients.reminders.openWhatsapp')}
        </AuthButton>
      </div>

      <p className={styles.note}>{t('patients.whatsapp.automationNote')}</p>
    </section>
  );
}
