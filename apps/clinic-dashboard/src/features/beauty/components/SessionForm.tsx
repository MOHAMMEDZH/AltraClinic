import { useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { TREATMENT_TYPES } from '../config/beauty-config';
import { createBeautyId, defaultSession, validateSession } from '../config/beauty-form-utils';
import type { BeautyMeasurement, BeautySession, BeautyTreatmentPlan } from '../types/beauty.types';
import styles from './SessionForm.module.css';

export type SessionFormMode = 'schedule' | 'complete';

interface SessionFormProps {
  mode: SessionFormMode;
  clinicianId: string;
  plans: BeautyTreatmentPlan[];
  initial?: BeautySession;
  readOnly?: boolean;
  onSave: (session: BeautySession, extras?: { measurement?: BeautyMeasurement; followUp?: BeautySession }) => void;
  onCancel?: () => void;
}

export function SessionForm({ mode, clinicianId, plans, initial, readOnly, onSave, onCancel }: SessionFormProps) {
  const { t } = useI18n();
  const [form, setForm] = useState<BeautySession>(initial ?? defaultSession(clinicianId));
  const [outcome, setOutcome] = useState(initial?.outcome ?? '');
  const [productName, setProductName] = useState('');
  const [productUnits, setProductUnits] = useState('');
  const [productVolumeCc, setProductVolumeCc] = useState('');
  const [productLot, setProductLot] = useState('');
  const [laserFluence, setLaserFluence] = useState(initial?.laserSettings?.fluence?.toString() ?? '');
  const [laserJoules, setLaserJoules] = useState(initial?.laserSettings?.joules?.toString() ?? '');
  const [measurementValue, setMeasurementValue] = useState('');
  const [measurementLabel, setMeasurementLabel] = useState('');
  const [scheduleFollowUp, setScheduleFollowUp] = useState(false);
  const [followUpDays, setFollowUpDays] = useState(14);
  const [comparisonGroupId, setComparisonGroupId] = useState(initial?.comparisonGroupId ?? '');
  const [errorKey, setErrorKey] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const completing = mode === 'complete';
    const next: BeautySession = {
      ...form,
      outcome: completing ? outcome : form.outcome,
      status: completing ? 'completed' : form.status,
      completedAt: completing ? new Date().toISOString() : form.completedAt,
      comparisonGroupId: comparisonGroupId || form.comparisonGroupId,
      products:
        productName.trim() && completing
          ? [{
              name: productName,
              units: productUnits ? Number(productUnits) : undefined,
              volumeCc: productVolumeCc ? Number(productVolumeCc) : undefined,
              lot: productLot || undefined,
            }]
          : form.products,
      laserSettings:
        completing && form.type === 'laser' && (laserFluence || laserJoules)
          ? {
              fluence: laserFluence ? Number(laserFluence) : undefined,
              joules: laserJoules ? Number(laserJoules) : undefined,
            }
          : form.laserSettings,
    };
    const err = validateSession(next, completing);
    if (err) {
      setErrorKey(err);
      return;
    }

    let measurement: BeautyMeasurement | undefined;
    if (completing && measurementLabel && measurementValue) {
      measurement = {
        id: createBeautyId('measure'),
        type: 'custom',
        label: measurementLabel,
        value: Number(measurementValue),
        unit: 'mm',
        recordedAt: new Date().toISOString(),
      };
      next.measurementIds = [...(next.measurementIds ?? []), measurement.id];
    }

    let followUp: BeautySession | undefined;
    if (completing && scheduleFollowUp) {
      const at = new Date();
      at.setDate(at.getDate() + followUpDays);
      followUp = {
        ...defaultSession(clinicianId, plans.find((p) => p.id === form.planId)),
        planId: form.planId,
        type: form.type,
        status: 'scheduled',
        scheduledAt: at.toISOString(),
        notes: t('beauty.forms.followUpFromSession'),
      };
      next.followUpAt = at.toISOString();
    }

    onSave(next, { measurement, followUp });
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {errorKey && (
        <p className={styles.error} role="alert">
          {t(`beauty.forms.errors.${errorKey}`)}
        </p>
      )}

      <div className={styles.row}>
        <label className={styles.field}>
          <span>{t('beauty.forms.linkedPlan')}</span>
          <select
            value={form.planId ?? ''}
            disabled={readOnly}
            onChange={(e) => setForm((f) => ({ ...f, planId: e.target.value || undefined }))}
          >
            <option value="">—</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>{t('beauty.faceMap.treatment')}</span>
          <select
            value={form.type}
            disabled={readOnly}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
          >
            {TREATMENT_TYPES.map((tr) => (
              <option key={tr} value={tr}>
                {t(`beauty.treatments.${tr}`)}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>{t('beauty.forms.scheduledAt')}</span>
          <input
            type="datetime-local"
            disabled={readOnly || mode === 'complete'}
            value={form.scheduledAt.slice(0, 16)}
            onChange={(e) => setForm((f) => ({ ...f, scheduledAt: new Date(e.target.value).toISOString() }))}
          />
        </label>
      </div>

      <label className={styles.field}>
        <span>{t('beauty.sessions.outcome')}</span>
        <textarea
          rows={3}
          disabled={readOnly}
          value={mode === 'complete' ? outcome : (form.notes ?? '')}
          onChange={(e) => (mode === 'complete' ? setOutcome(e.target.value) : setForm((f) => ({ ...f, notes: e.target.value })))}
          placeholder={mode === 'complete' ? t('beauty.forms.outcomePlaceholder') : t('beauty.forms.notesPlaceholder')}
        />
      </label>

      {mode === 'complete' && (
        <>
          {(form.type === 'botox' || form.type === 'filler') && (
            <div className={styles.row}>
              <label className={styles.field}>
                <span>{t('beauty.injectables.product')}</span>
                <input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder={t('beauty.forms.productPlaceholder')} />
              </label>
              <label className={styles.field}>
                <span>{t('beauty.injectables.units')}</span>
                <input value={productUnits} onChange={(e) => setProductUnits(e.target.value)} inputMode="numeric" />
              </label>
              <label className={styles.field}>
                <span>{t('beauty.injectables.volumeCc')}</span>
                <input value={productVolumeCc} onChange={(e) => setProductVolumeCc(e.target.value)} inputMode="decimal" />
              </label>
              <label className={styles.field}>
                <span>{t('beauty.injectables.lot')}</span>
                <input value={productLot} onChange={(e) => setProductLot(e.target.value)} />
              </label>
            </div>
          )}
          {form.type === 'laser' && (
            <div className={styles.row}>
              <label className={styles.field}>
                <span>{t('beauty.laser.fluence')}</span>
                <input value={laserFluence} onChange={(e) => setLaserFluence(e.target.value)} inputMode="decimal" />
              </label>
              <label className={styles.field}>
                <span>{t('beauty.laser.joules')}</span>
                <input value={laserJoules} onChange={(e) => setLaserJoules(e.target.value)} inputMode="decimal" />
              </label>
            </div>
          )}
          {form.type !== 'botox' && form.type !== 'filler' && form.type !== 'laser' && (
            <div className={styles.row}>
              <label className={styles.field}>
                <span>{t('beauty.forms.productUsed')}</span>
                <input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder={t('beauty.forms.productPlaceholder')} />
              </label>
              <label className={styles.field}>
                <span>{t('beauty.forms.units')}</span>
                <input value={productUnits} onChange={(e) => setProductUnits(e.target.value)} inputMode="numeric" />
              </label>
            </div>
          )}
          <div className={styles.row}>
            <label className={styles.field}>
              <span>{t('beauty.forms.measurementLabel')}</span>
              <input value={measurementLabel} onChange={(e) => setMeasurementLabel(e.target.value)} />
            </label>
            <label className={styles.field}>
              <span>{t('beauty.forms.measurementValue')}</span>
              <input value={measurementValue} onChange={(e) => setMeasurementValue(e.target.value)} inputMode="decimal" />
            </label>
          </div>
          <label className={styles.field}>
            <span>{t('beauty.forms.comparisonGroup')}</span>
            <input
              value={comparisonGroupId}
              onChange={(e) => setComparisonGroupId(e.target.value)}
              placeholder={t('beauty.forms.comparisonGroupHint')}
            />
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={scheduleFollowUp} onChange={(e) => setScheduleFollowUp(e.target.checked)} />
            {t('beauty.forms.scheduleFollowUp')}
          </label>
          {scheduleFollowUp && (
            <label className={styles.field}>
              <span>{t('beauty.forms.followUpDays')}</span>
              <input type="number" min={1} value={followUpDays} onChange={(e) => setFollowUpDays(Number(e.target.value) || 14)} />
            </label>
          )}
        </>
      )}

      {!readOnly && (
        <div className={styles.actions}>
          {onCancel && (
            <AuthButton type="button" variant="ghost" onClick={onCancel}>
              {t('beauty.cancel')}
            </AuthButton>
          )}
          <AuthButton type="submit">
            {mode === 'complete' ? t('beauty.forms.completeSession') : t('beauty.sessions.add')}
          </AuthButton>
        </div>
      )}
    </form>
  );
}
