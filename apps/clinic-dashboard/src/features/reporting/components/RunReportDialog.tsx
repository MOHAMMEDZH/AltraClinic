import { useEffect, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { Modal } from '@/features/patients/components/Modal';
import { AuthButton } from '@/features/auth/components/AuthButton';
import type { ReportTemplate } from '../config/reporting-catalog';
import type { GenerateAnalyticsReportInput } from '../api/reporting-api';
import styles from '../reporting-layout.module.css';

interface RunReportDialogProps {
  open: boolean;
  template: ReportTemplate | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (input: GenerateAnalyticsReportInput) => void;
}

const FORMATS: GenerateAnalyticsReportInput['format'][] = ['pdf', 'excel', 'csv', 'json'];
const SCHEDULES: Array<'daily' | 'weekly' | 'monthly'> = ['daily', 'weekly', 'monthly'];

export function RunReportDialog({ open, template, loading, onClose, onSubmit }: RunReportDialogProps) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [format, setFormat] = useState<GenerateAnalyticsReportInput['format']>('pdf');
  const [schedule, setSchedule] = useState(false);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [emails, setEmails] = useState('');

  useEffect(() => {
    if (!open || !template) return;
    setName('');
    setFormat(template.defaultFormat ?? 'pdf');
    setSchedule(false);
    setFrequency('weekly');
    setEmails('');
  }, [open, template]);

  if (!template) return null;

  const activeTemplate = template;

  function handleSubmit() {
    if (!activeTemplate.analyticsType) return;
    onSubmit({
      name: name.trim() || t(activeTemplate.titleKey as 'reports.home.title'),
      reportType: activeTemplate.analyticsType,
      format,
      description: t(activeTemplate.descriptionKey as 'reports.home.subtitle'),
      isScheduled: schedule,
      scheduleFrequency: schedule ? frequency : undefined,
      recipientEmails: emails
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean),
      parameters: {},
    });
  }

  return (
    <Modal
      open={open}
      title={t('reports.run.title')}
      onClose={onClose}
      closeLabel={t('reports.run.cancel')}
      footer={
        <div className={styles.dialogActions}>
          <AuthButton variant="secondary" onClick={onClose}>{t('reports.run.cancel')}</AuthButton>
          <AuthButton loading={loading} onClick={handleSubmit}>{t('reports.run.generate')}</AuthButton>
        </div>
      }
    >
      <p className={styles.hint}>{t(template.titleKey as 'reports.home.title')}</p>
      <div className={styles.formGrid}>
        <label>
          {t('reports.run.name')}
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t(template.titleKey as 'reports.home.title')} />
        </label>
        <label>
          {t('reports.run.format')}
          <select value={format} onChange={(e) => setFormat(e.target.value as GenerateAnalyticsReportInput['format'])}>
            {(template.supportedFormats ?? FORMATS).map((f) => (
              <option key={f} value={f}>{f.toUpperCase()}</option>
            ))}
          </select>
        </label>
        <label className={styles.checkboxRow}>
          <input type="checkbox" checked={schedule} onChange={(e) => setSchedule(e.target.checked)} />
          {t('reports.run.schedule')}
        </label>
        {schedule && (
          <>
            <label>
              {t('reports.run.frequency')}
              <select value={frequency} onChange={(e) => setFrequency(e.target.value as typeof frequency)}>
                {SCHEDULES.map((f) => (
                  <option key={f} value={f}>{t(`reports.schedule.${f}` as 'reports.schedule.daily')}</option>
                ))}
              </select>
            </label>
            <label>
              {t('reports.run.recipients')}
              <input value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="finance@clinic.com" />
            </label>
          </>
        )}
      </div>
    </Modal>
  );
}
