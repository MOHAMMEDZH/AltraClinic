import { useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { formatEncounterDate } from '../config/emr-config';
import { useCreateLabResult, useLabResults } from '../hooks/useEmr';
import styles from './LabResultsPanel.module.css';

interface LabResultsPanelProps {
  patientId: string;
  encounterId?: string;
  canEdit?: boolean;
}

export function LabResultsPanel({ patientId, encounterId, canEdit }: LabResultsPanelProps) {
  const { t, locale } = useI18n();
  const query = useLabResults(patientId, encounterId);
  const createMutation = useCreateLabResult(patientId);
  const [testName, setTestName] = useState('');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('');
  const [referenceRange, setReferenceRange] = useState('');
  const [status, setStatus] = useState('normal');

  async function handleAdd() {
    if (!testName.trim() || !value.trim()) return;
    await createMutation.mutateAsync({
      encounterId,
      testName: testName.trim(),
      value: value.trim(),
      unit: unit.trim() || undefined,
      referenceRange: referenceRange.trim() || undefined,
      status,
      resultedAt: new Date().toISOString(),
    });
    setTestName('');
    setValue('');
    setUnit('');
    setReferenceRange('');
  }

  const rows = query.data ?? [];

  return (
    <section className={styles.panel} aria-label={t('emr.labs.title')}>
      {canEdit && (
        <div className={styles.form}>
          <AuthFormField id="lab-test" label={t('emr.labs.testName')} value={testName} onChange={(e) => setTestName(e.target.value)} />
          <div className={styles.row}>
            <AuthFormField id="lab-value" label={t('emr.labs.value')} value={value} onChange={(e) => setValue(e.target.value)} />
            <AuthFormField id="lab-unit" label={t('emr.labs.unit')} value={unit} onChange={(e) => setUnit(e.target.value)} />
          </div>
          <AuthFormField id="lab-range" label={t('emr.labs.referenceRange')} value={referenceRange} onChange={(e) => setReferenceRange(e.target.value)} />
          <label className={styles.label} htmlFor="lab-status">{t('emr.labs.status')}</label>
          <select id="lab-status" className={styles.select} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="normal">{t('emr.labs.normal')}</option>
            <option value="abnormal">{t('emr.labs.abnormal')}</option>
            <option value="critical">{t('emr.labs.critical')}</option>
          </select>
          <AuthButton loading={createMutation.isPending} onClick={() => void handleAdd()}>
            {t('emr.labs.add')}
          </AuthButton>
        </div>
      )}
      {query.isLoading ? (
        <p className={styles.muted}>{t('emr.audit.loading')}</p>
      ) : rows.length === 0 ? (
        <p className={styles.muted}>{t('emr.labs.empty')}</p>
      ) : (
        <table className={styles.table}>
          <caption className="sr-only">{t('emr.labs.title')}</caption>
          <thead>
            <tr>
              <th>{t('emr.labs.testName')}</th>
              <th>{t('emr.labs.value')}</th>
              <th>{t('emr.labs.status')}</th>
              <th>{t('emr.labs.when')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.status ? styles[`status_${r.status}`] : undefined}>
                <td>{r.testName}</td>
                <td>{r.value}{r.unit ? ` ${r.unit}` : ''}{r.referenceRange ? ` (${r.referenceRange})` : ''}</td>
                <td>{r.status ?? '—'}</td>
                <td>{formatEncounterDate(r.resultedAt, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
