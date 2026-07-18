import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import type { BeautyBodyMapState, BeautySession } from '../types/beauty.types';
import { SessionForm } from './SessionForm';
import { SessionsPanel } from './SessionsPanel';
import styles from './SessionsWorkspace.module.css';

interface SessionsWorkspaceProps {
  state: BeautyBodyMapState;
  clinicianId: string;
  readOnly?: boolean;
  onPatch: (updater: (prev: BeautyBodyMapState) => BeautyBodyMapState) => void;
}

export function SessionsWorkspace({ state, clinicianId, readOnly, onPatch }: SessionsWorkspaceProps) {
  const { t } = useI18n();
  const [mode, setMode] = useState<'schedule' | 'complete' | null>(null);
  const [completing, setCompleting] = useState<BeautySession | null>(null);

  function saveSession(
    session: BeautySession,
    extras?: { measurement?: BeautyBodyMapState['measurements'][0]; followUp?: BeautySession },
  ) {
    onPatch((prev) => {
      const exists = prev.sessions.some((s) => s.id === session.id);
      let sessions = exists ? prev.sessions.map((s) => (s.id === session.id ? session : s)) : [session, ...prev.sessions];
      if (extras?.followUp) sessions = [extras.followUp, ...sessions];
      let measurements = prev.measurements;
      if (extras?.measurement) measurements = [...measurements, extras.measurement];
      let treatmentPlans = prev.treatmentPlans;
      if (session.status === 'completed' && session.planId) {
        treatmentPlans = treatmentPlans.map((p) =>
          p.id === session.planId ? { ...p, sessionsCompleted: Math.min(p.sessionsPlanned, p.sessionsCompleted + 1) } : p,
        );
      }
      return { ...prev, sessions, measurements, treatmentPlans };
    });
    setMode(null);
    setCompleting(null);
  }

  return (
    <div className={styles.wrap}>
      {!readOnly && !mode && !completing && (
        <div className={styles.toolbar}>
          <AuthButton variant="secondary" onClick={() => setMode('schedule')}>
            <Plus size={16} aria-hidden />
            {t('beauty.sessions.add')}
          </AuthButton>
        </div>
      )}

      {mode === 'schedule' && (
        <div className={styles.panel}>
          <SessionForm
            mode="schedule"
            clinicianId={clinicianId}
            plans={state.treatmentPlans}
            onSave={(s) => saveSession(s)}
            onCancel={() => setMode(null)}
          />
        </div>
      )}

      {completing && (
        <div className={styles.panel}>
          <SessionForm
            mode="complete"
            clinicianId={clinicianId}
            plans={state.treatmentPlans}
            initial={completing}
            onSave={(s, extras) => saveSession(s, extras)}
            onCancel={() => setCompleting(null)}
          />
        </div>
      )}

      <SessionsPanel
        sessions={state.sessions}
        onComplete={
          readOnly
            ? undefined
            : (s) => {
                setCompleting(s);
                setMode(null);
              }
        }
      />
    </div>
  );
}
