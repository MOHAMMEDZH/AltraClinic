import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { usePlatformAuth } from '../../../auth/PlatformAuthProvider';
import { hasPermission } from '../../../auth/permissions';
import {
  PlatformAuthApiError,
  type SalesLead,
  type SalesLeadNote,
  type SalesLeadPlanFit,
} from '../../../auth/platform-auth-api';
import { PageLayout } from '../../../layout/PageLayout';
import { Alert, StatusBadge } from '../../../ui';

/**
 * Flexible Step 24 — sales lead detail.
 * Privacy warning on notes. No Trial / entitlement CTAs.
 */
export function SalesLeadDetailPage() {
  const { id = '' } = useParams();
  const { t } = useI18n();
  const { client, withAccessToken, principal } = usePlatformAuth();
  const canManage = hasPermission(principal, 'sales-lead.manage');
  const [lead, setLead] = useState<SalesLead | null>(null);
  const [notes, setNotes] = useState<SalesLeadNote[]>([]);
  const [planFit, setPlanFit] = useState<SalesLeadPlanFit | null>(null);
  const [noteBody, setNoteBody] = useState('');
  const [nextStage, setNextStage] = useState('CONTACTED');
  const [terminalReason, setTerminalReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [detail, noteRows, fit] = await withAccessToken(async (token) => {
        const d = await client.getSalesLead(token, id);
        const n = await client.listSalesLeadNotes(token, id);
        const f = await client.getSalesLeadPlanFit(token, id);
        return [d, n, f] as const;
      });
      setLead(detail);
      setNotes(noteRows);
      setPlanFit(fit);
      setError(null);
    } catch (err) {
      setError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.salesLeads.loadDetailError', 'Unable to load lead.'),
      );
    }
  }, [client, id, withAccessToken, t]);

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

  return (
    <PageLayout
      title={lead?.organizationName ?? t('pages.salesLeads.detailTitle', 'Sales lead')}
      description={t(
        'pages.salesLeads.detailDescription',
        'Commercial pipeline only. Plan-fit is advisory and does not grant entitlements.',
      )}
      actions={
        <Link to="/sales/leads">{t('pages.salesLeads.backToList', 'Back to leads')}</Link>
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
          </dl>

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
        </>
      ) : null}
    </PageLayout>
  );
}
