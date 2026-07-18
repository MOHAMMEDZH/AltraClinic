import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { AuthFormField } from '@/features/auth/components/AuthFormField';
import { EmptyState } from '@/features/patients/components/EmptyState';
import { formatInventoryDate } from '@/features/inventory/config/inventory-config';
import { mapInventoryApiError } from '@/features/inventory/api/inventory-api';
import { FAVORITE_PROCEDURES } from '../config/dental-config';
import {
  useConsumeDentalMaterial,
  useConsumeDentalMaterialsBatch,
  useDentalClinicalInventorySearch,
  useDentalProcedureMaterials,
  usePatientDentalMaterials,
} from '../hooks/useDental';
import type { DentalClinicalInventoryItem, DentalProcedureMaterialMapping } from '../types/dental.types';
import styles from './DentalMaterialsPanel.module.css';

interface DentalMaterialsPanelProps {
  patientId: string;
  canEdit: boolean;
}

function itemLabel(item: { nameEn: string; nameAr: string | null }, locale: string): string {
  return locale.startsWith('ar') && item.nameAr ? item.nameAr : item.nameEn;
}

export function DentalMaterialsPanel({ patientId, canEdit }: DentalMaterialsPanelProps) {
  const { t, locale } = useI18n();
  const [procedureCode, setProcedureCode] = useState('');
  const materialsQuery = usePatientDentalMaterials(patientId);
  const suggestionsQuery = useDentalProcedureMaterials(procedureCode, canEdit && procedureCode.length > 0);
  const consumeMutation = useConsumeDentalMaterial(patientId);
  const batchMutation = useConsumeDentalMaterialsBatch(patientId);

  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<DentalClinicalInventoryItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [suggestedQty, setSuggestedQty] = useState<Record<string, number>>({});

  const searchQuery = useDentalClinicalInventorySearch(search, canEdit);
  const searchResults = useMemo(() => searchQuery.data?.items ?? [], [searchQuery.data?.items]);
  const suggestions = suggestionsQuery.data?.materials ?? [];

  const qtyFor = (row: DentalProcedureMaterialMapping) =>
    suggestedQty[row.itemId] ?? row.defaultQuantity;

  async function handleConsumeOne() {
    if (!selectedItem) return;
    setErrorKey(null);
    setSuccess(null);
    try {
      await consumeMutation.mutateAsync({
        itemId: selectedItem.itemId,
        quantity,
        procedureCode: procedureCode.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setSuccess(t('dental.materials.success'));
      setSelectedItem(null);
      setSearch('');
      setQuantity(1);
      setNotes('');
    } catch (err) {
      setErrorKey(mapInventoryApiError(err));
    }
  }

  async function handleConsumeSuggested() {
    if (suggestions.length === 0) return;
    setErrorKey(null);
    setSuccess(null);
    try {
      await batchMutation.mutateAsync({
        procedureCode: procedureCode.trim() || undefined,
        notes: notes.trim() || undefined,
        items: suggestions.map((row) => ({
          itemId: row.itemId,
          quantity: qtyFor(row),
        })),
      });
      setSuccess(t('dental.materials.batchSuccess'));
    } catch (err) {
      setErrorKey(mapInventoryApiError(err));
    }
  }

  const consumptions = materialsQuery.data?.consumptions ?? [];

  return (
    <div className={styles.panel}>
      {success && <AuthAlert variant="success">{success}</AuthAlert>}
      {errorKey && (
        <AuthAlert variant="error">
          {t(`inventory.errors.${errorKey}` as 'inventory.errors.generic')}
        </AuthAlert>
      )}

      {canEdit && (
        <section className={styles.formSection} aria-labelledby="dental-materials-form">
          <h3 id="dental-materials-form" className={styles.sectionTitle}>
            {t('dental.materials.logUsage')}
          </h3>
          <p className={styles.hint}>{t('dental.materials.procedureHint')}</p>
          <div className={styles.chips}>
            {FAVORITE_PROCEDURES.map((p) => (
              <button
                key={p.code}
                type="button"
                className={procedureCode === p.code ? styles.chipActive : styles.chip}
                onClick={() => setProcedureCode(p.code)}
              >
                {p.code}
              </button>
            ))}
          </div>
          {procedureCode && (
            <AuthFormField
              id="dental-procedure-code"
              label={t('dental.procedures.code')}
              value={procedureCode}
              onChange={(e) => setProcedureCode(e.target.value)}
            />
          )}
          {procedureCode && suggestions.length > 0 && (
            <div className={styles.suggestions}>
              <h4 className={styles.subTitle}>{t('dental.materials.suggested')}</h4>
              <ul className={styles.suggestionList}>
                {suggestions.map((row) => (
                  <li key={row.mappingId} className={styles.suggestionRow}>
                    <span>
                      <strong>{row.sku}</strong> — {itemLabel(row, locale)} ({row.quantityOnHand} {row.unit})
                    </span>
                    <input
                      type="number"
                      min={0.0001}
                      step="any"
                      max={row.quantityOnHand}
                      className={styles.qtyInput}
                      value={qtyFor(row)}
                      onChange={(e) =>
                        setSuggestedQty((prev) => ({ ...prev, [row.itemId]: Number(e.target.value) }))
                      }
                      aria-label={t('dental.materials.quantity')}
                    />
                  </li>
                ))}
              </ul>
              <AuthButton loading={batchMutation.isPending} onClick={() => void handleConsumeSuggested()}>
                {t('dental.materials.useSuggested')}
              </AuthButton>
            </div>
          )}
          {procedureCode && !suggestionsQuery.isLoading && suggestions.length === 0 && (
            <p className={styles.hint}>{t('dental.materials.noMappings')}</p>
          )}

          <AuthFormField
            id="dental-material-search"
            label={t('dental.materials.searchItem')}
            placeholder={t('dental.materials.searchPlaceholder')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedItem(null);
            }}
          />
          {search.trim().length >= 1 && !selectedItem && (
            <ul className={styles.searchResults} role="listbox" aria-label={t('dental.materials.searchItem')}>
              {searchQuery.isLoading && <li className={styles.searchHint}>{t('dental.materials.searching')}</li>}
              {!searchQuery.isLoading && searchResults.length === 0 && (
                <li className={styles.searchHint}>{t('dental.materials.noItems')}</li>
              )}
              {searchResults.map((item) => (
                <li key={item.itemId}>
                  <button
                    type="button"
                    className={styles.searchOption}
                    role="option"
                    onClick={() => {
                      setSelectedItem(item);
                      setSearch(itemLabel(item, locale));
                    }}
                  >
                    <strong>{item.sku}</strong> — {itemLabel(item, locale)}
                    <span className={styles.stockHint}>
                      {item.quantityOnHand} {item.unit}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {selectedItem && (
            <>
              <p className={styles.selectedItem}>
                {t('dental.materials.selected')}: <strong>{selectedItem.sku}</strong> —{' '}
                {itemLabel(selectedItem, locale)} ({selectedItem.quantityOnHand} {selectedItem.unit}{' '}
                {t('dental.materials.available')})
              </p>
              <div className={styles.formRow}>
                <AuthFormField
                  id="dental-material-qty"
                  label={t('dental.materials.quantity')}
                  type="number"
                  min={0.0001}
                  step="any"
                  max={selectedItem.quantityOnHand}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  required
                />
                <AuthFormField
                  id="dental-material-notes"
                  label={t('dental.materials.notes')}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <AuthButton
                loading={consumeMutation.isPending}
                disabled={quantity <= 0 || quantity > selectedItem.quantityOnHand}
                onClick={() => void handleConsumeOne()}
              >
                <Plus size={16} aria-hidden />
                {t('dental.materials.record')}
              </AuthButton>
            </>
          )}
        </section>
      )}

      <section aria-labelledby="dental-materials-list">
        <h3 id="dental-materials-list" className={styles.sectionTitle}>
          {t('dental.materials.usedTitle')}
        </h3>
        {materialsQuery.isLoading && consumptions.length === 0 ? (
          <div className={styles.skeleton} aria-hidden />
        ) : consumptions.length === 0 ? (
          <EmptyState title={t('dental.materials.empty')} description={t('dental.materials.emptyHint')} />
        ) : (
          <table className={styles.table}>
            <caption className="sr-only">{t('dental.materials.tableCaption')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('dental.materials.item')}</th>
                <th scope="col">{t('dental.procedures.code')}</th>
                <th scope="col">{t('dental.materials.quantity')}</th>
                <th scope="col">{t('dental.materials.when')}</th>
              </tr>
            </thead>
            <tbody>
              {consumptions.map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link to={`/inventory/items/${row.itemId}`} className={styles.itemLink}>
                      {row.sku} — {row.itemName}
                    </Link>
                  </td>
                  <td>{row.procedureCode ?? '—'}</td>
                  <td>
                    {row.quantityUsed} {row.unit}
                  </td>
                  <td>{formatInventoryDate(row.consumedAt, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
