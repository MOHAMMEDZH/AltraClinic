import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { usePatientsList } from '@/features/patients/hooks/usePatients';
import { patientFullName } from '@/features/patients/lib/patient-format';
import type { CreateEncounterPayload, DiagnosisRecord, ObservationRecord } from '../types/emr.types';
import { FAVORITE_DIAGNOSES, FAVORITE_MEDICATIONS, VITAL_TYPES } from '../config/emr-config';
import styles from './EncounterForm.module.css';

export interface EncounterFormValues {
  patientId: string;
  chiefComplaint: string;
  clinicalNotes: string;
  followUpDate: string;
  diagnoses: DiagnosisRecord[];
  medications: { name: string; dose: string; route: string; frequency: string }[];
  vitals: Record<string, string>;
}

interface EncounterFormProps {
  clinicianId: string;
  initialPatientId?: string;
  submitLabel: string;
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (payload: CreateEncounterPayload) => Promise<void>;
}

const emptyValues = (patientId = ''): EncounterFormValues => ({
  patientId,
  chiefComplaint: '',
  clinicalNotes: '',
  followUpDate: '',
  diagnoses: [],
  medications: [],
  vitals: {},
});

export function EncounterForm({
  clinicianId,
  initialPatientId,
  submitLabel,
  loading,
  onCancel,
  onSubmit,
}: EncounterFormProps) {
  const { t, locale } = useI18n();
  const [values, setValues] = useState(() => emptyValues(initialPatientId));
  const [patientSearch, setPatientSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const patientsQuery = usePatientsList({ q: patientSearch || undefined, limit: 8, offset: 0 });

  useEffect(() => {
    if (initialPatientId) {
      setValues((v) => ({ ...v, patientId: initialPatientId }));
    }
  }, [initialPatientId]);

  const selectedPatient = useMemo(
    () => patientsQuery.data?.items.find((p) => p.id === values.patientId),
    [patientsQuery.data?.items, values.patientId],
  );

  function addDiagnosis(dx: DiagnosisRecord) {
    setValues((v) => ({
      ...v,
      diagnoses: v.diagnoses.some((d) => d.code === dx.code) ? v.diagnoses : [...v.diagnoses, dx],
    }));
  }

  function addMedication(med: (typeof FAVORITE_MEDICATIONS)[number]) {
    setValues((v) => ({
      ...v,
      medications: [...v.medications, { ...med }],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.patientId) {
      setError(t('emr.form.patientRequired'));
      return;
    }
    setError(null);
    const observations: ObservationRecord[] = VITAL_TYPES.flatMap(({ type, unit }) => {
      const value = values.vitals[type]?.trim();
      return value ? [{ type, value, unit: unit || undefined }] : [];
    });
    await onSubmit({
      patientId: values.patientId,
      clinicianId,
      chiefComplaint: values.chiefComplaint.trim() || undefined,
      clinicalNotes: values.clinicalNotes.trim() || undefined,
      followUpDate: values.followUpDate || undefined,
      diagnoses: values.diagnoses,
      medications: values.medications.filter((m) => m.name.trim()),
      observations,
    });
  }

  return (
    <form className={styles.form} onSubmit={(e) => void handleSubmit(e)} noValidate>
      {error && <p className={styles.error} role="alert">{error}</p>}

      {!initialPatientId && (
        <div className={styles.fieldGroup}>
          <AuthFormField
            id="enc-patient-search"
            label={t('emr.form.patient')}
            value={patientSearch}
            onChange={(e) => setPatientSearch(e.target.value)}
            placeholder={t('emr.form.patientPlaceholder')}
            autoComplete="off"
          />
          {patientsQuery.data?.items.length ? (
            <ul className={styles.patientList} role="listbox" aria-label={t('emr.form.patient')}>
              {patientsQuery.data.items.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={values.patientId === p.id}
                    className={values.patientId === p.id ? styles.patientSelected : styles.patientOption}
                    onClick={() => {
                      setValues((v) => ({ ...v, patientId: p.id }));
                      setPatientSearch(patientFullName(p, locale));
                    }}
                  >
                    {patientFullName(p, locale)}
                    {p.phone && <span dir="ltr" className={styles.patientPhone}>{p.phone}</span>}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {selectedPatient && (
            <p className={styles.selectedHint}>{patientFullName(selectedPatient, locale)}</p>
          )}
        </div>
      )}

      <AuthFormField
        id="enc-complaint"
        label={t('emr.detail.chiefComplaint')}
        value={values.chiefComplaint}
        onChange={(e) => setValues((v) => ({ ...v, chiefComplaint: e.target.value }))}
        placeholder={t('emr.form.complaintPlaceholder')}
      />

      <div className={styles.notesField}>
        <label className={styles.notesLabel} htmlFor="enc-notes">
          {t('emr.detail.clinicalNotes')}
        </label>
        <textarea
          id="enc-notes"
          className={styles.notesInput}
          rows={4}
          value={values.clinicalNotes}
          onChange={(e) => setValues((v) => ({ ...v, clinicalNotes: e.target.value }))}
          placeholder={t('emr.form.notesPlaceholder')}
        />
        <p className={styles.notesHint}>{t('emr.detail.soapHint')}</p>
      </div>

      <AuthFormField
        id="enc-followup"
        label={t('emr.detail.followUpDate')}
        type="date"
        value={values.followUpDate}
        onChange={(e) => setValues((v) => ({ ...v, followUpDate: e.target.value }))}
      />

      <fieldset className={styles.fieldset}>
        <legend>{t('emr.detail.favoriteDiagnoses')}</legend>
        <div className={styles.chips}>
          {FAVORITE_DIAGNOSES.map((dx) => (
            <button key={dx.code} type="button" className={styles.chip} onClick={() => addDiagnosis(dx)}>
              {dx.code} · {dx.description}
            </button>
          ))}
        </div>
        {values.diagnoses.length > 0 && (
          <ul className={styles.tagList}>
            {values.diagnoses.map((dx) => (
              <li key={dx.code} className={styles.tag}>
                {dx.code} — {dx.description}
                <button
                  type="button"
                  aria-label={t('emr.detail.remove')}
                  onClick={() => setValues((v) => ({ ...v, diagnoses: v.diagnoses.filter((d) => d.code !== dx.code) }))}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>{t('emr.detail.favoriteMedications')}</legend>
        <div className={styles.chips}>
          {FAVORITE_MEDICATIONS.map((med) => (
            <button key={med.name} type="button" className={styles.chip} onClick={() => addMedication(med)}>
              {med.name}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>{t('emr.vitals.title')}</legend>
        <div className={styles.vitalsGrid}>
          {VITAL_TYPES.slice(0, 4).map(({ type, labelKey, unit, placeholder }) => (
            <AuthFormField
              key={type}
              id={`enc-vital-${type}`}
              label={t(labelKey)}
              value={values.vitals[type] ?? ''}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  vitals: { ...v.vitals, [type]: e.target.value },
                }))
              }
              placeholder={placeholder}
              helpText={unit || undefined}
            />
          ))}
        </div>
      </fieldset>

      <div className={styles.actions}>
        <AuthButton type="button" variant="ghost" onClick={onCancel}>
          {t('emr.form.cancel')}
        </AuthButton>
        <AuthButton type="submit" loading={loading}>
          {submitLabel}
        </AuthButton>
      </div>
    </form>
  );
}
