import { useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import styles from '../reporting-layout.module.css';

export interface ReportField {
  id: string;
  labelKey: string;
  kind: 'dimension' | 'measure';
}

const AVAILABLE_FIELDS: ReportField[] = [
  { id: 'branch', labelKey: 'reports.fieldBuilder.branch', kind: 'dimension' },
  { id: 'doctor', labelKey: 'reports.fieldBuilder.doctor', kind: 'dimension' },
  { id: 'department', labelKey: 'reports.fieldBuilder.department', kind: 'dimension' },
  { id: 'date', labelKey: 'reports.fieldBuilder.date', kind: 'dimension' },
  { id: 'status', labelKey: 'reports.fieldBuilder.status', kind: 'dimension' },
  { id: 'revenue', labelKey: 'reports.fieldBuilder.revenue', kind: 'measure' },
  { id: 'appointments', labelKey: 'reports.fieldBuilder.appointments', kind: 'measure' },
  { id: 'patients', labelKey: 'reports.fieldBuilder.patients', kind: 'measure' },
  { id: 'queueWait', labelKey: 'reports.fieldBuilder.queueWait', kind: 'measure' },
];

interface ReportFieldBuilderProps {
  dimensions: string[];
  measures: string[];
  onChange: (next: { dimensions: string[]; measures: string[] }) => void;
}

type ReorderTarget = { list: 'dimension' | 'measure'; index: number };

function moveItem(list: string[], from: number, to: number): string[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function ReportFieldBuilder({ dimensions, measures, onChange }: ReportFieldBuilderProps) {
  const { t } = useI18n();
  const [dragFieldId, setDragFieldId] = useState<string | null>(null);
  const [reorderTarget, setReorderTarget] = useState<ReorderTarget | null>(null);

  const available = AVAILABLE_FIELDS.filter(
    (f) => !dimensions.includes(f.id) && !measures.includes(f.id),
  );

  function addField(fieldId: string, target: 'dimension' | 'measure') {
    const field = AVAILABLE_FIELDS.find((f) => f.id === fieldId);
    if (!field) return;
    if (target === 'dimension' && field.kind === 'dimension') {
      onChange({ dimensions: [...dimensions, fieldId], measures });
    } else if (target === 'measure' && field.kind === 'measure') {
      onChange({ dimensions, measures: [...measures, fieldId] });
    }
  }

  function removeField(fieldId: string, from: 'dimension' | 'measure') {
    if (from === 'dimension') {
      onChange({ dimensions: dimensions.filter((id) => id !== fieldId), measures });
    } else {
      onChange({ dimensions, measures: measures.filter((id) => id !== fieldId) });
    }
  }

  function handleDrop(target: 'dimension' | 'measure') {
    if (!dragFieldId) return;
    addField(dragFieldId, target);
    setDragFieldId(null);
  }

  function handleReorderDrop(list: 'dimension' | 'measure', toIndex: number) {
    if (!reorderTarget || reorderTarget.list !== list) return;
    const source = list === 'dimension' ? dimensions : measures;
    if (reorderTarget.index === toIndex) {
      setReorderTarget(null);
      return;
    }
    const next = moveItem(source, reorderTarget.index, toIndex);
    if (list === 'dimension') {
      onChange({ dimensions: next, measures });
    } else {
      onChange({ dimensions, measures: next });
    }
    setReorderTarget(null);
  }

  function renderActiveList(list: 'dimension' | 'measure', ids: string[]) {
    return (
      <ul className={styles.fieldList} role="list">
        {ids.map((id, index) => {
          const field = AVAILABLE_FIELDS.find((f) => f.id === id);
          return (
            <li
              key={id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (reorderTarget) handleReorderDrop(list, index);
                else if (dragFieldId) handleDrop(list);
              }}
            >
              <span
                className={styles.fieldChipActive}
                draggable
                onDragStart={() => setReorderTarget({ list, index })}
                onDragEnd={() => setReorderTarget(null)}
              >
                <span aria-hidden className={styles.dragHandle}>⋮⋮</span>
                {field ? t(field.labelKey as 'reports.fieldBuilder.branch') : id}
                <button type="button" aria-label={t('reports.fieldBuilder.remove')} onClick={() => removeField(id, list)}>×</button>
              </span>
            </li>
          );
        })}
        <li
          className={styles.fieldDropSlot}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (reorderTarget) handleReorderDrop(list, ids.length);
            else if (dragFieldId) handleDrop(list);
          }}
          aria-hidden={ids.length > 0}
        />
      </ul>
    );
  }

  return (
    <section className={styles.panel} aria-labelledby="report-field-builder">
      <h2 id="report-field-builder" className={styles.panelTitle}>{t('reports.fieldBuilder.title')}</h2>
      <p className={styles.hint}>{t('reports.fieldBuilder.hint')}</p>

      <div className={styles.fieldBuilderGrid}>
        <div>
          <h3 className={styles.cardTitle}>{t('reports.fieldBuilder.available')}</h3>
          <ul className={styles.fieldList} role="list">
            {available.map((field) => (
              <li key={field.id}>
                <button
                  type="button"
                  className={styles.fieldChip}
                  draggable
                  onDragStart={() => setDragFieldId(field.id)}
                  onDragEnd={() => setDragFieldId(null)}
                >
                  {t(field.labelKey as 'reports.fieldBuilder.branch')}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div
          className={styles.fieldDropZone}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!reorderTarget) handleDrop('dimension');
          }}
        >
          <h3 className={styles.cardTitle}>{t('reports.fieldBuilder.dimensions')}</h3>
          {renderActiveList('dimension', dimensions)}
        </div>

        <div
          className={styles.fieldDropZone}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!reorderTarget) handleDrop('measure');
          }}
        >
          <h3 className={styles.cardTitle}>{t('reports.fieldBuilder.measures')}</h3>
          {renderActiveList('measure', measures)}
        </div>
      </div>
    </section>
  );
}

export const DEFAULT_REPORT_DIMENSIONS = ['branch', 'date'];
export const DEFAULT_REPORT_MEASURES = ['revenue', 'appointments'];
