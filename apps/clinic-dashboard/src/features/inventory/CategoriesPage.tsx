import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { Modal } from '@/features/patients/components/Modal';
import { canManageInventory, canViewInventory, categoryDisplayName } from './config/inventory-config';
import { mapInventoryApiError } from './api/inventory-api';
import { useCreateInventoryCategory, useInventoryCategories } from './hooks/useInventory';
import styles from './SuppliersPage.module.css';

export function CategoriesPage() {
  const { t, locale, direction } = useI18n();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const perm = useCallback((action: string) => hasPermission(roles, 'api.inventory', action as never), [roles]);

  const [formOpen, setFormOpen] = useState(false);
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [key, setKey] = useState('');
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const canView = canViewInventory(perm);
  const canManage = canManageInventory(perm);
  const categoriesQuery = useInventoryCategories(canView);
  const createMutation = useCreateInventoryCategory();
  const categories = categoriesQuery.data ?? [];

  async function handleCreate() {
    setErrorKey(null);
    try {
      await createMutation.mutateAsync({
        nameEn: nameEn.trim(),
        nameAr: nameAr.trim() || null,
        key: key.trim() || undefined,
      });
      setFormOpen(false);
      setNameEn('');
      setNameAr('');
      setKey('');
    } catch (err) {
      setErrorKey(mapInventoryApiError(err));
    }
  }

  if (!canView) {
    return (
      <div className={styles.page}>
        <AuthAlert variant="error">{t('inventory.accessDenied')}</AuthAlert>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link to="/inventory" className={styles.backLink}>
        <ArrowLeft size={16} aria-hidden style={direction === 'rtl' ? { transform: 'scaleX(-1)' } : undefined} />
        {t('inventory.detail.back')}
      </Link>

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('inventory.categories.title')}</h1>
          <p className={styles.subtitle}>{t('inventory.categories.subtitle')}</p>
        </div>
        {canManage && (
          <AuthButton onClick={() => setFormOpen(true)}>
            <Plus size={16} aria-hidden />
            {t('inventory.categories.create')}
          </AuthButton>
        )}
      </header>

      {errorKey && <AuthAlert variant="error">{t(`inventory.errors.${errorKey}` as 'inventory.errors.generic')}</AuthAlert>}

      {categories.length === 0 ? (
        <p className={styles.empty}>{t('inventory.categories.empty')}</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className="sr-only">{t('inventory.categories.tableCaption')}</caption>
            <thead>
              <tr>
                <th>{t('inventory.categories.key')}</th>
                <th>{t('inventory.categories.name')}</th>
                <th>{t('inventory.categories.system')}</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.categoryId}>
                  <td>{cat.key}</td>
                  <td>{categoryDisplayName(cat, locale)}</td>
                  <td>{cat.isSystem ? t('inventory.categories.yes') : t('inventory.categories.no')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={formOpen} title={t('inventory.categories.createTitle')} onClose={() => setFormOpen(false)}>
        <AuthFormField label={t('inventory.categories.name')} required>
          <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
        </AuthFormField>
        <AuthFormField label={t('inventory.form.nameAr')}>
          <input value={nameAr} onChange={(e) => setNameAr(e.target.value)} dir="rtl" />
        </AuthFormField>
        <AuthFormField label={t('inventory.categories.key')}>
          <input value={key} onChange={(e) => setKey(e.target.value)} placeholder={t('inventory.categories.keyHint')} />
        </AuthFormField>
        <AuthButton onClick={() => void handleCreate()} disabled={createMutation.isPending || !nameEn.trim()}>
          {t('inventory.form.save')}
        </AuthButton>
      </Modal>
    </div>
  );
}
