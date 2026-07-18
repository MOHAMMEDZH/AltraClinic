import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import fieldStyles from '@/features/auth/components/AuthFormField.module.css';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { usePatientsList } from '@/features/patients/hooks/usePatients';
import { patientFullName } from '@/features/patients/lib/patient-format';
import type { AppointmentListItem, SchedulingResource } from '../types/scheduling.types';
import {
  DEFAULT_APPOINTMENT_DURATION_MIN,
  SERVICE_TYPE_OPTIONS,
  combineDateAndTime,
  defaultDurationForServiceType,
  toDateInputValue,
} from '../config/scheduling-config';
import { useAvailability, useResourceAvailability, useServiceTypes } from '../hooks/useScheduling';
import styles from './AppointmentForm.module.css';

export interface AppointmentFormValues {
  patientId: string;
  providerId: string;
  date: string;
  startTime: string;
  durationMin: number;
  notes: string;
  serviceType: string;
  isEmergency: boolean;
  recurrenceEnabled: boolean;
  recurrenceFrequency: 'weekly' | 'biweekly' | 'monthly';
  recurrenceOccurrences: number;
  resourceId: string;
}

interface AppointmentFormProps {
  mode: 'create' | 'edit' | 'reschedule';
  providerId: string;
  providerOptions?: Array<{ id: string; label: string }>;
  resources?: SchedulingResource[];
  formPreset?: Partial<AppointmentFormValues> | null;
  initial?: AppointmentListItem | null;
  defaultPatientId?: string;
  lockPatient?: { id: string; name: string };
  submitting?: boolean;
  error?: string | null;
  onSubmit: (values: AppointmentFormValues) => void;
  onCancel: () => void;
}

function defaultValues(
  initial?: AppointmentListItem | null,
  defaultPatientId?: string,
  defaultProviderId?: string,
): AppointmentFormValues {
  if (initial) {
    const start = new Date(initial.start);
    const end = new Date(initial.end);
    const durationMin = Math.round((end.getTime() - start.getTime()) / 60_000);
    return {
      patientId: initial.patientId,
      providerId: initial.providerId,
      date: toDateInputValue(start),
      startTime: `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`,
      durationMin: durationMin || DEFAULT_APPOINTMENT_DURATION_MIN,
      notes: initial.notes ?? '',
      serviceType: initial.serviceType ?? 'consultation',
      isEmergency: initial.isEmergency ?? false,
      recurrenceEnabled: false,
      recurrenceFrequency: 'weekly',
      recurrenceOccurrences: 4,
      resourceId: initial.resourceId ?? '',
    };
  }
  const now = new Date();
  now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15, 0, 0);
  return {
    patientId: defaultPatientId ?? '',
    providerId: defaultProviderId ?? '',
    date: toDateInputValue(now),
    startTime: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    durationMin: DEFAULT_APPOINTMENT_DURATION_MIN,
    notes: '',
    serviceType: 'consultation',
    isEmergency: false,
    recurrenceEnabled: false,
    recurrenceFrequency: 'weekly',
    recurrenceOccurrences: 4,
    resourceId: '',
  };
}

