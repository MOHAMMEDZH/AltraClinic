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
import {
  useClinicalInventorySearch,
  useConsumeEncounterMaterial,
  useEncounterMaterials,
} from '../hooks/useEmr';
import type { ClinicalInventoryItem } from '../types/emr.types';
import styles from './EncounterMaterialsPanel.module.css';

interface EncounterMaterialsPanelProps {
  encounterId: string;
  canEdit: boolean;
}

function itemLabel(item: ClinicalInventoryItem, locale: string): string {
  return locale.startsWith('ar') && item.nameAr ? item.nameAr : item.nameEn;
}

export function EncounterMaterialsPanel({ encounterId, canEdit }: EncounterMaterialsPanelProps) {
  const { t, locale } = useI18n();
  const materialsQuery = useEncounterMaterials(encounterId);
  const consumeMutation = useConsumeEncounterMaterial(encounterId);

  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<ClinicalInventoryItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const searchQuery = useClinicalInventorySearch(search, canEdit);
  const searchResults = useMemo(() => searchQuery.data?.items ?? [], [searchQuery.data?.items]);

  async function handleConsume() {
    if (!selectedItem) return;
    setErrorKey(null);
    setSuccess(null);
    try {
      await consumeMutation.mutateAsync({
        itemId: selectedItem.itemId,
        quantity,
        notes: notes.trim() || undefined,
      });
      setSuccess(t('emr.materials.success'));
      setSelectedItem(null);
      setSearch('');
      setQuantity(1);
      setNotes('');
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
        <section className={styles.formSection} aria-labelledby="emr-materials-form">
          <h3 id="emr-materials-form" className={styles.sectionTitle}>
            {t('emr.materials.logUsage')}
          </h3>
          <AuthFormField
            id="material-search"
            label={t('emr.materials.searchItem')}
            placeholder={t('emr.materials.searchPlaceholder')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedItem(null);
            }}
          />
          {search.trim().length >= 1 && !selectedItem && (
            <ul className={styles.searchResults} role="listbox" aria-label={t('emr.materials.searchItem')}>
              {searchQuery.isLoading && <li className={styles.searchHint}>{t('emr.materials.searching')}</li>}
              {!searchQuery.isLoading && searchResults.length === 0 && (
                <li className={styles.searchHint}>{t('emr.materials.noItems')}</li>
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
                {t('emr.materials.selected')}: <strong>{selectedItem.sku}</strong> — {itemLabel(selectedItem, locale)}
                {' '}({selectedItem.quantityOnHand} {selectedItem.unit} {t('emr.materials.available')})
              </p>
              <div className={styles.formRow}>
                <AuthFormField
                  id="material-qty"
                  label={t('emr.materials.quantity')}
                  type="number"
                  min={0.0001}
                  step="any"
                  max={selectedItem.quantityOnHand}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  required
                />
                <AuthFormField
                  id="material-notes"
                  label={t('emr.materials.notes')}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <AuthButton
                loading={consumeMutation.isPending}
                disabled={quantity <= 0 || quantity > selectedItem.quantityOnHand}
                onClick={() => void handleConsume()}
              >
                <Plus size={16} aria-hidden />
                {t('emr.materials.record')}
              </AuthButton>
            </>
          )}
        </section>
      )}

      <section aria-labelledby="emr-materials-list">
        <h3 id="emr-materials-list" className={styles.sectionTitle}>
          {t('emr.materials.usedTitle')}
        </h3>
        {materialsQuery.isLoading && consumptions.length === 0 ? (
          <div className={styles.skeleton} aria-hidden />
        ) : consumptions.length === 0 ? (
          <EmptyState title={t('emr.materials.empty')} description={t('emr.materials.emptyHint')} />
        ) : (
          <table className={styles.table}>
            <caption className="sr-only">{t('emr.materials.tableCaption')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('emr.materials.item')}</th>
                <th scope="col">{t('emr.materials.quantity')}</th>
                <th scope="col">{t('emr.materials.when')}</th>
                <th scope="col">{t('emr.materials.notes')}</th>
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
                  <td>
                    {row.quantityUsed} {row.unit}
                  </td>
                  <td>{formatInventoryDate(row.consumedAt, locale)}</td>
                  <td>{row.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
