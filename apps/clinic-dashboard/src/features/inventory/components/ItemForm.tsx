import { useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import type { InventoryCategory, InventoryItem, InventorySupplier } from '../types/inventory.types';
import { categoryDisplayName, supplierDisplayName } from '../config/inventory-config';

export interface ItemFormValues {
  sku: string;
  categoryId: string;
  supplierId: string;
  barcode: string;
  brand: string;
  nameEn: string;
  nameAr: string;
  unit: string;
  quantityOnHand: number;
  reorderThreshold: number;
  minQuantity: number | '';
  maxQuantity: number | '';
  costPerUnit: number | '';
  sellingPrice: number | '';
  storageLocation: string;
  lotNumber: string;
  expiryDate: string;
}

interface ItemFormProps {
  mode: 'create' | 'edit';
  initial?: InventoryItem;
  categories: InventoryCategory[];
  suppliers?: InventorySupplier[];
  loading?: boolean;
  onSubmit: (values: ItemFormValues) => void;
  onCancel: () => void;
}

function defaultValues(initial?: InventoryItem): ItemFormValues {
  return {
    sku: initial?.sku ?? '',
    categoryId: initial?.categoryId ?? '',
    supplierId: initial?.supplierId ?? '',
    barcode: initial?.barcode ?? '',
    brand: initial?.brand ?? '',
    nameEn: initial?.name.en ?? '',
    nameAr: initial?.name.ar ?? '',
    unit: initial?.unit ?? 'pcs',
    quantityOnHand: initial?.quantityOnHand ?? 0,
    reorderThreshold: initial?.reorderThreshold ?? 5,
    minQuantity: initial?.minQuantity ?? '',
    maxQuantity: initial?.maxQuantity ?? '',
    costPerUnit: initial?.costPerUnit ?? '',
    sellingPrice: initial?.sellingPrice ?? '',
    storageLocation: initial?.storageLocation ?? '',
    lotNumber: initial?.lotNumber ?? '',
    expiryDate: initial?.expiryDate ? initial.expiryDate.slice(0, 10) : '',
  };
}

export function ItemForm({ mode, initial, categories, suppliers = [], loading, onSubmit, onCancel }: ItemFormProps) {
  const { t, locale } = useI18n();
  const [values, setValues] = useState<ItemFormValues>(() => defaultValues(initial));

  function field<K extends keyof ItemFormValues>(key: K, value: ItemFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values);
      }}
    >
      {mode === 'create' && (
        <AuthFormField label={t('inventory.form.sku')} required>
          <input value={values.sku} required onChange={(e) => field('sku', e.target.value)} />
        </AuthFormField>
      )}
      <AuthFormField label={t('inventory.form.category')}>
        <select value={values.categoryId} onChange={(e) => field('categoryId', e.target.value)}>
          <option value="">{t('inventory.form.categoryNone')}</option>
          {categories.map((cat) => (
            <option key={cat.categoryId} value={cat.categoryId}>
              {categoryDisplayName(cat, locale)}
            </option>
          ))}
        </select>
      </AuthFormField>
      <AuthFormField label={t('inventory.form.supplier')}>
        <select value={values.supplierId} onChange={(e) => field('supplierId', e.target.value)}>
          <option value="">{t('inventory.form.supplierNone')}</option>
          {suppliers.map((s) => (
            <option key={s.supplierId} value={s.supplierId}>
              {supplierDisplayName(s, locale)} ({s.code})
            </option>
          ))}
        </select>
      </AuthFormField>
      <AuthFormField label={t('inventory.form.barcode')}>
        <input
          value={values.barcode}
          onChange={(e) => field('barcode', e.target.value)}
          inputMode="numeric"
          autoComplete="off"
          placeholder={t('inventory.form.barcodeHint')}
        />
      </AuthFormField>
      <AuthFormField label={t('inventory.form.brand')}>
        <input value={values.brand} onChange={(e) => field('brand', e.target.value)} />
      </AuthFormField>
      <AuthFormField label={t('inventory.form.nameEn')} required>
        <input value={values.nameEn} required onChange={(e) => field('nameEn', e.target.value)} />
      </AuthFormField>
      <AuthFormField label={t('inventory.form.nameAr')}>
        <input value={values.nameAr} onChange={(e) => field('nameAr', e.target.value)} dir="rtl" />
      </AuthFormField>
      <AuthFormField label={t('inventory.form.unit')} required>
        <input value={values.unit} required onChange={(e) => field('unit', e.target.value)} />
      </AuthFormField>
      {mode === 'create' && (
        <AuthFormField label={t('inventory.form.quantity')} required>
          <input
            type="number"
            min={0}
            required
            value={values.quantityOnHand}
            onChange={(e) => field('quantityOnHand', Number(e.target.value) || 0)}
          />
        </AuthFormField>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)' }}>
        <AuthFormField label={t('inventory.form.minQuantity')}>
          <input
            type="number"
            min={0}
            value={values.minQuantity}
            onChange={(e) => field('minQuantity', e.target.value === '' ? '' : Number(e.target.value))}
          />
        </AuthFormField>
        <AuthFormField label={t('inventory.form.reorder')} required>
          <input
            type="number"
            min={0}
            required
            value={values.reorderThreshold}
            onChange={(e) => field('reorderThreshold', Number(e.target.value) || 0)}
          />
        </AuthFormField>
        <AuthFormField label={t('inventory.form.maxQuantity')}>
          <input
            type="number"
            min={0}
            value={values.maxQuantity}
            onChange={(e) => field('maxQuantity', e.target.value === '' ? '' : Number(e.target.value))}
          />
        </AuthFormField>
      </div>
      <AuthFormField label={t('inventory.form.cost')}>
        <input
          type="number"
          min={0}
          step="0.01"
          value={values.costPerUnit}
          onChange={(e) => field('costPerUnit', e.target.value === '' ? '' : Number(e.target.value))}
        />
      </AuthFormField>
      <AuthFormField label={t('inventory.form.sellingPrice')}>
        <input
          type="number"
          min={0}
          step="0.01"
          value={values.sellingPrice}
          onChange={(e) => field('sellingPrice', e.target.value === '' ? '' : Number(e.target.value))}
        />
      </AuthFormField>
      <AuthFormField label={t('inventory.form.storageLocation')}>
        <input value={values.storageLocation} onChange={(e) => field('storageLocation', e.target.value)} />
      </AuthFormField>
      <AuthFormField label={t('inventory.form.lot')}>
        <input value={values.lotNumber} onChange={(e) => field('lotNumber', e.target.value)} />
      </AuthFormField>
      <AuthFormField label={t('inventory.form.expiry')}>
        <input type="date" value={values.expiryDate} onChange={(e) => field('expiryDate', e.target.value)} />
      </AuthFormField>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
        <AuthButton type="button" variant="ghost" onClick={onCancel}>
          {t('inventory.form.cancel')}
        </AuthButton>
        <AuthButton type="submit" loading={loading}>
          {t('inventory.form.save')}
        </AuthButton>
      </div>
    </form>
  );
}

export function itemFormToApiBody(values: ItemFormValues, mode: 'create' | 'edit') {
  const base = {
    categoryId: values.categoryId || null,
    supplierId: values.supplierId || null,
    barcode: values.barcode.trim() || null,
    brand: values.brand.trim() || null,
    nameEn: values.nameEn.trim(),
    nameAr: values.nameAr.trim() || null,
    unit: values.unit.trim(),
    reorderThreshold: values.reorderThreshold,
    minQuantity: values.minQuantity === '' ? null : values.minQuantity,
    maxQuantity: values.maxQuantity === '' ? null : values.maxQuantity,
    costPerUnit: values.costPerUnit === '' ? null : values.costPerUnit,
    sellingPrice: values.sellingPrice === '' ? null : values.sellingPrice,
    storageLocation: values.storageLocation.trim() || null,
    lotNumber: values.lotNumber.trim() || null,
    expiryDate: values.expiryDate ? new Date(values.expiryDate).toISOString() : null,
  };
  if (mode === 'create') {
    return {
      ...base,
      sku: values.sku.trim(),
      quantityOnHand: values.quantityOnHand,
    };
  }
  return base;
}
