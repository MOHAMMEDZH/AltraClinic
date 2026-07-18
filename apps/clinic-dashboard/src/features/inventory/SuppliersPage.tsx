import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Search } from 'lucide-react';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { Modal } from '@/features/patients/components/Modal';
import { canManageInventory, canViewInventory, supplierDisplayName } from './config/inventory-config';
import { mapInventoryApiError } from './api/inventory-api';
import type { InventorySupplier } from './types/inventory.types';
import {
  useCreateInventorySupplier,
  useDeactivateInventorySupplier,
  useInventorySuppliers,
  useReactivateInventorySupplier,
  useUpdateInventorySupplier,
} from './hooks/useInventory';
import styles from './SuppliersPage.module.css';

interface SupplierFormValues {
  code: string;
  nameEn: string;
  nameAr: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  leadTimeDays: number | '';
  notes: string;
}

function emptyForm(): SupplierFormValues {
  return {
    code: '',
    nameEn: '',
    nameAr: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    leadTimeDays: '',
    notes: '',
  };
}

function formFromSupplier(s: InventorySupplier): SupplierFormValues {
  return {
    code: s.code,
    nameEn: s.nameEn,
    nameAr: s.nameAr ?? '',
    contactName: s.contactName ?? '',
    email: s.email ?? '',
    phone: s.phone ?? '',
    address: s.address ?? '',
    leadTimeDays: s.leadTimeDays ?? '',
    notes: s.notes ?? '',
  };
}

function formToBody(values: SupplierFormValues) {
  return {
    code: values.code.trim(),
    nameEn: values.nameEn.trim(),
    nameAr: values.nameAr.trim() || null,
    contactName: values.contactName.trim() || null,
    email: values.email.trim() || null,
    phone: values.phone.trim() || null,
    address: values.address.trim() || null,
    leadTimeDays: values.leadTimeDays === '' ? null : values.leadTimeDays,
    notes: values.notes.trim() || null,
  };
}

