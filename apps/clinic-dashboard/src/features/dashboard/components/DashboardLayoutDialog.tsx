import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { Modal } from '@/features/patients/components/Modal';
import { AuthButton } from '@/features/auth/components/AuthButton';
import type { DashboardWidgetId } from '../config/dashboard-config';
import {
  createDefaultLayoutPrefs,
  moveWidgetInOrder,
  toggleWidgetVisibility,
  type DashboardLayoutPrefs,
} from '../lib/dashboard-layout-storage';
import styles from './DashboardLayoutDialog.module.css';

interface DashboardLayoutDialogProps {
  open: boolean;
  onClose: () => void;
  widgetIds: DashboardWidgetId[];
  prefs: DashboardLayoutPrefs;
  onSave: (prefs: DashboardLayoutPrefs) => void;
  onReset: () => void;
  widgetTitle: (id: DashboardWidgetId) => string;
}

export function DashboardLayoutDialog({
  open,
  onClose,
  widgetIds,
  prefs,
  onSave,
  onReset,
  widgetTitle,
}: DashboardLayoutDialogProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(prefs);

  useEffect(() => {
    if (open) setDraft(prefs);
  }, [open, prefs]);

  const hidden = new Set(draft.hiddenWidgets);
  const orderedIds = draft.widgetOrder.filter((id) => widgetIds.includes(id));
  for (const id of widgetIds) {
    if (!orderedIds.includes(id)) orderedIds.push(id);
  }

  return (
    <Modal
      open={open}
      title={t('dashboard.layout.title')}
      onClose={onClose}
      size="lg"
      footer={
        <div className={styles.footer}>
          <AuthButton
            variant="secondary"
            type="button"
            onClick={() => {
              const defaults = createDefaultLayoutPrefs(widgetIds);
              onReset();
              setDraft(defaults);
            }}
          >
            {t('dashboard.layout.reset')}
          </AuthButton>
          <AuthButton variant="secondary" type="button" onClick={onClose}>
            {t('dashboard.layout.cancel')}
          </AuthButton>
          <AuthButton
            type="button"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
          >
            {t('dashboard.layout.save')}
          </AuthButton>
        </div>
      }
    >
      <p className={styles.hint}>{t('dashboard.layout.hint')}</p>
      <ul className={styles.list}>
        {orderedIds.map((id, index) => {
          const isVisible = !hidden.has(id);
          return (
            <li key={id} className={[styles.row, !isVisible ? styles.rowHidden : ''].join(' ')}>
              <label className={styles.label}>
                <input
                  type="checkbox"
                  checked={isVisible}
                  onChange={(e) =>
                    setDraft((prev) => toggleWidgetVisibility(prev, id, e.target.checked))
                  }
                />{' '}
                {widgetTitle(id)}
              </label>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.iconBtn}
                  disabled={index === 0}
                  aria-label={t('dashboard.layout.moveUp')}
                  onClick={() => setDraft((prev) => moveWidgetInOrder(prev, id, 'up'))}
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  className={styles.iconBtn}
                  disabled={index === orderedIds.length - 1}
                  aria-label={t('dashboard.layout.moveDown')}
                  onClick={() => setDraft((prev) => moveWidgetInOrder(prev, id, 'down'))}
                >
                  <ArrowDown size={14} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

export function buildInitialLayoutPrefs(widgetIds: DashboardWidgetId[]): DashboardLayoutPrefs {
  return createDefaultLayoutPrefs(widgetIds);
}
