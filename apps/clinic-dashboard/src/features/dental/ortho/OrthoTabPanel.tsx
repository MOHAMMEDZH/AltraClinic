import { useState } from 'react';

import { Plus } from 'lucide-react';

import { useI18n } from '@booking/i18n/react';

import { AuthButton } from '@/features/auth/components/AuthButton';

import { AuthAlert } from '@/features/auth/components/AuthAlert';

import { EmptyState } from '@/features/patients/components/EmptyState';

import { formatDentalDate } from '../config/dental-config';

import type { OrthodonticCase } from '../types/dental.types';

import {

  useCreateOrthodonticCase,

  useOrthodonticCases,

  useUpdateOrthodonticCase,

} from '../hooks/useDentalExtended';

import styles from './OrthoTabPanel.module.css';



interface OrthoTabPanelProps {

  patientId: string;

  canEdit: boolean;

}



interface WireChange {

  id: string;

  date: string;

  wire: string;

  notes?: string;

}



function wireChangesFrom(caseRow: OrthodonticCase): WireChange[] {

  const raw = caseRow.clinicalData?.wireChanges;

  return Array.isArray(raw) ? (raw as WireChange[]) : [];

}



function progressNotesFrom(caseRow: OrthodonticCase): string {

  const notes = caseRow.clinicalData?.progressNotes;

  return typeof notes === 'string' ? notes : '';

}



