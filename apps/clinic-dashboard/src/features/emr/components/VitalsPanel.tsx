import { useI18n } from '@booking/i18n/react';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import type { ObservationRecord } from '../types/emr.types';
import { VITAL_TYPES, getVitalValue, setVitalValue } from '../config/emr-config';
import styles from './VitalsPanel.module.css';

interface VitalsPanelProps {
  observations: ObservationRecord[];
  readOnly?: boolean;
  onChange?: (observations: ObservationRecord[]) => void;
}

export function VitalsPanel({ observations, readOnly, onChange }: VitalsPanelProps) {
  const { t } = useI18n();

  function handleChange(type: string, value: string, unit?: string) {
    if (readOnly || !onChange) return;
    onChange(setVitalValue(observations, type, value, unit));
  }

  return (
    <section className={styles.panel} aria-label={t('emr.vitals.title')}>
      <div className={styles.grid}>
        {VITAL_TYPES.map(({ type, labelKey, unit, placeholder }) => {
          const value = getVitalValue(observations, type);
          if (readOnly && !value) return null;
          return readOnly ? (
            <div key={type} className={styles.readOnlyCard}>
              <p className={styles.label}>{t(labelKey)}</p>
              <p className={styles.value}>
                {value || '—'}
                {value && unit ? <span className={styles.unit}>{unit}</span> : null}
              </p>
            </div>
          ) : (
            <AuthFormField
              key={type}
              id={`vital-${type}`}
              label={t(labelKey)}
              value={value}
              onChange={(e) => handleChange(type, e.target.value, unit || undefined)}
              placeholder={placeholder}
              helpText={unit || undefined}
            />
          );
        })}
      </div>
    </section>
  );
}
