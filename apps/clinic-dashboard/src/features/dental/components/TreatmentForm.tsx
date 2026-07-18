import { useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { FAVORITE_PROCEDURES } from '../config/dental-config';
import type { CreateTreatmentPayload } from '../types/dental.types';
import styles from './TreatmentForm.module.css';

interface TreatmentFormProps {
  patientId: string;
  providerId: string;
  selectedTeeth: number[];
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (payload: CreateTreatmentPayload) => Promise<void>;
}

export function TreatmentForm({
  patientId,
  providerId,
  selectedTeeth,
  loading,
  onCancel,
  onSubmit,
}: TreatmentFormProps) {
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [teeth, setTeeth] = useState(selectedTeeth.join(', '));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const toothNumbers = teeth
      .split(/[,\s]+/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n) && n >= 1 && n <= 32);
    await onSubmit({
      patientId,
      providerId,
      procedures: [{ code: code.trim(), description: description.trim(), toothNumbers }],
    });
  }

  return (
    <form className={styles.form} onSubmit={(e) => void handleSubmit(e)}>
      <div className={styles.chips}>
        {FAVORITE_PROCEDURES.map((p) => (
          <button
            key={p.code}
            type="button"
            className={styles.chip}
            onClick={() => {
              setCode(p.code);
              setDescription(p.description);
            }}
          >
            {p.code}
          </button>
        ))}
      </div>
      <AuthFormField id="proc-code" label={t('dental.procedures.code')} value={code} onChange={(e) => setCode(e.target.value)} required />
      <AuthFormField id="proc-desc" label={t('dental.procedures.description')} value={description} onChange={(e) => setDescription(e.target.value)} required />
      <AuthFormField
        id="proc-teeth"
        label={t('dental.procedures.teeth')}
        value={teeth}
        onChange={(e) => setTeeth(e.target.value)}
        helpText="Universal numbers 1–32, comma-separated"
      />
      <div className={styles.actions}>
        <AuthButton type="button" variant="ghost" onClick={onCancel}>{t('dental.form.cancel')}</AuthButton>
        <AuthButton type="submit" loading={loading}>{t('dental.form.record')}</AuthButton>
      </div>
    </form>
  );
}
