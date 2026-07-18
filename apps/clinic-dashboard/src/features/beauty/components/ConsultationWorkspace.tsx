import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { ConsultationForm } from './ConsultationForm';
import { ConsultationPanel } from './ConsultationPanel';
import type { BeautyBodyMapState, BeautyConsultation, BeautyConsent } from '../types/beauty.types';
import styles from './ConsultationWorkspace.module.css';

interface ConsultationWorkspaceProps {
  state: BeautyBodyMapState;
  clinicianId: string;
  readOnly?: boolean;
  onPatch: (updater: (prev: BeautyBodyMapState) => BeautyBodyMapState) => void;
}

export function ConsultationWorkspace({ state, clinicianId, readOnly, onPatch }: ConsultationWorkspaceProps) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<BeautyConsultation | null>(null);
  const [creating, setCreating] = useState(false);

  function handleSave(consultation: BeautyConsultation, consents: BeautyConsent[]) {
    onPatch((prev) => {
      const exists = prev.consultations.some((c) => c.id === consultation.id);
      const consultations = exists
        ? prev.consultations.map((c) => (c.id === consultation.id ? consultation : c))
        : [consultation, ...prev.consultations];
      const mergedConsents = [...prev.consents];
      for (const c of consents) {
        const idx = mergedConsents.findIndex((x) => x.type === c.type);
        if (idx >= 0) mergedConsents[idx] = c;
        else mergedConsents.push(c);
      }
      return { ...prev, consultations, consents: mergedConsents };
    });
    setCreating(false);
    setEditing(null);
  }

  return (
    <div className={styles.wrap}>
      {!readOnly && !creating && !editing && (
        <AuthButton variant="secondary" onClick={() => setCreating(true)}>
          <Plus size={16} aria-hidden />
          {t('beauty.consultation.add')}
        </AuthButton>
      )}

      {(creating || editing) && (
        <div className={styles.formPanel}>
          <h3 className={styles.formTitle}>
            {editing ? t('beauty.forms.editConsultation') : t('beauty.consultation.add')}
          </h3>
          <ConsultationForm
            clinicianId={clinicianId}
            initial={editing ?? undefined}
            onSave={handleSave}
            onCancel={() => {
              setCreating(false);
              setEditing(null);
            }}
          />
        </div>
      )}

      <ConsultationPanel
        consultations={state.consultations}
        onEdit={readOnly ? undefined : (c) => setEditing(c)}
      />
    </div>
  );
}
