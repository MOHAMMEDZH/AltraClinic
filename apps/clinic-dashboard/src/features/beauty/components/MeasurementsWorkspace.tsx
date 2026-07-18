import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { createBeautyId } from '../config/beauty-form-utils';
import type { BeautyMeasurement } from '../types/beauty.types';
import { MeasurementsPanel } from './MeasurementsPanel';
import styles from './MeasurementsWorkspace.module.css';

interface MeasurementsWorkspaceProps {
  measurements: BeautyMeasurement[];
  readOnly?: boolean;
  onAdd: (measurement: BeautyMeasurement) => void;
}

const MEASUREMENT_TYPES = ['weight', 'circumference', 'custom'] as const;

export function MeasurementsWorkspace({ measurements, readOnly, onAdd }: MeasurementsWorkspaceProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<(typeof MEASUREMENT_TYPES)[number]>('custom');
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('mm');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = Number(value);
    if (!label.trim() || Number.isNaN(num)) return;
    onAdd({
      id: createBeautyId('measure'),
      type,
      label: label.trim(),
      value: num,
      unit: unit.trim() || 'mm',
      recordedAt: new Date().toISOString(),
    });
    setLabel('');
    setValue('');
    setOpen(false);
  }

  return (
    <div className={styles.wrap}>
      {!readOnly && (
        <div className={styles.toolbar}>
          <AuthButton variant="secondary" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            <Plus size={16} aria-hidden />
            {t('beauty.measurements.add')}
          </AuthButton>
        </div>
      )}

      {open && !readOnly && (
        <form className={styles.addForm} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span>{t('beauty.measurements.type')}</span>
            <select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              {MEASUREMENT_TYPES.map((mt) => (
                <option key={mt} value={mt}>
                  {t(`beauty.measurements.${mt}`)}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>{t('beauty.forms.measurementLabel')}</span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} required />
          </label>
          <label className={styles.field}>
            <span>{t('beauty.forms.measurementValue')}</span>
            <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" required />
          </label>
          <label className={styles.field}>
            <span>{t('beauty.measurements.unit')}</span>
            <input value={unit} onChange={(e) => setUnit(e.target.value)} />
          </label>
          <div className={styles.formActions}>
            <AuthButton type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t('beauty.cancel')}
            </AuthButton>
            <AuthButton type="submit">{t('beauty.measurements.add')}</AuthButton>
          </div>
        </form>
      )}

      <MeasurementsPanel measurements={measurements} />
    </div>
  );
}
