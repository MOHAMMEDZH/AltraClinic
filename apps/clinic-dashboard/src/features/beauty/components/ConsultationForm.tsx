import { useMemo, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import {
  BODY_ASSESSMENT_FIELDS,
  defaultConsultation,
  FACIAL_ASSESSMENT_FIELDS,
  SKIN_ASSESSMENT_FIELDS,
  validateConsultation,
} from '../config/beauty-form-utils';
import { SKIN_CONCERNS, TREATMENT_TYPES } from '../config/beauty-config';
import type { BeautyConsultation, BeautyConsent } from '../types/beauty.types';
import styles from './ConsultationForm.module.css';

interface ConsultationFormProps {
  clinicianId: string;
  initial?: BeautyConsultation;
  readOnly?: boolean;
  onSave: (consultation: BeautyConsultation, consents: BeautyConsent[]) => void;
  onCancel?: () => void;
}

export function ConsultationForm({ clinicianId, initial, readOnly, onSave, onCancel }: ConsultationFormProps) {
  const { t } = useI18n();
  const [form, setForm] = useState<BeautyConsultation>(initial ?? defaultConsultation(clinicianId));
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const assessmentSection = useMemo(
    () => [
      { key: 'skin' as const, fields: SKIN_ASSESSMENT_FIELDS, data: form.skinAssessment ?? {} },
      { key: 'facial' as const, fields: FACIAL_ASSESSMENT_FIELDS, data: form.facialAssessment ?? {} },
      { key: 'body' as const, fields: BODY_ASSESSMENT_FIELDS, data: form.bodyAssessment ?? {} },
    ],
    [form],
  );

  function updateAssessment(
    section: 'skinAssessment' | 'facialAssessment' | 'bodyAssessment',
    field: string,
    value: string,
  ) {
    setForm((f) => ({
      ...f,
      [section]: { ...(f[section] ?? {}), [field]: value },
    }));
  }

  function toggleRecommendation(code: string) {
    setForm((f) => {
      const recs = f.recommendations ?? [];
      const next = recs.includes(code) ? recs.filter((r) => r !== code) : [...recs, code];
      return { ...f, recommendations: next };
    });
  }

  function handleSubmit(completed: boolean) {
    const next = { ...form, status: completed ? ('completed' as const) : ('draft' as const) };
    const err = completed ? validateConsultation(next) : null;
    if (err) {
      setErrorKey(err);
      return;
    }
    setErrorKey(null);
    const consents: BeautyConsent[] = [];
    if (next.consentPhoto) {
      consents.push({
        id: `consent_photo_${next.id}`,
        type: 'photo',
        granted: true,
        grantedAt: new Date().toISOString(),
      });
    }
    if (next.consentTreatment) {
      consents.push({
        id: `consent_treatment_${next.id}`,
        type: 'treatment',
        granted: true,
        grantedAt: new Date().toISOString(),
      });
    }
    onSave(next, consents);
  }

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit(true);
      }}
    >
      {errorKey && (
        <p className={styles.error} role="alert">
          {t(`beauty.forms.errors.${errorKey}`)}
        </p>
      )}

      <div className={styles.row}>
        <label className={styles.field}>
          <span>{t('beauty.forms.consultationType')}</span>
          <select
            value={form.type}
            disabled={readOnly}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as BeautyConsultation['type'] }))}
          >
            <option value="initial">{t('beauty.consultation.initial')}</option>
            <option value="follow_up">{t('beauty.consultation.followUp')}</option>
          </select>
        </label>
        <label className={styles.field}>
          <span>{t('beauty.forms.date')}</span>
          <input
            type="datetime-local"
            disabled={readOnly}
            value={form.date.slice(0, 16)}
            onChange={(e) => setForm((f) => ({ ...f, date: new Date(e.target.value).toISOString() }))}
          />
        </label>
      </div>

      {assessmentSection.map(({ key, fields, data }) => (
        <fieldset key={key} className={styles.section} disabled={readOnly}>
          <legend>{t(`beauty.consultation.${key}Assessment`)}</legend>
          <div className={styles.grid}>
            {fields.map((field) => (
              <label key={field} className={styles.field}>
                <span>{t(`beauty.assessment.${key}.${field}`)}</span>
                <input
                  value={data[field] ?? ''}
                  onChange={(e) =>
                    updateAssessment(
                      key === 'skin' ? 'skinAssessment' : key === 'facial' ? 'facialAssessment' : 'bodyAssessment',
                      field,
                      e.target.value,
                    )
                  }
                />
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <fieldset className={styles.section} disabled={readOnly}>
        <legend>{t('beauty.consultation.recommendations')}</legend>
        <div className={styles.chips}>
          {TREATMENT_TYPES.map((tr) => (
            <button
              key={tr}
              type="button"
              className={form.recommendations?.includes(tr) ? styles.chipActive : styles.chip}
              aria-pressed={form.recommendations?.includes(tr)}
              onClick={() => toggleRecommendation(tr)}
            >
              {t(`beauty.treatments.${tr}`)}
            </button>
          ))}
          {SKIN_CONCERNS.slice(0, 4).map((c) => (
            <button
              key={c}
              type="button"
              className={form.recommendations?.includes(c) ? styles.chipActive : styles.chip}
              aria-pressed={form.recommendations?.includes(c)}
              onClick={() => toggleRecommendation(c)}
            >
              {t(`beauty.concerns.${c}`)}
            </button>
          ))}
        </div>
      </fieldset>

      <label className={styles.field}>
        <span>{t('beauty.consultation.notes')}</span>
        <textarea
          rows={4}
          disabled={readOnly}
          value={form.notes ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        />
      </label>

      <div className={styles.consents}>
        <label className={styles.check}>
          <input
            type="checkbox"
            disabled={readOnly}
            checked={Boolean(form.consentPhoto)}
            onChange={(e) => setForm((f) => ({ ...f, consentPhoto: e.target.checked }))}
          />
          {t('beauty.consultation.consentPhoto')}
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            disabled={readOnly}
            checked={Boolean(form.consentTreatment)}
            onChange={(e) => setForm((f) => ({ ...f, consentTreatment: e.target.checked }))}
          />
          {t('beauty.forms.consentTreatment')}
        </label>
      </div>

      {!readOnly && (
        <div className={styles.actions}>
          {onCancel && (
            <AuthButton type="button" variant="ghost" onClick={onCancel}>
              {t('beauty.cancel')}
            </AuthButton>
          )}
          <AuthButton type="button" variant="secondary" onClick={() => handleSubmit(false)}>
            {t('beauty.forms.saveDraft')}
          </AuthButton>
          <AuthButton type="submit">{t('beauty.forms.completeConsultation')}</AuthButton>
        </div>
      )}
    </form>
  );
}
