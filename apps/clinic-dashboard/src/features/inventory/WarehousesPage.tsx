import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Search } from 'lucide-react';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { Modal } from '@/features/patients/components/Modal';
import { canManageInventory, canViewInventory, warehouseDisplayName } from './config/inventory-config';
import { mapInventoryApiError } from './api/inventory-api';
import type { InventoryWarehouse } from './types/inventory.types';
import {
  useCreateInventoryWarehouse,
  useDeactivateInventoryWarehouse,
  useInventoryWarehouses,
  useReactivateInventoryWarehouse,
  useSetDefaultInventoryWarehouse,
  useUpdateInventoryWarehouse,
} from './hooks/useInventory';
import styles from './WarehousesPage.module.css';

interface FormValues {
  code: string;
  nameEn: string;
  nameAr: string;
  address: string;
  isDefault: boolean;
}

function emptyForm(): FormValues {
  return { code: '', nameEn: '', nameAr: '', address: '', isDefault: false };
}

function formFromWarehouse(w: InventoryWarehouse): FormValues {
  return {
    code: w.code,
    nameEn: w.nameEn,
    nameAr: w.nameAr ?? '',
    address: w.address ?? '',
    isDefault: w.isDefault,
  };
}

export function WarehousesPage() {
  const { t, locale, direction } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const perm = useCallback((action: string) => hasPermission(roles, 'api.inventory', action as never), [roles]);

  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<InventoryWarehouse | null>(null);
  const [form, setForm] = useState<FormValues>(emptyForm());
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const canView = canViewInventory(perm);
  const canManage = canManageInventory(perm);
  const listQuery = useInventoryWarehouses({
    q: search.trim() || undefined,
    status: showInactive ? 'all' : 'active',
    enabled: canView,
  });

  const createMutation = useCreateInventoryWarehouse();
  const updateMutation = useUpdateInventoryWarehouse();
  const deactivateMutation = useDeactivateInventoryWarehouse();
  const reactivateMutation = useReactivateInventoryWarehouse();
  const setDefaultMutation = useSetDefaultInventoryWarehouse();

  const warehouses = listQuery.data ?? [];

  function openCreate() {
    setEditTarget(null);
    setForm(emptyForm());
    setErrorKey(null);
    setFormOpen(true);
  }

  function openEdit(w: InventoryWarehouse) {
    setEditTarget(w);
    setForm(formFromWarehouse(w));
    setErrorKey(null);
    setFormOpen(true);
  }

  async function handleSave() {
    setErrorKey(null);
    const body = {
      code: form.code.trim(),
      nameEn: form.nameEn.trim(),
      nameAr: form.nameAr.trim() || null,
      address: form.address.trim() || null,
      isDefault: form.isDefault,
    };
    try {
      if (editTarget) {
        await updateMutation.mutateAsync({ warehouseId: editTarget.warehouseId, body });
      } else {
        await createMutation.mutateAsync(body);
      }
      setFormOpen(false);
    } catch (err) {
      setErrorKey(mapInventoryApiError(err));
    }
  }

  async function toggleActive(w: InventoryWarehouse) {
    setErrorKey(null);
    try {
      if (w.isActive) await deactivateMutation.mutateAsync(w.warehouseId);
      else await reactivateMutation.mutateAsync(w.warehouseId);
    } catch (err) {
      setErrorKey(mapInventoryApiError(err));
    }
  }

  async function makeDefault(w: InventoryWarehouse) {
    setErrorKey(null);
    try {
      await setDefaultMutation.mutateAsync(w.warehouseId);
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
      <nav aria-label={t('inventory.warehouses.breadcrumb')}>
        <Link to="/inventory" className={styles.backLink}>
          <ArrowLeft size={16} aria-hidden style={direction === 'rtl' ? { transform: 'scaleX(-1)' } : undefined} />
          {t('inventory.detail.back')}
        </Link>
      </nav>

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('inventory.warehouses.title')}</h1>
          <p className={styles.subtitle}>{t('inventory.warehouses.subtitle')}</p>
        </div>
        <div className={styles.headerActions}>
          <AuthButton variant="secondary" onClick={() => navigate('/inventory/transfers')}>
            {t('inventory.warehouses.transfersLink')}
          </AuthButton>
          {canManage && (
            <AuthButton onClick={openCreate}>
              <Plus size={16} aria-hidden />
              {t('inventory.warehouses.create')}
            </AuthButton>
          )}
        </div>
      </header>

      {errorKey && <AuthAlert variant="error">{t(`inventory.errors.${errorKey}` as 'inventory.errors.generic')}</AuthAlert>}

      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <Search size={16} className={styles.searchIcon} aria-hidden />
          <input
            className={styles.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('inventory.suppliers.searchPlaceholder')}
            aria-label={t('inventory.suppliers.searchPlaceholder')}
          />
        </div>
        <label>
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          {' '}{t('inventory.suppliers.showInactive')}
        </label>
      </div>

      {warehouses.length === 0 ? (
        <div className={styles.empty}>{t('inventory.warehouses.empty')}</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className="sr-only">{t('inventory.warehouses.tableCaption')}</caption>
            <thead>
              <tr>
                <th>{t('inventory.warehouses.code')}</th>
                <th>{t('inventory.warehouses.name')}</th>
                <th>{t('inventory.warehouses.address')}</th>
                <th>{t('inventory.warehouses.items')}</th>
                <th>{t('inventory.warehouses.quantity')}</th>
                <th>{t('inventory.warehouses.status')}</th>
                {canManage && <th>{t('inventory.table.actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {warehouses.map((w) => (
                <tr key={w.warehouseId}>
                  <td>
                    <Link to={`/inventory/warehouses/${w.warehouseId}`}>{w.code}</Link>
                    {w.isDefault ? ` (${t('inventory.warehouses.default')})` : ''}
                  </td>
                  <td>{warehouseDisplayName(w, locale)}</td>
                  <td>{w.address ?? '—'}</td>
                  <td>{w.metrics.itemCount}</td>
                  <td>{w.metrics.totalQuantity}</td>
                  <td>
                    <span className={w.isActive ? styles.badgeActive : styles.badgeInactive}>
                      {w.isActive ? t('inventory.warehouses.active') : t('inventory.warehouses.inactive')}
                    </span>
                  </td>
                  {canManage && (
                    <td>
                      <AuthButton variant="secondary" onClick={() => openEdit(w)}>
                        {t('inventory.form.editAction')}
                      </AuthButton>
                      {!w.isDefault && w.isActive && (
                        <AuthButton variant="secondary" onClick={() => makeDefault(w)}>
                          {t('inventory.warehouses.setDefault')}
                        </AuthButton>
                      )}
                      {!w.isDefault && (
                        <AuthButton variant="secondary" onClick={() => toggleActive(w)}>
                          {w.isActive ? t('inventory.warehouses.deactivate') : t('inventory.warehouses.reactivate')}
                        </AuthButton>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={formOpen}
        title={editTarget ? t('inventory.warehouses.editTitle') : t('inventory.warehouses.createTitle')}
        onClose={() => setFormOpen(false)}
      >
        <AuthFormField label={t('inventory.warehouses.code')} required>
          <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        </AuthFormField>
        <AuthFormField label={t('inventory.warehouses.name')} required>
          <input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} />
        </AuthFormField>
        <AuthFormField label={t('inventory.form.nameAr')}>
          <input value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} dir="rtl" />
        </AuthFormField>
        <AuthFormField label={t('inventory.warehouses.address')}>
          <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </AuthFormField>
        {!editTarget && (
          <label>
            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
            {' '}{t('inventory.warehouses.isDefault')}
          </label>
        )}
        <AuthButton onClick={() => void handleSave()} disabled={createMutation.isPending || updateMutation.isPending}>
          {t('inventory.form.save')}
        </AuthButton>
      </Modal>
    </div>
  );
}
