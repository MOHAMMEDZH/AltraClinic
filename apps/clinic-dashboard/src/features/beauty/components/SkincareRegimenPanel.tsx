import { Plus, Trash2 } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { createBeautyId } from '../config/beauty-form-utils';
import type { SkincareRegimenItem } from '../types/beauty.types';
import styles from './SkincareRegimenPanel.module.css';

interface SkincareRegimenPanelProps {
  items: SkincareRegimenItem[];
  readOnly?: boolean;
  onChange: (items: SkincareRegimenItem[]) => void;
}

export function SkincareRegimenPanel({ items, readOnly, onChange }: SkincareRegimenPanelProps) {
  const { t } = useI18n();

  function addItem() {
    onChange([
      ...items,
      {
        id: createBeautyId('skincare'),
        productName: '',
        frequency: t('beauty.skincare.defaultFrequency'),
        notes: '',
        startedAt: new Date().toISOString().slice(0, 10),
      },
    ]);
  }

  return (
    <section className={styles.wrap} aria-label={t('beauty.skincare.title')}>
      <h3 className={styles.title}>{t('beauty.skincare.title')}</h3>
      {items.length === 0 && readOnly ? (
        <p className={styles.muted}>{t('beauty.skincare.empty')}</p>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.id} className={styles.card}>
              {readOnly ? (
                <>
                  <strong>{item.productName}</strong>
                  <span>{item.frequency}</span>
                  {item.notes && <p>{item.notes}</p>}
                </>
              ) : (
                <>
                  <label>{t('beauty.skincare.product')}<input value={item.productName} onChange={(e) => onChange(items.map((i) => i.id === item.id ? { ...i, productName: e.target.value } : i))} /></label>
                  <label>{t('beauty.skincare.frequency')}<input value={item.frequency} onChange={(e) => onChange(items.map((i) => i.id === item.id ? { ...i, frequency: e.target.value } : i))} /></label>
                  <label>{t('beauty.skincare.notes')}<input value={item.notes} onChange={(e) => onChange(items.map((i) => i.id === item.id ? { ...i, notes: e.target.value } : i))} /></label>
                  <button type="button" className={styles.remove} onClick={() => onChange(items.filter((i) => i.id !== item.id))} aria-label={t('beauty.skincare.remove')}>
                    <Trash2 size={14} aria-hidden />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && (
        <AuthButton variant="secondary" onClick={addItem}>
          <Plus size={14} aria-hidden />
          {t('beauty.skincare.add')}
        </AuthButton>
      )}
    </section>
  );
}