export function OrthoTabPanel({ patientId, canEdit }: OrthoTabPanelProps) {

  const { t, locale } = useI18n();

  const casesQuery = useOrthodonticCases(patientId);

  const createMutation = useCreateOrthodonticCase();

  const updateMutation = useUpdateOrthodonticCase(patientId);

  const [applianceType, setApplianceType] = useState('Metal braces');

  const [error, setError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [draftWire, setDraftWire] = useState({ date: new Date().toISOString().slice(0, 10), wire: '', notes: '' });

  const [draftProgress, setDraftProgress] = useState<Record<string, string>>({});



  const items = casesQuery.data?.items ?? [];



  async function handleCreate() {

    setError(null);

    try {

      await createMutation.mutateAsync({

        patientId,

        applianceType,

        startDate: new Date().toISOString().slice(0, 10),

      });

    } catch {

      setError(t('dental.ortho.errors.create'));

    }

  }



  async function saveClinicalData(caseRow: OrthodonticCase, clinicalData: Record<string, unknown>) {

    setError(null);

    try {

      await updateMutation.mutateAsync({ caseId: caseRow.id, body: { clinicalData } });

    } catch {

      setError(t('dental.ortho.errors.save'));

    }

  }



  async function addWireChange(caseRow: OrthodonticCase) {

    if (!draftWire.wire.trim()) return;

    const next = [

      ...wireChangesFrom(caseRow),

      { id: crypto.randomUUID(), date: draftWire.date, wire: draftWire.wire.trim(), notes: draftWire.notes.trim() || undefined },

    ];

    await saveClinicalData(caseRow, { ...caseRow.clinicalData, wireChanges: next });

    setDraftWire({ date: new Date().toISOString().slice(0, 10), wire: '', notes: '' });

  }



  return (

    <div className={styles.wrap}>

      <header className={styles.header}>

        <div>

          <h2 className={styles.title}>{t('dental.ortho.title')}</h2>

          <p className={styles.subtitle}>{t('dental.ortho.subtitle')}</p>

        </div>

        {canEdit && (

          <div className={styles.createRow}>

            <label className={styles.srOnly} htmlFor="ortho-appliance">{t('dental.ortho.appliance')}</label>

            <select id="ortho-appliance" value={applianceType} onChange={(e) => setApplianceType(e.target.value)}>

              <option value="Metal braces">{t('dental.ortho.appliances.metal')}</option>

              <option value="Ceramic braces">{t('dental.ortho.appliances.ceramic')}</option>

              <option value="Clear aligners">{t('dental.ortho.appliances.aligners')}</option>

              <option value="Lingual braces">{t('dental.ortho.appliances.lingual')}</option>

            </select>

            <AuthButton loading={createMutation.isPending} onClick={() => void handleCreate()}>

              <Plus size={16} aria-hidden />

              {t('dental.ortho.newCase')}

            </AuthButton>

          </div>

        )}

      </header>



      {error && <AuthAlert variant="error">{error}</AuthAlert>}



      {casesQuery.isLoading ? (

        <div className={styles.skeleton} aria-busy="true" />

      ) : !items.length ? (

        <EmptyState title={t('dental.ortho.empty.title')} description={t('dental.ortho.empty.description')} />

      ) : (

        <ul className={styles.list}>

          {items.map((c) => {

            const expanded = expandedId === c.id;

            const wires = wireChangesFrom(c);

            const progressValue = draftProgress[c.id] ?? progressNotesFrom(c);

            return (

              <li key={c.id} className={styles.card}>

                <div className={styles.cardHead}>

                  <strong>{c.applianceType}</strong>

                  <span className={styles.badge}>{t(`dental.ortho.status.${c.status}`)}</span>

                </div>

                <dl className={styles.dl}>

                  <div><dt>{t('dental.ortho.start')}</dt><dd>{c.startDate ?? '—'}</dd></div>

                  <div><dt>{t('dental.ortho.estimatedEnd')}</dt><dd>{c.estimatedEndDate ?? '—'}</dd></div>

                  <div><dt>{t('dental.ortho.updated')}</dt><dd>{formatDentalDate(c.updatedAt, locale)}</dd></div>

                </dl>

                {c.notes && <p className={styles.notes}>{c.notes}</p>}

                <AuthButton variant="ghost" onClick={() => setExpandedId(expanded ? null : c.id)}>

                  {expanded ? t('dental.ortho.hideProgress') : t('dental.ortho.showProgress')}

                </AuthButton>

                {expanded && (

                  <div className={styles.progressPanel}>

                    <h3 className={styles.subTitle}>{t('dental.ortho.wireChanges')}</h3>

                    {wires.length === 0 ? (

                      <p className={styles.muted}>{t('dental.ortho.noWireChanges')}</p>

                    ) : (

                      <ul className={styles.wireList}>

                        {wires.map((w) => (

                          <li key={w.id}>

                            <time dateTime={w.date}>{w.date}</time> — {w.wire}

                            {w.notes && <span className={styles.wireNotes}>{w.notes}</span>}

                          </li>

                        ))}

                      </ul>

                    )}

                    {canEdit && c.status === 'active' && (

                      <div className={styles.wireForm}>

                        <label>

                          {t('dental.ortho.wireDate')}

                          <input type="date" value={draftWire.date} onChange={(e) => setDraftWire((d) => ({ ...d, date: e.target.value }))} />

                        </label>

                        <label>

                          {t('dental.ortho.wireSpec')}

                          <input value={draftWire.wire} onChange={(e) => setDraftWire((d) => ({ ...d, wire: e.target.value }))} placeholder="0.016 NiTi" />

                        </label>

                        <label>

                          {t('dental.ortho.wireNotes')}

                          <input value={draftWire.notes} onChange={(e) => setDraftWire((d) => ({ ...d, notes: e.target.value }))} />

                        </label>

                        <AuthButton variant="secondary" loading={updateMutation.isPending} onClick={() => void addWireChange(c)}>

                          {t('dental.ortho.addWireChange')}

                        </AuthButton>

                      </div>

                    )}

                    <h3 className={styles.subTitle}>{t('dental.ortho.progressNotes')}</h3>

                    {canEdit && c.status === 'active' ? (

                      <>

                        <textarea

                          className={styles.progressArea}

                          rows={3}

                          value={progressValue}

                          onChange={(e) => setDraftProgress((prev) => ({ ...prev, [c.id]: e.target.value }))}

                          placeholder={t('dental.ortho.progressPlaceholder')}

                        />

                        <AuthButton

                          loading={updateMutation.isPending}

                          onClick={() =>

                            void saveClinicalData(c, {

                              ...c.clinicalData,

                              progressNotes: progressValue,

                              wireChanges: wires,

                            })

                          }

                        >

                          {t('dental.ortho.saveProgress')}

                        </AuthButton>

                      </>

                    ) : progressValue ? (

                      <p className={styles.notes}>{progressValue}</p>

                    ) : (

                      <p className={styles.muted}>{t('dental.ortho.noProgressNotes')}</p>

                    )}

                  </div>

                )}

                {canEdit && c.status === 'active' && (

                  <AuthButton

                    variant="secondary"

                    loading={updateMutation.isPending}

                    onClick={() =>

                      void updateMutation.mutateAsync({

                        caseId: c.id,

                        body: { status: 'retention' },

                      })

                    }

                  >

                    {t('dental.ortho.moveToRetention')}

                  </AuthButton>

                )}

              </li>

            );

          })}

        </ul>

      )}

    </div>

  );

}


