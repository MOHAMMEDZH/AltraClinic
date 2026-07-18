import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { TREATMENT_TYPES } from '../config/beauty-config';
import type { BeautyAnnotation } from '../types/beauty.types';
import styles from './AnnotationEditorPanel.module.css';

interface AnnotationEditorPanelProps {
  annotation: BeautyAnnotation | null;
  readOnly?: boolean;
  loading?: boolean;
  onSave: (patch: {
    zone?: string;
    treatment?: string;
    parameters?: Record<string, unknown>;
    notes?: string | null;
  }) => void;
  onDelete: () => void;
}

export function AnnotationEditorPanel({
  annotation,
  readOnly,
  loading,
  onSave,
  onDelete,
}: AnnotationEditorPanelProps) {
  const { t } = useI18n();
  const [treatment, setTreatment] = useState(annotation?.treatment ?? 'botox');
  const [zone, setZone] = useState(annotation?.zone ?? '');
  const [notes, setNotes] = useState(annotation?.notes ?? '');
  const [units, setUnits] = useState(String((annotation?.parameters?.units as number) ?? ''));
  const [volumeCc, setVolumeCc] = useState(String((annotation?.parameters?.volumeCc as number) ?? ''));
  const [lot, setLot] = useState(String((annotation?.parameters?.lot as string) ?? ''));
  const [fluence, setFluence] = useState(String((annotation?.parameters?.fluence as number) ?? ''));
  const [joules, setJoules] = useState(String((annotation?.parameters?.joules as number) ?? ''));

  if (!annotation) {
    return <p className={styles.hint}>{t('beauty.annotations.selectPin')}</p>;
  }

  const isInjectable = treatment === 'botox' || treatment === 'filler';
  const isLaser = treatment === 'laser';

  return (
    <div className={styles.panel}>
      <h3 className={styles.title}>{t('beauty.annotations.editor')}</h3>
      <label>
        {t('beauty.faceMap.treatment')}
        <select value={treatment} disabled={readOnly} onChange={(e) => setTreatment(e.target.value)}>
          {TREATMENT_TYPES.map((tr) => (
            <option key={tr} value={tr}>{t(`beauty.treatments.${tr}`)}</option>
          ))}
        </select>
      </label>
      <label>
        {t('beauty.annotations.zone')}
        <input value={zone} disabled={readOnly} onChange={(e) => setZone(e.target.value)} />
      </label>
      {isInjectable && (
        <>
          <label>{t('beauty.injectables.units')}<input value={units} disabled={readOnly} onChange={(e) => setUnits(e.target.value)} inputMode="decimal" /></label>
          <label>{t('beauty.injectables.volumeCc')}<input value={volumeCc} disabled={readOnly} onChange={(e) => setVolumeCc(e.target.value)} inputMode="decimal" /></label>
          <label>{t('beauty.injectables.lot')}<input value={lot} disabled={readOnly} onChange={(e) => setLot(e.target.value)} /></label>
        </>
      )}
      {isLaser && (
        <>
          <label>{t('beauty.laser.fluence')}<input value={fluence} disabled={readOnly} onChange={(e) => setFluence(e.target.value)} inputMode="decimal" /></label>
          <label>{t('beauty.laser.joules')}<input value={joules} disabled={readOnly} onChange={(e) => setJoules(e.target.value)} inputMode="decimal" /></label>
        </>
      )}
      <label>
        {t('beauty.annotations.notes')}
        <textarea rows={2} value={notes} disabled={readOnly} onChange={(e) => setNotes(e.target.value)} />
      </label>
      {!readOnly && (
        <div className={styles.actions}>
          <AuthButton
            loading={loading}
            onClick={() =>
              onSave({
                treatment,
                zone,
                notes: notes || null,
                parameters: {
                  ...(annotation.parameters ?? {}),
                  ...(units ? { units: Number(units) } : {}),
                  ...(volumeCc ? { volumeCc: Number(volumeCc) } : {}),
                  ...(lot ? { lot } : {}),
                  ...(fluence ? { fluence: Number(fluence) } : {}),
                  ...(joules ? { joules: Number(joules) } : {}),
                },
              })
            }
          >
            {t('beauty.save')}
          </AuthButton>
          <AuthButton variant="ghost" loading={loading} onClick={onDelete}>
            <Trash2 size={14} aria-hidden />
            {t('beauty.annotations.delete')}
          </AuthButton>
        </div>
      )}
    </div>
  );
}
