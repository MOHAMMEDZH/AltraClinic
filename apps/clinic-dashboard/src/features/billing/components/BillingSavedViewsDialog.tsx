import { useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { Modal } from '@/features/patients/components/Modal';
import { AuthButton } from '@/features/auth/components/AuthButton';
import {
  deleteBillingSavedView,
  listBillingSavedViews,
  saveBillingSavedView,
  type BillingSavedView,
} from '../lib/billing-saved-views';
import styles from '../billing-layout.module.css';

interface BillingSavedViewsDialogProps {
  open: boolean;
  onClose: () => void;
  current: { search: string; status: string };
  onApply: (view: BillingSavedView) => void;
}

export function BillingSavedViewsDialog({ open, onClose, current, onApply }: BillingSavedViewsDialogProps) {
  const { t } = useI18n();
  const [views, setViews] = useState(() => listBillingSavedViews());
  const [name, setName] = useState('');

  function refresh() {
    setViews(listBillingSavedViews());
  }

  function handleSave() {
    if (!name.trim()) return;
    saveBillingSavedView({ name, search: current.search, status: current.status });
    setName('');
    refresh();
  }

  return (
    <Modal
      open={open}
      title={t('billing.savedViews.title')}
      onClose={onClose}
      closeLabel={t('billing.modal.close')}
      footer={<AuthButton variant="secondary" onClick={onClose}>{t('billing.modal.close')}</AuthButton>}
    >
      <div className={styles.formGrid}>
        <label>
          {t('billing.savedViews.name')}
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('billing.savedViews.namePlaceholder')} />
        </label>
        <AuthButton onClick={handleSave}>{t('billing.savedViews.saveCurrent')}</AuthButton>
      </div>
      <ul className={styles.recentList}>
        {views.length === 0 && <li className={styles.hint}>{t('billing.savedViews.empty')}</li>}
        {views.map((view) => (
          <li key={view.id} className={styles.recentItem}>
            <button type="button" className={styles.linkBtn} onClick={() => { onApply(view); onClose(); }}>
              {view.name}
            </button>
            <AuthButton variant="secondary" onClick={() => { deleteBillingSavedView(view.id); refresh(); }}>
              {t('billing.savedViews.delete')}
            </AuthButton>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
