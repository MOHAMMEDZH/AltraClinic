import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { usePlatformAuth } from '../../../auth/PlatformAuthProvider';
import { hasPermission } from '../../../auth/permissions';
import {
  PlatformAuthApiError,
  type SalesLead,
  type SalesLeadNote,
  type SalesLeadOwnershipHistoryEntry,
  type SalesLeadPlanFit,
  type SalesLeadStageHistoryEntry,
} from '../../../auth/platform-auth-api';
import { PageLayout } from '../../../layout/PageLayout';
import { Alert, ConfirmationDialog, StatusBadge } from '../../../ui';

const DEMO_STATUSES = ['NONE', 'SCHEDULED', 'COMPLETED', 'CANCELLED'] as const;

function parseKeyList(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function keysToRaw(keys: string[] | null | undefined): string {
  return (keys ?? []).join(', ');
}

function parseOptionalIntOrNull(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Flexible Step 24 — sales lead detail.
 * Privacy warning on notes. No Trial / entitlement CTAs.
 */
export function SalesLeadDetailPage() {
  const { id = '' } = useParams();
  const { t } = useI18n();
  const { client, withAccessToken, principal } = usePlatformAuth();
  const canManage = hasPermission(principal, 'sales-lead.manage');
  const canAssign = hasPermission(principal, 'sales-lead.assign');
  const [lead, setLead] = useState<SalesLead | null>(null);
  const [notes, setNotes] = useState<SalesLeadNote[]>([]);
  const [planFit, setPlanFit] = useState<SalesLeadPlanFit | null>(null);
  const [stageHistory, setStageHistory] = useState<SalesLeadStageHistoryEntry[]>([]);
  const [ownershipHistory, setOwnershipHistory] = useState<SalesLeadOwnershipHistoryEntry[]>([]);
  const [noteBody, setNoteBody] = useState('');
  const [nextStage, setNextStage] = useState('CONTACTED');
  const [terminalReason, setTerminalReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [specialtyKeysRaw, setSpecialtyKeysRaw] = useState('');
  const [desiredModuleKeysRaw, setDesiredModuleKeysRaw] = useState('');
  const [estimatedUsers, setEstimatedUsers] = useState('');
  const [estimatedProviders, setEstimatedProviders] = useState('');
  const [estimatedLocations, setEstimatedLocations] = useState('');

  const [nextActionType, setNextActionType] = useState('');
  const [nextActionDueAt, setNextActionDueAt] = useState('');
  const [nextActionNote, setNextActionNote] = useState('');

  const [demoScheduledAt, setDemoScheduledAt] = useState('');
  const [demoTimezone, setDemoTimezone] = useState('');
  const [demoStatus, setDemoStatus] = useState<string>('NONE');
  const [demoNote, setDemoNote] = useState('');

  const [ownerInput, setOwnerInput] = useState('');
  const [ownerConfirmOpen, setOwnerConfirmOpen] = useState(false);
  const [ownerConfirmReason, setOwnerConfirmReason] = useState('');
  const [ownerAssignPending, setOwnerAssignPending] = useState(false);

  const syncEditableFromLead = useCallback((detail: SalesLead) => {
    setSpecialtyKeysRaw(keysToRaw(detail.specialtyKeys));
    setDesiredModuleKeysRaw(keysToRaw(detail.desiredModuleKeys));
    setEstimatedUsers(detail.estimatedUsers != null ? String(detail.estimatedUsers) : '');
    setEstimatedProviders(detail.estimatedProviders != null ? String(detail.estimatedProviders) : '');
    setEstimatedLocations(detail.estimatedLocations != null ? String(detail.estimatedLocations) : '');
    setNextActionType(detail.nextActionType ?? '');
    setNextActionDueAt(toDatetimeLocalValue(detail.nextActionDueAt));
    setNextActionNote(detail.nextActionNote ?? '');
    setDemoScheduledAt(toDatetimeLocalValue(detail.demoScheduledAt));
    setDemoTimezone(detail.demoTimezone ?? '');
    setDemoStatus(detail.demoStatus ?? 'NONE');
    setDemoNote(detail.demoNote ?? '');
    setOwnerInput(detail.ownerRepresentativeId ?? '');
  }, []);

  const load = useCallback(async () => {
    try {
      const [detail, noteRows, fit, stages, ownership] = await withAccessToken(async (token) => {
        const d = await client.getSalesLead(token, id);
        const n = await client.listSalesLeadNotes(token, id);
        const f = await client.getSalesLeadPlanFit(token, id);
        const s = await client.getSalesLeadStageHistory(token, id);
        const o = await client.getSalesLeadOwnershipHistory(token, id);
        return [d, n, f, s, o] as const;
      });
      setLead(detail);
      setNotes(noteRows);
      setPlanFit(fit);
      setStageHistory(stages);
      setOwnershipHistory(ownership);
      syncEditableFromLead(detail);
      setError(null);
    } catch (err) {
      setError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.salesLeads.loadDetailError', 'Unable to load lead.'),
      );
    }
  }, [client, id, withAccessToken, t, syncEditableFromLead]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onAddNote(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    try {
      await withAccessToken((token) => client.addSalesLeadNote(token, id, { body: noteBody }));
      setNoteBody('');
      await load();
    } catch (err) {
      setError(err instanceof PlatformAuthApiError ? err.message : 'Note failed');
    }
  }

  async function onChangeStage() {
    if (!lead || !canManage) return;
    try {
      await withAccessToken((token) =>
        client.changeSalesLeadStage(
          token,
          id,
          { stage: nextStage, expectedRowVersion: lead.rowVersion },
          crypto.randomUUID(),
        ),
      );
      await load();
    } catch (err) {
      setError(err instanceof PlatformAuthApiError ? err.message : 'Stage change failed');
    }
  }

  async function onWon() {
    if (!lead || !canManage) return;
    try {
      await withAccessToken((token) =>
        client.markSalesLeadWon(
          token,
          id,
          { expectedRowVersion: lead.rowVersion, wonLostReason: terminalReason },
          crypto.randomUUID(),
        ),
      );
      await load();
    } catch (err) {
      setError(err instanceof PlatformAuthApiError ? err.message : 'Won failed');
    }
  }

  async function onLost() {
    if (!lead || !canManage) return;
    try {
      await withAccessToken((token) =>
        client.markSalesLeadLost(
          token,
          id,
          { expectedRowVersion: lead.rowVersion, wonLostReason: terminalReason },
          crypto.randomUUID(),
        ),
      );
      await load();
    } catch (err) {
      setError(err instanceof PlatformAuthApiError ? err.message : 'Lost failed');
    }
  }

  async function onSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (!lead || !canManage) return;
    try {
      await withAccessToken((token) =>
        client.updateSalesLead(token, id, {
          expectedRowVersion: lead.rowVersion,
          specialtyKeys: parseKeyList(specialtyKeysRaw),
          desiredModuleKeys: parseKeyList(desiredModuleKeysRaw),
          estimatedUsers: parseOptionalIntOrNull(estimatedUsers),
          estimatedProviders: parseOptionalIntOrNull(estimatedProviders),
          estimatedLocations: parseOptionalIntOrNull(estimatedLocations),
        }),
      );
      await load();
    } catch (err) {
      setError(err instanceof PlatformAuthApiError ? err.message : 'Update failed');
    }
  }

  async function onSaveNextAction(e: FormEvent) {
    e.preventDefault();
    if (!lead || !canManage) return;
    try {
      await withAccessToken((token) =>
        client.updateSalesLead(token, id, {
          expectedRowVersion: lead.rowVersion,
          nextActionType: nextActionType.trim() || null,
          nextActionDueAt: nextActionDueAt ? new Date(nextActionDueAt).toISOString() : null,
          nextActionNote: nextActionNote.trim() || null,
        }),
      );
      await load();
    } catch (err) {
      setError(err instanceof PlatformAuthApiError ? err.message : 'Next action update failed');
    }
  }

  async function onSaveDemo(e: FormEvent) {
    e.preventDefault();
    if (!lead || !canManage) return;
    try {
      await withAccessToken((token) =>
        client.updateSalesLeadDemo(token, id, {
          expectedRowVersion: lead.rowVersion,
          demoStatus,
          demoScheduledAt: demoScheduledAt ? new Date(demoScheduledAt).toISOString() : null,
          demoTimezone: demoTimezone.trim() || null,
          demoNote: demoNote.trim() || null,
        }),
      );
      await load();
    } catch (err) {
      setError(err instanceof PlatformAuthApiError ? err.message : 'Demo update failed');
    }
  }

  function openOwnerConfirm() {
    if (!lead || !canAssign) return;
    setOwnerConfirmReason('');
    setOwnerConfirmOpen(true);
  }

  async function onConfirmOwnerAssign() {
    if (!lead || !canAssign) return;
    setOwnerAssignPending(true);
    try {
      const trimmed = ownerInput.trim();
      await withAccessToken((token) =>
        client.assignSalesLeadOwner(token, id, {
          ownerRepresentativeId: trimmed || null,
          expectedRowVersion: lead.rowVersion,
          reason: ownerConfirmReason.trim() || undefined,
        }),
      );
      setOwnerConfirmOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof PlatformAuthApiError ? err.message : 'Owner assign failed');
      setOwnerConfirmOpen(false);
    } finally {
      setOwnerAssignPending(false);
    }
  }

  return (
    <PageLayout
      title={lead?.organizationName ?? t('pages.salesLeads.detailTitle', 'Sales lead')}
      description={t(
        'pages.salesLeads.detailDescription',
        'Commercial pipeline only. Plan-fit is advisory and does not grant entitlements.',
      )}
      actions={
        <>
          <Link to="/audit">{t('pages.salesLeads.auditCenterLink', 'Open Audit Center')}</Link>
          <Link to="/sales/leads">{t('pages.salesLeads.backToList', 'Back to leads')}</Link>
        </>
      }
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {lead ? (
        <>
          <dl className="sa-definition-list">
            <div>
              <dt>{t('pages.salesLeads.colStage', 'Stage')}</dt>
              <dd>
                <StatusBadge label={lead.stage} tone="neutral" />
              </dd>
            </div>
            <div>
              <dt>{t('pages.salesLeads.colContact', 'Contact')}</dt>
              <dd>
                {lead.contactName}
                {lead.contactEmail ? ` · ${lead.contactEmail}` : ''}
              </dd>
            </div>
            <div>
              <dt>{t('pages.salesLeads.colSource', 'Source')}</dt>
              <dd>{lead.source}</dd>
            </div>
            <div>
              <dt>{t('pages.salesLeads.facilityTypeLabel', 'Facility type key')}</dt>
              <dd>{lead.facilityTypeKey ?? '—'}</dd>
            </div>
            <div>
              <dt>{t('pages.salesLeads.ownerRepresentativeLabel', 'Owner representative id')}</dt>
              <dd>{lead.ownerRepresentativeId ?? '—'}</dd>
            </div>
          </dl>

          {canAssign ? (
            <section className="sa-section">
              <h2>{t('pages.salesLeads.ownerAssignTitle', 'Owner assignment')}</h2>
              <label className="sa-field">
                {t('pages.salesLeads.ownerRepresentativeInputLabel', 'Owner representative UUID')}
                <input
                  value={ownerInput}
                  onChange={(e) => setOwnerInput(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                />
              </label>
              <button className="sa-button sa-button-quiet" type="button" onClick={openOwnerConfirm}>
                {t('pages.salesLeads.ownerAssignConfirmButton', 'Confirm owner reassignment')}
              </button>
            </section>
          ) : null}

          {canManage ? (
            <section className="sa-section">
              <h2>{t('pages.salesLeads.profileNeedsTitle', 'Specialties, modules & size')}</h2>
              <form className="sa-form" onSubmit={onSaveProfile}>
                <label className="sa-field">
                  {t('pages.salesLeads.specialtyKeysLabel', 'Specialty keys (comma-separated)')}
                  <input value={specialtyKeysRaw} onChange={(e) => setSpecialtyKeysRaw(e.target.value)} />
                </label>
                <label className="sa-field">
                  {t('pages.salesLeads.desiredModuleKeysLabel', 'Desired module keys (comma-separated)')}
                  <input
                    value={desiredModuleKeysRaw}
                    onChange={(e) => setDesiredModuleKeysRaw(e.target.value)}
                  />
                </label>
                <label className="sa-field">
                  {t('pages.salesLeads.estimatedUsersLabel', 'Estimated users')}
                  <input
                    type="number"
                    min={0}
                    value={estimatedUsers}
                    onChange={(e) => setEstimatedUsers(e.target.value)}
                  />
                </label>
                <label className="sa-field">
                  {t('pages.salesLeads.estimatedProvidersLabel', 'Estimated providers')}
                  <input
                    type="number"
                    min={0}
                    value={estimatedProviders}
                    onChange={(e) => setEstimatedProviders(e.target.value)}
                  />
                </label>
                <label className="sa-field">
                  {t('pages.salesLeads.estimatedLocationsLabel', 'Estimated locations')}
                  <input
                    type="number"
                    min={0}
                    value={estimatedLocations}
                    onChange={(e) => setEstimatedLocations(e.target.value)}
                  />
                </label>
                <button className="sa-button sa-button-primary" type="submit">
                  {t('pages.salesLeads.saveProfileNeeds', 'Save specialties & size')}
                </button>
              </form>
            </section>
          ) : (
            <section className="sa-section">
              <h2>{t('pages.salesLeads.profileNeedsTitle', 'Specialties, modules & size')}</h2>
              <dl className="sa-definition-list">
                <div>
                  <dt>{t('pages.salesLeads.specialtyKeysLabel', 'Specialty keys (comma-separated)')}</dt>
                  <dd>{keysToRaw(lead.specialtyKeys) || '—'}</dd>
                </div>
                <div>
                  <dt>
                    {t('pages.salesLeads.desiredModuleKeysLabel', 'Desired module keys (comma-separated)')}
                  </dt>
                  <dd>{keysToRaw(lead.desiredModuleKeys) || '—'}</dd>
                </div>
                <div>
                  <dt>{t('pages.salesLeads.estimatedUsersLabel', 'Estimated users')}</dt>
                  <dd>{lead.estimatedUsers ?? '—'}</dd>
                </div>
                <div>
                  <dt>{t('pages.salesLeads.estimatedProvidersLabel', 'Estimated providers')}</dt>
                  <dd>{lead.estimatedProviders ?? '—'}</dd>
                </div>
                <div>
                  <dt>{t('pages.salesLeads.estimatedLocationsLabel', 'Estimated locations')}</dt>
                  <dd>{lead.estimatedLocations ?? '—'}</dd>
                </div>
              </dl>
            </section>
          )}

          {canManage && lead.stage !== 'WON' && lead.stage !== 'LOST' ? (
            <section className="sa-section">
              <h2>{t('pages.salesLeads.stageActions', 'Stage')}</h2>
              <div className="sa-filter-row">
                <select value={nextStage} onChange={(e) => setNextStage(e.target.value)}>
                  {['CONTACTED', 'QUALIFIED', 'DEMO_SCHEDULED', 'PROPOSAL', 'WON', 'LOST'].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <button className="sa-button sa-button-quiet" type="button" onClick={() => void onChangeStage()}>
                  {t('pages.salesLeads.applyStage', 'Apply stage')}
                </button>
              </div>
              <label className="sa-field">
                {t('pages.salesLeads.terminalReasonLabel', 'Won / lost reason')}
                <input value={terminalReason} onChange={(e) => setTerminalReason(e.target.value)} />
              </label>
              <div className="sa-form-actions">
                <button className="sa-button sa-button-quiet" type="button" onClick={() => void onWon()}>
                  {t('pages.salesLeads.markWon', 'Mark won')}
                </button>
                <button className="sa-button sa-button-quiet" type="button" onClick={() => void onLost()}>
                  {t('pages.salesLeads.markLost', 'Mark lost')}
                </button>
              </div>
            </section>
          ) : null}

          {canManage ? (
            <section className="sa-section">
              <h2>{t('pages.salesLeads.nextActionTitle', 'Next action')}</h2>
              <form className="sa-form" onSubmit={onSaveNextAction}>
                <label className="sa-field">
                  {t('pages.salesLeads.nextActionTypeLabel', 'Next action type')}
                  <input value={nextActionType} onChange={(e) => setNextActionType(e.target.value)} />
                </label>
                <label className="sa-field">
                  {t('pages.salesLeads.nextActionDueLabel', 'Next action due')}
                  <input
                    type="datetime-local"
                    value={nextActionDueAt}
                    onChange={(e) => setNextActionDueAt(e.target.value)}
                  />
                </label>
                <label className="sa-field">
                  {t('pages.salesLeads.nextActionNoteLabel', 'Next action note')}
                  <textarea
                    maxLength={500}
                    value={nextActionNote}
                    onChange={(e) => setNextActionNote(e.target.value)}
                  />
                </label>
                <button className="sa-button sa-button-primary" type="submit">
                  {t('pages.salesLeads.saveNextAction', 'Save next action')}
                </button>
              </form>
            </section>
          ) : null}

          {canManage ? (
            <section className="sa-section">
              <h2>{t('pages.salesLeads.demoTitle', 'Demo scheduling')}</h2>
              <form className="sa-form" onSubmit={onSaveDemo}>
                <label className="sa-field">
                  {t('pages.salesLeads.demoScheduledAtLabel', 'Demo datetime')}
                  <input
                    type="datetime-local"
                    value={demoScheduledAt}
                    onChange={(e) => setDemoScheduledAt(e.target.value)}
                  />
                </label>
                <label className="sa-field">
                  {t('pages.salesLeads.demoTimezoneLabel', 'Demo timezone')}
                  <input value={demoTimezone} onChange={(e) => setDemoTimezone(e.target.value)} />
                </label>
                <label className="sa-field">
                  {t('pages.salesLeads.demoStatusLabel', 'Demo status')}
                  <select value={demoStatus} onChange={(e) => setDemoStatus(e.target.value)}>
                    {DEMO_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="sa-field">
                  {t('pages.salesLeads.demoNoteLabel', 'Demo note')}
                  <textarea maxLength={500} value={demoNote} onChange={(e) => setDemoNote(e.target.value)} />
                </label>
                <button className="sa-button sa-button-primary" type="submit">
                  {t('pages.salesLeads.saveDemo', 'Save demo')}
                </button>
              </form>
            </section>
          ) : null}

          <section className="sa-section">
            <h2>{t('pages.salesLeads.stageHistoryTitle', 'Stage history')}</h2>
            {stageHistory.length === 0 ? (
              <p className="sa-muted">{t('pages.salesLeads.historyEmpty', 'No history yet.')}</p>
            ) : (
              <ul>
                {stageHistory.map((h) => (
                  <li key={h.id}>
                    <time dateTime={h.createdAt}>{new Date(h.createdAt).toLocaleString()}</time>
                    {' — '}
                    {h.fromStage ?? '—'} → {h.toStage}
                    {h.reason ? ` (${h.reason})` : ''}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="sa-section">
            <h2>{t('pages.salesLeads.ownershipHistoryTitle', 'Ownership history')}</h2>
            {ownershipHistory.length === 0 ? (
              <p className="sa-muted">{t('pages.salesLeads.historyEmpty', 'No history yet.')}</p>
            ) : (
              <ul>
                {ownershipHistory.map((h) => (
                  <li key={h.id}>
                    <time dateTime={h.createdAt}>{new Date(h.createdAt).toLocaleString()}</time>
                    {' — '}
                    {h.fromOwnerRepresentativeId ?? '—'} → {h.toOwnerRepresentativeId ?? '—'}
                    {h.reason ? ` (${h.reason})` : ''}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="sa-section">
            <h2>{t('pages.salesLeads.planFitTitle', 'Plan-fit (advisory)')}</h2>
            {planFit ? (
              <div>
                <p>
                  {planFit.valid
                    ? t('pages.salesLeads.planFitValid', 'Selection looks compatible.')
                    : t('pages.salesLeads.planFitInvalid', 'Selection has compatibility issues.')}
                </p>
                <p className="sa-muted">
                  {t(
                    'pages.salesLeads.planFitDisclaimer',
                    'Advisory only — does not create tenants, trials, subscriptions, or entitlements.',
                  )}
                </p>
                {planFit.violations.length > 0 ? (
                  <ul>
                    {planFit.violations.map((v) => (
                      <li key={`${v.reasonCode}-${v.message}`}>{v.message}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="sa-section">
            <h2>{t('pages.salesLeads.notesTitle', 'Notes')}</h2>
            <Alert tone="warning">
              {t(
                'pages.salesLeads.notesPrivacyWarning',
                'Do not enter patient or clinical data. Commercial notes only — no PHI, diagnoses, banking, or government IDs.',
              )}
            </Alert>
            {canManage ? (
              <form className="sa-form" onSubmit={onAddNote}>
                <label className="sa-field">
                  {t('pages.salesLeads.noteBodyLabel', 'Note')}
                  <textarea
                    maxLength={2000}
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                    required
                  />
                </label>
                <button className="sa-button sa-button-primary" type="submit">
                  {t('pages.salesLeads.addNote', 'Add note')}
                </button>
              </form>
            ) : null}
            <ul>
              {notes.map((n) => (
                <li key={n.id}>
                  <time dateTime={n.createdAt}>{new Date(n.createdAt).toLocaleString()}</time>
                  {' — '}
                  {n.body}
                </li>
              ))}
            </ul>
          </section>

          <ConfirmationDialog
            open={ownerConfirmOpen}
            title={t('pages.salesLeads.ownerAssignDialogTitle', 'Confirm owner reassignment')}
            description={t(
              'pages.salesLeads.ownerAssignDialogDescription',
              'Reassign this lead’s owner representative. This updates ownership history and does not grant Clinic access.',
            )}
            confirmLabel={t('pages.salesLeads.ownerAssignConfirmButton', 'Confirm owner reassignment')}
            reasonRequired
            reasonLabel={t('pages.salesLeads.ownerAssignReasonLabel', 'Reason')}
            reasonValue={ownerConfirmReason}
            onReasonChange={setOwnerConfirmReason}
            pending={ownerAssignPending}
            onConfirm={() => void onConfirmOwnerAssign()}
            onClose={() => setOwnerConfirmOpen(false)}
          />
        </>
      ) : null}
    </PageLayout>
  );
}