export function AppointmentForm({
  mode,
  providerId,
  providerOptions = [],
  resources = [],
  formPreset,
  initial,
  defaultPatientId,
  lockPatient,
  submitting,
  error,
  onSubmit,
  onCancel,
}: AppointmentFormProps) {
  const { t, locale } = useI18n();
  const [values, setValues] = useState(() =>
    defaultValues(initial, lockPatient?.id ?? defaultPatientId, providerId),
  );
  const [patientSearch, setPatientSearch] = useState('');

  useEffect(() => {
    setValues(defaultValues(initial, lockPatient?.id ?? defaultPatientId, providerId));
  }, [initial, defaultPatientId, lockPatient?.id, providerId]);

  useEffect(() => {
    if (!formPreset) return;
    setValues((v) => ({ ...v, ...formPreset }));
  }, [formPreset]);

  const patientsQuery = usePatientsList({
    q: patientSearch || undefined,
    status: 'active',
    limit: 15,
    offset: 0,
  });

  const serviceTypesQuery = useServiceTypes();

  const serviceTypeOptions = useMemo(() => {
    const fromApi = serviceTypesQuery.data?.items ?? [];
    if (fromApi.length > 0) {
      return fromApi.map((st) => ({
        id: st.id,
        labelKey: `scheduling.serviceType.${st.id}` as const,
        durationMin: st.defaultDurationMin,
      }));
    }
    return SERVICE_TYPE_OPTIONS;
  }, [serviceTypesQuery.data?.items]);

  const availabilityQuery = useAvailability(
    {
      providerId: values.providerId || providerId,
      date: values.date,
      durationMin: values.durationMin,
    },
    (mode === 'create' || mode === 'reschedule') && Boolean(values.providerId || providerId),
  );

  const resourceAvailabilityQuery = useResourceAvailability(
    {
      resourceId: values.resourceId,
      date: values.date,
      durationMin: values.durationMin,
    },
    Boolean(values.resourceId) && (mode === 'create' || mode === 'reschedule'),
  );

  const timeFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }),
    [locale],
  );

  const patientOptions = useMemo(() => {
    return (patientsQuery.data?.items ?? []).map((p) => ({
      id: p.id,
      label: patientFullName(p, locale),
    }));
  }, [patientsQuery.data?.items, locale]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!values.patientId) return;
    onSubmit(values);
  }

  const readOnlyPatient = mode !== 'create' || Boolean(lockPatient);

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {error && <AuthAlert variant="error">{error}</AuthAlert>}

      {readOnlyPatient ? (
        <AuthFormField
          id="appt-patient"
          label={t('scheduling.form.patient')}
          value={lockPatient?.name ?? initial?.patientName ?? values.patientId}
          readOnly
          disabled
        />
      ) : (
        <>
          <AuthFormField
            id="appt-patient-search"
            label={t('scheduling.form.patient')}
            type="search"
            placeholder={t('scheduling.form.patientPlaceholder')}
            value={patientSearch}
            onChange={(e) => setPatientSearch(e.target.value)}
            autoComplete="off"
          />
          <label className={fieldStyles.field}>
            <span className={fieldStyles.label}>{t('scheduling.form.selectPatient')}</span>
            <select
              id="appt-patient"
              className={[fieldStyles.input, styles.input].join(' ')}
              value={values.patientId}
              onChange={(e) => setValues((v) => ({ ...v, patientId: e.target.value }))}
              required
            >
              <option value="">{t('scheduling.form.selectPatient')}</option>
              {patientOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {(mode === 'create' || mode === 'edit') && providerOptions.length > 0 && (
        <label className={fieldStyles.field}>
          <span className={fieldStyles.label}>{t('scheduling.form.provider')}</span>
          <select
            id="appt-provider"
            className={[fieldStyles.input, styles.input].join(' ')}
            value={values.providerId}
            onChange={(e) => setValues((v) => ({ ...v, providerId: e.target.value }))}
            required
          >
            {providerOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className={styles.row}>
        <AuthFormField
          id="appt-date"
          label={t('scheduling.form.date')}
          type="date"
          value={values.date}
          onChange={(e) => setValues((v) => ({ ...v, date: e.target.value }))}
          required
        />
        <AuthFormField
          id="appt-time"
          label={t('scheduling.form.startTime')}
          type="time"
          value={values.startTime}
          onChange={(e) => setValues((v) => ({ ...v, startTime: e.target.value }))}
          required
        />
      </div>

      {(mode === 'create' || mode === 'edit') && (
        <>
          <label className={fieldStyles.field}>
            <span className={fieldStyles.label}>{t('scheduling.form.serviceType')}</span>
            <select
              id="appt-service-type"
              className={[fieldStyles.input, styles.input].join(' ')}
              value={values.serviceType}
              onChange={(e) => {
                const serviceType = e.target.value;
                setValues((v) => ({
                  ...v,
                  serviceType,
                  durationMin: defaultDurationForServiceType(serviceType),
                  isEmergency: serviceType === 'emergency' ? true : v.isEmergency,
                }));
              }}
            >
              {serviceTypeOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
          </label>
          <label className={fieldStyles.field}>
            <span className={fieldStyles.label}>
              <input
                type="checkbox"
                checked={values.isEmergency}
                onChange={(e) => setValues((v) => ({ ...v, isEmergency: e.target.checked }))}
              />{' '}
              {t('scheduling.form.emergency')}
            </span>
          </label>
          {mode === 'create' && (
            <>
              <label className={fieldStyles.field}>
                <span className={fieldStyles.label}>
                  <input
                    type="checkbox"
                    checked={values.recurrenceEnabled}
                    onChange={(e) => setValues((v) => ({ ...v, recurrenceEnabled: e.target.checked }))}
                  />{' '}
                  {t('scheduling.recurrence.enable')}
                </span>
              </label>
              {values.recurrenceEnabled && (
                <div className={styles.row}>
                  <label className={fieldStyles.field}>
                    <span className={fieldStyles.label}>{t('scheduling.recurrence.frequency')}</span>
                    <select
                      className={fieldStyles.input}
                      value={values.recurrenceFrequency}
                      onChange={(e) =>
                        setValues((v) => ({
                          ...v,
                          recurrenceFrequency: e.target.value as AppointmentFormValues['recurrenceFrequency'],
                        }))
                      }
                    >
                      <option value="weekly">{t('scheduling.recurrence.weekly')}</option>
                      <option value="biweekly">{t('scheduling.recurrence.biweekly')}</option>
                      <option value="monthly">{t('scheduling.recurrence.monthly')}</option>
                    </select>
                  </label>
                  <AuthFormField
                    id="appt-recurrence-count"
                    label={t('scheduling.recurrence.occurrences')}
                    type="number"
                    min={2}
                    max={52}
                    value={values.recurrenceOccurrences}
                    onChange={(e) =>
                      setValues((v) => ({
                        ...v,
                        recurrenceOccurrences: Number(e.target.value) || 2,
                      }))
                    }
                  />
                </div>
              )}
            </>
          )}
          {resources.length > 0 && (
            <label className={fieldStyles.field}>
              <span className={fieldStyles.label}>{t('scheduling.form.resource')}</span>
              <select
                id="appt-resource"
                className={[fieldStyles.input, styles.input].join(' ')}
                value={values.resourceId}
                onChange={(e) => setValues((v) => ({ ...v, resourceId: e.target.value }))}
              >
                <option value="">{t('scheduling.form.noResource')}</option>
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </>
      )}

      {(mode === 'create' || mode === 'reschedule') && (
        <div className={styles.slots}>
          <p className={styles.slotsTitle}>{t('scheduling.availability.title')}</p>
          {availabilityQuery.isLoading ? (
            <p className={styles.slotsHint}>{t('scheduling.availability.loading')}</p>
          ) : (availabilityQuery.data?.slots.length ?? 0) === 0 ? (
            <p className={styles.slotsHint}>{t('scheduling.availability.empty')}</p>
          ) : (
            <div className={styles.slotGrid} role="group" aria-label={t('scheduling.availability.pick')}>
              {availabilityQuery.data?.slots.slice(0, 12).map((slot) => {
                const start = new Date(slot.start);
                const time = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
                return (
                  <button
                    key={slot.start}
                    type="button"
                    className={[
                      styles.slotBtn,
                      values.startTime === time ? styles.slotBtnActive : '',
                    ].join(' ')}
                    onClick={() => setValues((v) => ({ ...v, startTime: time }))}
                  >
                    {timeFmt.format(start)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {values.resourceId && (mode === 'create' || mode === 'reschedule') && (
        <div className={styles.slots}>
          <p className={styles.slotsTitle}>{t('scheduling.resourceAvailability.title')}</p>
          {resourceAvailabilityQuery.isLoading ? (
            <p className={styles.slotsHint}>{t('scheduling.availability.loading')}</p>
          ) : (resourceAvailabilityQuery.data?.slots.length ?? 0) === 0 ? (
            <p className={styles.slotsHint}>{t('scheduling.resourceAvailability.empty')}</p>
          ) : (
            <div className={styles.slotGrid} role="group" aria-label={t('scheduling.resourceAvailability.pick')}>
              {resourceAvailabilityQuery.data?.slots.slice(0, 12).map((slot) => {
                const start = new Date(slot.start);
                const time = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
                return (
                  <button
                    key={slot.start}
                    type="button"
                    className={[
                      styles.slotBtn,
                      values.startTime === time ? styles.slotBtnActive : '',
                    ].join(' ')}
                    onClick={() => setValues((v) => ({ ...v, startTime: time }))}
                  >
                    {timeFmt.format(start)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {mode !== 'reschedule' && (
        <AuthFormField
          id="appt-duration"
          label={t('scheduling.form.duration')}
          type="number"
          min={5}
          max={480}
          step={5}
          value={values.durationMin}
          onChange={(e) =>
            setValues((v) => ({ ...v, durationMin: Number(e.target.value) || 30 }))
          }
          required
        />
      )}

      {mode !== 'reschedule' && (
        <label className={fieldStyles.field}>
          <span className={fieldStyles.label}>{t('scheduling.form.notes')}</span>
          <textarea
            id="appt-notes"
            className={styles.textarea}
            rows={3}
            placeholder={t('scheduling.form.notesPlaceholder')}
            value={values.notes}
            onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
          />
        </label>
      )}

      <div className={styles.actions}>
        <AuthButton type="button" variant="secondary" onClick={onCancel}>
          {t('scheduling.actions.close')}
        </AuthButton>
        <AuthButton type="submit" disabled={submitting || !values.patientId}>
          {submitting
            ? mode === 'create'
              ? t('scheduling.actions.creating')
              : t('scheduling.actions.saving')
            : t('scheduling.actions.save')}
        </AuthButton>
      </div>
    </form>
  );
}

export function formValuesToPayload(
  values: AppointmentFormValues,
  fallbackProviderId: string,
) {
  const start = combineDateAndTime(values.date, values.startTime);
  const endDate = new Date(start);
  endDate.setMinutes(endDate.getMinutes() + values.durationMin);
  return {
    patientId: values.patientId,
    providerId: values.providerId || fallbackProviderId,
    start,
    end: endDate.toISOString(),
    notes: values.notes.trim() || undefined,
    serviceType: values.serviceType || undefined,
    isEmergency: values.isEmergency || undefined,
    resourceId: values.resourceId || undefined,
    recurrence: values.recurrenceEnabled
      ? {
          frequency: values.recurrenceFrequency,
          occurrences: values.recurrenceOccurrences,
        }
      : undefined,
  };
}
