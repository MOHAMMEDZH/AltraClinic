import { useCallback, useMemo, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { GripVertical, Link2, Plus, Trash2 } from 'lucide-react';
import { AuthButton } from '@/features/auth/components/AuthButton';
import type { TreatmentPhase, TreatmentPlanItem } from './treatment-plan.types';
import {
  calcInsuranceDefaults,
  formatCurrency,
  formatDuration,
  newLocalItem,
  PROCEDURE_CATALOG,
} from './treatment-plan-config';
import styles from './TreatmentPlanBuilder.module.css';

interface TreatmentPlanBuilderProps {
  phases: TreatmentPhase[];
  readOnly?: boolean;
  currency?: string;
  onChange: (phases: TreatmentPhase[]) => void;
}

type DragPayload = { itemId: string; phaseId: string };

export function TreatmentPlanBuilder({ phases, readOnly, currency = 'USD', onChange }: TreatmentPlanBuilderProps) {
  const { t, locale } = useI18n();
  const [drag, setDrag] = useState<DragPayload | null>(null);
  const [catalogOpen, setCatalogOpen] = useState<string | null>(null);

  const allItems = useMemo(() => phases.flatMap((p) => p.items), [phases]);

  const updatePhases = useCallback(
    (updater: (prev: TreatmentPhase[]) => TreatmentPhase[]) => onChange(updater(phases)),
    [onChange, phases],
  );

  function addPhase() {
    updatePhases((prev) => [
      ...prev,
      {
        id: `local-phase-${crypto.randomUUID()}`,
        name: t('dental.treatmentPlan.builder.newPhase').replace('{n}', String(prev.length + 1)),
        sortOrder: prev.length,
        visitNumber: prev.length + 1,
        estimatedVisitDate: null,
        clinicalNotes: null,
        items: [],
      },
    ]);
  }

  function addProcedure(phaseId: string, code: string, description: string) {
    updatePhases((prev) =>
      prev.map((phase) =>
        phase.id === phaseId
          ? { ...phase, items: [...phase.items, { ...newLocalItem(code, description), phaseId, sortOrder: phase.items.length }] }
          : phase,
      ),
    );
    setCatalogOpen(null);
  }

  function removeItem(phaseId: string, itemId: string) {
    updatePhases((prev) =>
      prev.map((phase) =>
        phase.id === phaseId
          ? {
              ...phase,
              items: phase.items
                .filter((i) => i.id !== itemId)
                .map((i, idx) => ({
                  ...i,
                  dependsOnItemId: i.dependsOnItemId === itemId ? null : i.dependsOnItemId,
                  sortOrder: idx,
                })),
            }
          : phase,
      ),
    );
  }

  function updateItem(phaseId: string, itemId: string, patch: Partial<TreatmentPlanItem>) {
    updatePhases((prev) =>
      prev.map((phase) =>
        phase.id === phaseId
          ? { ...phase, items: phase.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) }
          : phase,
      ),
    );
  }

  function moveItem(targetPhaseId: string, targetIndex: number, payload: DragPayload) {
    let moving: TreatmentPlanItem | null = null;
    const stripped = phases.map((phase) => {
      const idx = phase.items.findIndex((i) => i.id === payload.itemId);
      if (idx < 0) return phase;
      moving = phase.items[idx];
      return { ...phase, items: phase.items.filter((i) => i.id !== payload.itemId) };
    });
    if (!moving) return;

    const inserted = stripped.map((phase) => {
      if (phase.id !== targetPhaseId) return phase;
      const items = [...phase.items];
      items.splice(targetIndex, 0, { ...moving!, phaseId: targetPhaseId });
      return { ...phase, items: items.map((i, idx) => ({ ...i, sortOrder: idx })) };
    });
    onChange(inserted.map((p, idx) => ({ ...p, sortOrder: idx })));
  }

  function dependencyOptions(currentItem: TreatmentPlanItem) {
    return allItems.filter((i) => i.id !== currentItem.id);
  }

  return (
    <div className={styles.builder}>
      {phases.map((phase, pi) => (
        <section key={phase.id} className={styles.phaseCard}>
          <header className={styles.phaseHead}>
            <span className={styles.visitNum}>{t('dental.treatmentPlan.timeline.visit').replace('{n}', String(phase.visitNumber ?? pi + 1))}</span>
            {!readOnly ? (
              <input
                className={styles.phaseNameInput}
                value={phase.name}
                onChange={(e) =>
                  updatePhases((prev) => prev.map((p) => (p.id === phase.id ? { ...p, name: e.target.value } : p)))
                }
                aria-label={t('dental.treatmentPlan.builder.phaseName')}
              />
            ) : (
              <h3 className={styles.phaseName}>{phase.name}</h3>
            )}
            {!readOnly && (
              <input
                type="date"
                className={styles.dateInput}
                value={phase.estimatedVisitDate?.slice(0, 10) ?? ''}
                onChange={(e) =>
                  updatePhases((prev) =>
                    prev.map((p) =>
                      p.id === phase.id ? { ...p, estimatedVisitDate: e.target.value ? `${e.target.value}T12:00:00.000Z` : null } : p,
                    ),
                  )
                }
                aria-label={t('dental.treatmentPlan.builder.visitDate')}
              />
            )}
          </header>

          <ul className={styles.procList} role="list">
            {phase.items.map((item, ii) => (
              <li
                key={item.id}
                className={[styles.procRow, drag?.itemId === item.id ? styles.dragging : ''].join(' ')}
                draggable={!readOnly}
                onDragStart={() => setDrag({ itemId: item.id, phaseId: phase.id })}
                onDragEnd={() => setDrag(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (drag) moveItem(phase.id, ii, drag);
                  setDrag(null);
                }}
              >
                {!readOnly && <GripVertical size={16} className={styles.grip} aria-hidden />}
                <div className={styles.procMain}>
                  <div className={styles.procTop}>
                    <span className={styles.code}>{item.code}</span>
                    <span className={styles.desc}>{item.description}</span>
                  </div>
                  {!readOnly ? (
                    <div className={styles.procFields}>
                      <label>
                        {t('dental.treatmentPlan.builder.minutes')}
                        <input
                          type="number" min={5} step={5}
                          value={item.estimatedMinutes}
                          onChange={(e) => {
                            const minutes = Number(e.target.value) || 30;
                            updateItem(phase.id, item.id, { estimatedMinutes: minutes });
                          }}
                        />
                      </label>
                      <label>
                        {t('dental.treatmentPlan.builder.cost')}
                        <input
                          type="number" min={0} step={10}
                          value={item.estimatedCost}
                          onChange={(e) => {
                            const cost = Number(e.target.value) || 0;
                            const { insuranceEstimate, patientPortion } = calcInsuranceDefaults(cost);
                            updateItem(phase.id, item.id, { estimatedCost: cost, insuranceEstimate, patientPortion });
                          }}
                        />
                      </label>
                      <label className={styles.depLabel}>
                        <Link2 size={12} aria-hidden />
                        {t('dental.treatmentPlan.builder.dependsOn')}
                        <select
                          value={item.dependsOnItemId ?? ''}
                          onChange={(e) => updateItem(phase.id, item.id, { dependsOnItemId: e.target.value || null })}
                        >
                          <option value="">{t('dental.treatmentPlan.builder.noDependency')}</option>
                          {dependencyOptions(item).map((dep) => (
                            <option key={dep.id} value={dep.id}>{dep.code} — {dep.description}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  ) : (
                    <p className={styles.procMeta}>
                      {formatDuration(item.estimatedMinutes, locale)} · {formatCurrency(item.estimatedCost, locale, currency)}
                      {item.dependsOnItemId && (
                        <span className={styles.depBadge}>
                          <Link2 size={10} aria-hidden />
                          {t('dental.treatmentPlan.builder.hasDependency')}
                        </span>
                      )}
                    </p>
                  )}
                </div>
                {!readOnly && (
                  <button type="button" className={styles.removeBtn} onClick={() => removeItem(phase.id, item.id)} aria-label={t('dental.treatmentPlan.builder.remove')}>
                    <Trash2 size={14} aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>

          {!readOnly && (
            <div className={styles.addRow}>
              {catalogOpen === phase.id ? (
                <div className={styles.catalog} role="listbox" aria-label={t('dental.treatmentPlan.builder.catalog')}>
                  {PROCEDURE_CATALOG.map((p) => (
                    <button key={p.code} type="button" role="option" className={styles.catalogItem} onClick={() => addProcedure(phase.id, p.code, p.description)}>
                      <span className={styles.code}>{p.code}</span>
                      <span>{p.description}</span>
                      <span className={styles.catalogMeta}>{formatCurrency(p.cost, locale, currency)}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <AuthButton variant="secondary" onClick={() => setCatalogOpen(phase.id)}>
                  <Plus size={14} aria-hidden />
                  {t('dental.treatmentPlan.builder.addProcedure')}
                </AuthButton>
              )}
            </div>
          )}
        </section>
      ))}

      {!readOnly && (
        <AuthButton variant="ghost" onClick={addPhase}>
          <Plus size={14} aria-hidden />
          {t('dental.treatmentPlan.builder.addPhase')}
        </AuthButton>
      )}
    </div>
  );
}
