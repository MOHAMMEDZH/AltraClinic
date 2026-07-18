import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { SettingsFormToolbar } from '../components/SettingsFormToolbar';
import { useTenantSettings, useUpdateTenantSettings } from '../hooks/useSettings';
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard';
import styles from '../settings-layout.module.css';

export function InventorySettingsPage() {
  const { t } = useI18n();
  const settings = useTenantSettings();
  const save = useUpdateTenantSettings();
  const [dirty, setDirty] = useState(false);
  const [form, setForm] = useState({
    lowStockThreshold: '10',
    expiryAlertDays: '30',
    batchTracking: true,
    barcodeFormat: 'code128',
    qrEnabled: false,
    valuationMethod: 'fifo',
    reorderPoint: '5',
  });

  useEffect(() => {
    if (!settings.data) return;
    const inv = settings.data.inventorySettings ?? {};
    setForm({
      lowStockThreshold: String(inv.lowStockThreshold ?? '10'),
      expiryAlertDays: String(inv.expiryAlertDays ?? '30'),
      batchTracking: Boolean(inv.batchTracking ?? true),
      barcodeFormat: String(inv.barcodeFormat ?? 'code128'),
      qrEnabled: Boolean(inv.qrEnabled ?? false),
      valuationMethod: String(inv.valuationMethod ?? 'fifo'),
      reorderPoint: String(inv.reorderPoint ?? '5'),
    });
    setDirty(false);
  }, [settings.data]);

  useUnsavedChangesGuard(dirty);

  if (settings.isLoading) {
    return <div className={styles.skeleton} role="status" aria-busy="true" aria-label={t('settings.loading')} />;
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>{t('settings.inventory.title')}</h2>
          <p className={styles.pageSubtitle}>{t('settings.inventory.subtitle')}</p>
        </div>
        <SettingsFormToolbar
          dirty={dirty}
          saving={save.isPending}
          onSave={() => save.mutate({ inventorySettings: form }, { onSuccess: () => setDirty(false) })}
          onCancel={() => settings.refetch()}
        />
      </header>

      <section className={styles.panel}>
        <AuthFormField id="low-stock" label={t('settings.inventory.lowStock')} type="number" min={0} value={form.lowStockThreshold} onChange={(e) => { setForm((p) => ({ ...p, lowStockThreshold: e.target.value })); setDirty(true); }} />
        <AuthFormField id="expiry-days" label={t('settings.inventory.expiryDays')} type="number" min={1} value={form.expiryAlertDays} onChange={(e) => { setForm((p) => ({ ...p, expiryAlertDays: e.target.value })); setDirty(true); }} />
        <AuthFormField id="reorder" label={t('settings.inventory.reorderPoint')} type="number" min={0} value={form.reorderPoint} onChange={(e) => { setForm((p) => ({ ...p, reorderPoint: e.target.value })); setDirty(true); }} />
        <AuthFormField id="barcode" label={t('settings.inventory.barcodeFormat')}>
          <select id="barcode" className={styles.select} value={form.barcodeFormat} onChange={(e) => { setForm((p) => ({ ...p, barcodeFormat: e.target.value })); setDirty(true); }}>
            <option value="code128">Code 128</option>
            <option value="ean13">EAN-13</option>
            <option value="qr">QR</option>
          </select>
        </AuthFormField>
        <AuthFormField id="valuation" label={t('settings.inventory.valuation')}>
          <select id="valuation" className={styles.select} value={form.valuationMethod} onChange={(e) => { setForm((p) => ({ ...p, valuationMethod: e.target.value })); setDirty(true); }}>
            <option value="fifo">FIFO</option>
            <option value="average">Weighted average</option>
          </select>
        </AuthFormField>
        <label className={styles.checkboxLabel}>
          <input type="checkbox" checked={form.batchTracking} onChange={(e) => { setForm((p) => ({ ...p, batchTracking: e.target.checked })); setDirty(true); }} />
          {t('settings.inventory.batchTracking')}
        </label>
        <label className={styles.checkboxLabel}>
          <input type="checkbox" checked={form.qrEnabled} onChange={(e) => { setForm((p) => ({ ...p, qrEnabled: e.target.checked })); setDirty(true); }} />
          {t('settings.inventory.qrEnabled')}
        </label>
      </section>

      <section className={styles.panel}>
        <div className={styles.kpiGrid}>
          <Link to="/inventory" className={styles.kpiCard}>{t('settings.inventory.dashboard')}</Link>
          <Link to="/inventory/warehouses" className={styles.kpiCard}>{t('settings.inventory.warehouses')}</Link>
        </div>
      </section>

      {save.isSuccess && !dirty && <AuthAlert variant="success">{t('settings.saveSuccess')}</AuthAlert>}
    </div>
  );
}
