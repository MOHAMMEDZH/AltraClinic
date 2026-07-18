import { useMemo, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import type { PatientDetail } from '../types';
import {
  buildWhatsAppUrl,
  canContactViaWhatsApp,
  type WhatsAppTemplateId,
} from '../lib/whatsapp-message';
import { patientFullName } from '../lib/patient-format';
import styles from './PatientWhatsAppDialog.module.css';

interface PatientWhatsAppDialogProps {
  patient: Pick<
    PatientDetail,
    'firstName' | 'lastName' | 'firstNameAr' | 'lastNameAr' | 'phone' | 'profileData'
  >;
}

const TEMPLATE_IDS: WhatsAppTemplateId[] = [
  'appointmentReminder',
  'followUp',
  'welcome',
  'custom',
];

export function PatientWhatsAppDialog({ patient }: PatientWhatsAppDialogProps) {
  const { t, locale } = useI18n();
  const [templateId, setTemplateId] = useState<WhatsAppTemplateId>('appointmentReminder');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const profile = patient.profileData ?? {};
  const comm = profile.communication ?? {};
  const name = patientFullName(patient, locale);
  const whatsappAllowed = canContactViaWhatsApp(patient.phone, comm.whatsapp);

  const templateMessage = useMemo(() => {
    switch (templateId) {
      case 'followUp':
        return t('patients.whatsapp.templates.followUp').replace('{name}', name);
      case 'welcome':
        return t('patients.whatsapp.templates.welcome').replace('{name}', name);
      case 'custom':
        return message;
      default:
        return t('patients.whatsapp.templates.appointmentReminder').replace('{name}', name);
    }
  }, [templateId, message, name, t]);

  const outboundMessage = templateId === 'custom' ? message : templateMessage;
  const whatsappUrl =
    patient.phone && outboundMessage.trim()
      ? buildWhatsAppUrl(patient.phone, outboundMessage)
      : patient.phone
        ? buildWhatsAppUrl(patient.phone, '')
        : null;

  async function copyPhone() {
    if (!patient.phone) return;
    try {
      await navigator.clipboard.writeText(patient.phone);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.intro}>{t('patients.whatsapp.dialogIntro')}</p>

      {!patient.phone && (
        <AuthAlert variant="warning">{t('patients.whatsapp.noPhone')}</AuthAlert>
      )}

      {patient.phone && !whatsappAllowed && (
        <AuthAlert variant="warning">{t('patients.whatsapp.optedOut')}</AuthAlert>
      )}

      {patient.phone && (
        <>
          <p className={styles.phone} dir="ltr">
            {patient.phone}
          </p>

          <div className={styles.templates} role="group" aria-label={t('patients.whatsapp.templatesLabel')}>
            {TEMPLATE_IDS.map((id) => (
              <button
                key={id}
                type="button"
                className={[styles.templateBtn, templateId === id ? styles.templateActive : ''].join(' ')}
                onClick={() => setTemplateId(id)}
              >
                {t(`patients.whatsapp.templateNames.${id}`)}
              </button>
            ))}
          </div>

          <label className={styles.messageField}>
            <span className={styles.messageLabel}>{t('patients.whatsapp.messageLabel')}</span>
            <textarea
              className={styles.textarea}
              rows={5}
              value={templateId === 'custom' ? message : templateMessage}
              onChange={(e) => {
                setTemplateId('custom');
                setMessage(e.target.value);
              }}
            />
          </label>

          <div className={styles.actions}>
            {whatsappUrl && whatsappAllowed && (
              <a
                className={styles.primaryBtn}
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
              >
                {t('patients.actions.sendWhatsapp')}
              </a>
            )}
            <AuthButton variant="ghost" onClick={() => void copyPhone()}>
              {copied ? t('patients.comm.copied') : t('patients.comm.copyPhone')}
            </AuthButton>
          </div>
        </>
      )}

      <AuthAlert variant="info">{t('patients.whatsapp.automationNote')}</AuthAlert>
    </div>
  );
}