export function SuppliersPage() {
  const { t, locale, direction } = useI18n();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const perm = useCallback((action: string) => hasPermission(roles, 'api.inventory', action as never), [roles]);

  const [search, setSearch] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<InventorySupplier | null>(null);
  const [formValues, setFormValues] = useState<SupplierFormValues>(emptyForm);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    const tmr = setTimeout(() => setDebouncedQ(search.trim()), 300);
    return () => clearTimeout(tmr);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, showInactive]);

  const canView = canViewInventory(perm);
  const canManage = canManageInventory(perm);

  const listQuery = useInventorySuppliers({
    q: debouncedQ || undefined,
    status: showInactive ? 'all' : 'active',
    page,
    enabled: canView,
  });

  const createMutation = useCreateInventorySupplier();
  const updateMutation = useUpdateInventorySupplier();
  const deactivateMutation = useDeactivateInventorySupplier();
  const reactivateMutation = useReactivateInventorySupplier();

  const suppliers = listQuery.data?.suppliers ?? [];
  const totalPages = Math.max(1, Math.ceil((listQuery.data?.total ?? 0) / (listQuery.data?.limit ?? 20)));

  function openCreate() {
    setEditTarget(null);
    setFormValues(emptyForm());
    setFormOpen(true);
  }

  function openEdit(s: InventorySupplier) {
    setEditTarget(s);
    setFormValues(formFromSupplier(s));
    setFormOpen(true);
  }

  async function handleSubmit() {
    setErrorKey(null);
    try {
      const body = formToBody(formValues);
      if (editTarget) {
        await updateMutation.mutateAsync({ supplierId: editTarget.supplierId, body });
      } else {
        await createMutation.mutateAsync(body);
      }
      setFormOpen(false);
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
      <nav aria-label={t('inventory.suppliers.breadcrumb')}>
        <Link to="/inventory" className={styles.backLink}>
          <ArrowLeft
            size={16}
            aria-hidden
            style={direction === 'rtl' ? { transform: 'scaleX(-1)' } : undefined}
          />
          {t('inventory.detail.back')}
        </Link>
      </nav>

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('inventory.suppliers.title')}</h1>
          <p className={styles.subtitle}>{t('inventory.suppliers.subtitle')}</p>
        </div>
        {canManage && (
          <div className={styles.headerActions}>
            <AuthButton onClick={openCreate}>
              <Plus size={16} aria-hidden />
              {t('inventory.suppliers.add')}
            </AuthButton>
          </div>
        )}
      </header>

      {errorKey && (
        <AuthAlert variant="error">
          {t(`inventory.errors.${errorKey}` as 'inventory.errors.generic')}
        </AuthAlert>
      )}

      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <Search size={16} className={styles.searchIcon} aria-hidden />
          <input
            className={styles.searchInput}
            value={search}
            placeholder={t('inventory.suppliers.searchPlaceholder')}
            aria-label={t('inventory.suppliers.searchPlaceholder')}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <AuthButton
          variant={showInactive ? 'primary' : 'secondary'}
          onClick={() => setShowInactive((v) => !v)}
        >
          {t('inventory.suppliers.showInactive')}
        </AuthButton>
      </div>

      {listQuery.isLoading ? (
        <div className={styles.empty} aria-busy="true" />
      ) : suppliers.length === 0 ? (
        <div className={styles.empty}>
          <p>{t('inventory.suppliers.empty')}</p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className="sr-only">{t('inventory.suppliers.tableCaption')}</caption>
            <thead>
              <tr>
                <th>{t('inventory.suppliers.code')}</th>
                <th>{t('inventory.suppliers.name')}</th>
                <th>{t('inventory.suppliers.contact')}</th>
                <th>{t('inventory.suppliers.leadTime')}</th>
                <th>{t('inventory.suppliers.linkedItems')}</th>
                <th>{t('inventory.suppliers.status')}</th>
                {canManage && <th>{t('inventory.table.actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.supplierId}>
                  <td dir="ltr">{s.code}</td>
                  <td>
                    <Link to={`/inventory/suppliers/${s.supplierId}`}>{supplierDisplayName(s, locale)}</Link>
                  </td>
                  <td>{s.contactName ?? s.email ?? s.phone ?? '—'}</td>
                  <td>{s.leadTimeDays != null ? `${s.leadTimeDays}d` : '—'}</td>
                  <td>{s.metrics.linkedItemCount}</td>
                  <td>
                    <span className={s.isActive ? styles.badgeActive : styles.badgeInactive}>
                      {s.isActive ? t('inventory.suppliers.active') : t('inventory.suppliers.inactive')}
                    </span>
                  </td>
                  {canManage && (
                    <td>
                      <div className={styles.rowActions}>
                        <AuthButton variant="secondary" onClick={() => openEdit(s)}>
                          {t('inventory.form.editAction')}
                        </AuthButton>
                        {s.isActive ? (
                          <AuthButton
                            variant="ghost"
                            loading={deactivateMutation.isPending}
                            onClick={() => void deactivateMutation.mutateAsync(s.supplierId)}
                          >
                            {t('inventory.suppliers.deactivate')}
                          </AuthButton>
                        ) : (
                          <AuthButton
                            variant="ghost"
                            loading={reactivateMutation.isPending}
                            onClick={() => void reactivateMutation.mutateAsync(s.supplierId)}
                          >
                            {t('inventory.reactivate.action')}
                          </AuthButton>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <nav className={styles.pagination}>
          <AuthButton variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {t('inventory.pagination.prev')}
          </AuthButton>
          <span>{page} / {totalPages}</span>
          <AuthButton variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            {t('inventory.pagination.next')}
          </AuthButton>
        </nav>
      )}

      <Modal
        open={formOpen}
        title={editTarget ? t('inventory.suppliers.editTitle') : t('inventory.suppliers.createTitle')}
        onClose={() => setFormOpen(false)}
      >
        <div className={styles.formGrid}>
          <AuthFormField label={t('inventory.suppliers.code')} required>
            <input
              value={formValues.code}
              required
              dir="ltr"
              onChange={(e) => setFormValues((v) => ({ ...v, code: e.target.value.toUpperCase() }))}
            />
          </AuthFormField>
          <AuthFormField label={t('inventory.form.nameEn')} required>
            <input
              value={formValues.nameEn}
              required
              onChange={(e) => setFormValues((v) => ({ ...v, nameEn: e.target.value }))}
            />
          </AuthFormField>
          <AuthFormField label={t('inventory.form.nameAr')}>
            <input
              value={formValues.nameAr}
              dir="rtl"
              onChange={(e) => setFormValues((v) => ({ ...v, nameAr: e.target.value }))}
            />
          </AuthFormField>
          <AuthFormField label={t('inventory.suppliers.contactName')}>
            <input value={formValues.contactName} onChange={(e) => setFormValues((v) => ({ ...v, contactName: e.target.value }))} />
          </AuthFormField>
          <AuthFormField label={t('inventory.suppliers.email')}>
            <input type="email" value={formValues.email} onChange={(e) => setFormValues((v) => ({ ...v, email: e.target.value }))} />
          </AuthFormField>
          <AuthFormField label={t('inventory.suppliers.phone')}>
            <input value={formValues.phone} dir="ltr" onChange={(e) => setFormValues((v) => ({ ...v, phone: e.target.value }))} />
          </AuthFormField>
          <AuthFormField label={t('inventory.suppliers.address')}>
            <input value={formValues.address} onChange={(e) => setFormValues((v) => ({ ...v, address: e.target.value }))} />
          </AuthFormField>
          <AuthFormField label={t('inventory.suppliers.leadTime')}>
            <input
              type="number"
              min={0}
              value={formValues.leadTimeDays}
              onChange={(e) =>
                setFormValues((v) => ({
                  ...v,
                  leadTimeDays: e.target.value === '' ? '' : Number(e.target.value),
                }))
              }
            />
          </AuthFormField>
          <AuthFormField label={t('inventory.suppliers.notes')}>
            <textarea rows={2} value={formValues.notes} onChange={(e) => setFormValues((v) => ({ ...v, notes: e.target.value }))} />
          </AuthFormField>
        </div>
        <div className={styles.modalActions}>
          <AuthButton variant="ghost" onClick={() => setFormOpen(false)}>
            {t('inventory.form.cancel')}
          </AuthButton>
          <AuthButton loading={createMutation.isPending || updateMutation.isPending} onClick={() => void handleSubmit()}>
            {t('inventory.form.save')}
          </AuthButton>
        </div>
      </Modal>
    </div>
  );
}
