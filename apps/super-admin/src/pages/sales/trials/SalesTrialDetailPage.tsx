import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { usePlatformAuth } from '../../../auth/PlatformAuthProvider';
import { hasPermission } from '../../../auth/permissions';
import {
  PlatformAuthApiError,
  type SalesTrial,
  type SalesTrialEntitlementPreview,
  type SalesTrialGrantDisposition,
  type SalesTrialGrantDispositionEntry,
  type SalesTrialHistory,
} from '../../../auth/platform-auth-api';
import { PageLayout } from '../../../layout/PageLayout';
import { Alert, ConfirmationDialog, StatusBadge } from '../../../ui';

const DISPOSITIONS: readonly SalesTrialGrantDisposition[] = [
  'EXPIRE_ON_CONVERSION',
  'MIGRATE_TO_PAID_EQUIVALENT',
  'RETAIN_NOT_TRIAL_ONLY',
  'EXPIRE_ON_TRIAL_EXPIRY',
];

function statusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === 'ACTIVE' || status === 'CONVERTED') return 'success';
  if (status === 'EXPIRED') return 'warning';
  if (status === 'CANCELLED') return 'danger';
  return 'neutral';
}

/**
 * Flexible Step 25 — Trial detail: extend, preview, convert, cancel, history.
 * The entitlement preview is advisory and read-only; conversion is the only
 * action that moves the commercial configuration to a paid plan version.
 */
export function SalesTrialDetailPage() {
  const { id = '' } = useParams();
  const { t } = useI18n();
  const { client, withAccessToken, principal } = usePlatformAuth();
  const canUpdate = hasPermission(principal, 'trial.update');
  const canExtend = hasPermission(principal, 'trial.extend');
  const canExtendExceptional = hasPermission(principal, 'trial.extend.exceptional');
  const canConvert = hasPermission(principal, 'trial.convert');
  const canPreview = hasPermission(principal, 'trial.preview-entitlements');

  const [trial, setTrial] = useState<SalesTrial | null>(null);
  const [history, setHistory] = useState<SalesTrialHistory | null>(null);
  const [preview, setPreview] = useState<SalesTrialEntitlementPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [extensionDays, setExtensionDays] = useState('7');
  const [extensionReason, setExtensionReason] = useState('');
  const [exceptional, setExceptional] = useState(false);

  const [targetPlanVersionId, setTargetPlanVersionId] = useState('');
  const [dispositions, setDispositions] = useState<Record<string, SalesTrialGrantDisposition>>({});
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertReason, setConvertReason] = useState('');
  const [convertPending, setConvertPending] = useState(false);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelPending, setCancelPending] = useState(false);

  const load = useCallback(async () => {
    try {
      const [detail, historyRows] = await withAccessToken(async (token) => {
        const d = await client.getSalesTrial(token, id);
        const h = await client.getSalesTrialHistory(token, id);
        return [d, h] as const;
      });
      setTrial(detail);
      setHistory(historyRows);
      setError(null);
    } catch (err) {
      setError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.salesTrials.loadDetailError', 'Unable to load trial.'),
      );
    }
  }, [client, id, withAccessToken, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onExtend(e: FormEvent) {
    e.preventDefault();
    if (!trial || !canExtend) return;
    try {
      await withAccessToken((token) =>
        client.extendSalesTrial(
          token,
          id,
          {
            extensionDays: Math.trunc(Number(extensionDays) || 0),
            reason: extensionReason,
            expectedRowVersion: trial.rowVersion,
            ...(exceptional ? { exceptional: true } : {}),
          },
          crypto.randomUUID(),
        ),
      );
      setExtensionReason('');
      setExceptional(false);
      setNotice(t('pages.salesTrials.extendSuccess', 'Trial extended.'));
      await load();
    } catch (err) {
      setError(err instanceof PlatformAuthApiError ? err.message : 'Extension failed');
    }
  }

  async function onPreview(e: FormEvent) {
    e.preventDefault();
    if (!canPreview) return;
    try {
      const result = await withAccessToken((token) =>
        client.getSalesTrialEntitlementPreview(token, id, targetPlanVersionId.trim()),
      );
      setPreview(result);
      setDispositions((current) => {
        const next = { ...current };
        for (const key of result.requiredDispositionGrantKeys) {
          next[key] = next[key] ?? 'EXPIRE_ON_CONVERSION';
        }
        return next;
      });
      setError(null);
    } catch (err) {
      setError(err instanceof PlatformAuthApiError ? err.message : 'Preview failed');
    }
  }

  async function onConfirmConvert() {
    if (!trial || !canConvert) return;
    setConvertPending(true);
    try {
      const payload: SalesTrialGrantDispositionEntry[] = Object.entries(dispositions).map(
        ([grantKey, disposition]) => ({ grantKey, disposition }),
      );
      await withAccessToken((token) =>
        client.convertSalesTrial(
          token,
          id,
          {
            targetPaidPlanVersionId: targetPlanVersionId.trim(),
            expectedRowVersion: trial.rowVersion,
            ...(payload.length ? { dispositions: payload } : {}),
            ...(convertReason.trim() ? { reason: convertReason.trim() } : {}),
          },
          crypto.randomUUID(),
        ),
      );
      setConvertOpen(false);
      setNotice(t('pages.salesTrials.convertSuccess', 'Trial converted to a paid subscription.'));
      await load();
    } catch (err) {
      setError(err instanceof PlatformAuthApiError ? err.message : 'Conversion failed');
      setConvertOpen(false);
    } finally {
      setConvertPending(false);
    }
  }

  async function onConfirmCancel() {
    if (!trial || !canUpdate) return;
    setCancelPending(true);
    try {
      await withAccessToken((token) =>
        client.cancelSalesTrial(
          token,
          id,
          { reason: cancelReason.trim(), expectedRowVersion: trial.rowVersion },
          crypto.randomUUID(),
        ),
      );
      setCancelOpen(false);
      setNotice(t('pages.salesTrials.cancelSuccess', 'Trial cancelled.'));
      await load();
    } catch (err) {
      setError(err instanceof PlatformAuthApiError ? err.message : 'Cancellation failed');
      setCancelOpen(false);
    } finally {
      setCancelPending(false);
    }
  }

  const extensionsRemaining = trial ? Math.max(0, trial.maxExtensions - trial.extensionCount) : 0;

  return (
    <PageLayout
      title={trial?.organizationName ?? t('pages.salesTrials.detailTitle', 'Trial')}
      description={t(
        'pages.salesTrials.detailDescription',
        'Governance actions only. Entitlements and limits always resolve from the commercial snapshot and the entitlement runtime.',
      )}
      actions={
        <>
          <Link to="/audit">{t('pages.salesTrials.auditCenterLink', 'Open Audit Center')}</Link>
          <Link to="/sales/trials">{t('pages.salesTrials.backToList', 'Back to trials')}</Link>
        </>
      }
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {trial ? (
        <>
          <dl className="sa-definition-list">
            <div>
              <dt>{t('pages.salesTrials.colStatus', 'Status')}</dt>
              <dd>
                <StatusBadge label={trial.status} tone={statusTone(trial.status)} />
              </dd>
            </div>
            <div>
              <dt>{t('pages.salesTrials.startsAtLabel', 'Starts')}</dt>
              <dd>{trial.startsAt ? new Date(trial.startsAt).toLocaleString() : '—'}</dd>
            </div>
            <div>
              <dt>{t('pages.salesTrials.expiresAtLabel', 'Expires')}</dt>
              <dd>{trial.expiresAt ? new Date(trial.expiresAt).toLocaleString() : '—'}</dd>
            </div>
            <div>
              <dt>{t('pages.salesTrials.extensionBudgetLabel', 'Extensions used')}</dt>
              <dd>
                {trial.extensionCount}/{trial.maxExtensions}
              </dd>
            </div>
            <div>
              <dt>{t('pages.salesTrials.trialPlanVersionLabel', 'Trial plan version id')}</dt>
              <dd>{trial.trialPlanVersionId}</dd>
            </div>
            <div>
              <dt>{t('pages.salesTrials.tenantLabel', 'Platform tenant id')}</dt>
              <dd>{trial.platformTenantId ?? '—'}</dd>
            </div>
            <div>
              <dt>{t('pages.salesTrials.facilityTypeLabel', 'Facility type key')}</dt>
              <dd>{trial.facilityTypeKey}</dd>
            </div>
            <div>
              <dt>{t('pages.salesTrials.ownerRepresentativeLabel', 'Owner representative id')}</dt>
              <dd>{trial.ownerRepresentativeId ?? '—'}</dd>
            </div>
            <div>
              <dt>{t('pages.salesTrials.originatingLeadLabel', 'Originating lead id')}</dt>
              <dd>{trial.originatingLeadId ?? '—'}</dd>
            </div>
          </dl>

          <section className="sa-section">
            <h2>{t('pages.salesTrials.attributionTitle', 'Sales attribution (frozen)')}</h2>
            <p className="sa-muted">
              {t(
                'pages.salesTrials.attributionFrozenNote',
                'Attribution is frozen when the trial is created and is retained through conversion.',
              )}
            </p>
            <dl className="sa-definition-list">
              <div>
                <dt>{t('pages.salesTrials.attributionFrozenAtLabel', 'Frozen at')}</dt>
                <dd>
                  {trial.attributionSnapshot
                    ? new Date(trial.attributionSnapshot.frozenAt).toLocaleString()
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>{t('pages.salesTrials.attributionOwnerLabel', 'Attributed representative')}</dt>
                <dd>{trial.attributionSnapshot?.ownerRepresentativeId ?? '—'}</dd>
              </div>
            </dl>
          </section>

          {canExtend && trial.status === 'ACTIVE' ? (
            <section className="sa-section">
              <h2>{t('pages.salesTrials.extendTitle', 'Extend trial')}</h2>
              {extensionsRemaining === 0 ? (
                <Alert tone="warning">
                  {t(
                    'pages.salesTrials.extendBudgetExhausted',
                    'The extension budget for this trial is exhausted. An exceptional extension requires elevated authority.',
                  )}
                </Alert>
              ) : null}
              <form className="sa-form" onSubmit={onExtend}>
                <label className="sa-field">
                  {t('pages.salesTrials.extensionDaysLabel', 'Extension days')}
                  <input
                    type="number"
                    min={1}
                    max={30}
                    required
                    value={extensionDays}
                    onChange={(e) => setExtensionDays(e.target.value)}
                  />
                </label>
                <label className="sa-field">
                  {t('pages.salesTrials.extensionReasonLabel', 'Extension reason')}
                  <textarea
                    maxLength={1000}
                    required
                    value={extensionReason}
                    onChange={(e) => setExtensionReason(e.target.value)}
                  />
                </label>
                {canExtendExceptional ? (
                  <label className="sa-field sa-field-inline">
                    <input
                      type="checkbox"
                      checked={exceptional}
                      onChange={(e) => setExceptional(e.target.checked)}
                    />
                    {t('pages.salesTrials.exceptionalLabel', 'Exceptional extension beyond policy')}
                  </label>
                ) : null}
                <button className="sa-button sa-button-primary" type="submit">
                  {t('pages.salesTrials.extendSubmit', 'Extend trial')}
                </button>
              </form>
            </section>
          ) : null}

          {canPreview ? (
            <section className="sa-section">
              <h2>{t('pages.salesTrials.previewTitle', 'Entitlement comparison preview')}</h2>
              <Alert tone="info">
                {t(
                  'pages.salesTrials.previewDisclaimer',
                  'Read-only comparison. It does not change entitlements, limits, subscriptions, or provisioning.',
                )}
              </Alert>
              <form className="sa-form" onSubmit={onPreview}>
                <label className="sa-field">
                  {t('pages.salesTrials.targetPlanVersionLabel', 'Target paid plan version id')}
                  <input
                    required
                    value={targetPlanVersionId}
                    onChange={(e) => setTargetPlanVersionId(e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  />
                </label>
                <button className="sa-button sa-button-quiet" type="submit">
                  {t('pages.salesTrials.previewSubmit', 'Preview comparison')}
                </button>
              </form>
              {preview ? (
                <div className="sa-section">
                  <h3>{t('pages.salesTrials.previewEntitlementsTitle', 'Entitlements')}</h3>
                  <ul>
                    <li>
                      {t('pages.salesTrials.previewRetained', 'Retained')}:{' '}
                      {preview.retainedEntitlements.join(', ') || '—'}
                    </li>
                    <li>
                      {t('pages.salesTrials.previewAdded', 'Added')}:{' '}
                      {preview.addedEntitlements.join(', ') || '—'}
                    </li>
                    <li>
                      {t('pages.salesTrials.previewRemoved', 'Removed')}:{' '}
                      {preview.removedEntitlements.join(', ') || '—'}
                    </li>
                  </ul>
                  <h3>{t('pages.salesTrials.previewLimitsTitle', 'Limits')}</h3>
                  {preview.limits.length === 0 ? (
                    <p className="sa-muted">
                      {t('pages.salesTrials.previewNoLimits', 'No limit differences.')}
                    </p>
                  ) : (
                    <div className="sa-table-wrap">
                      <table className="sa-table">
                        <caption className="sa-visually-hidden">
                          {t('pages.salesTrials.previewLimitsTitle', 'Limits')}
                        </caption>
                        <thead>
                          <tr>
                            <th>{t('pages.salesTrials.previewLimitKey', 'Limit key')}</th>
                            <th>{t('pages.salesTrials.previewLimitTrial', 'Trial')}</th>
                            <th>{t('pages.salesTrials.previewLimitPaid', 'Paid')}</th>
                            <th>
                              {t('pages.salesTrials.previewLimitClassification', 'Classification')}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.limits.map((limit) => (
                            <tr key={limit.canonicalKey}>
                              <td>{limit.canonicalKey}</td>
                              <td>
                                {limit.trialState}
                                {limit.trialValue ? ` (${limit.trialValue})` : ''}
                              </td>
                              <td>
                                {limit.paidState}
                                {limit.paidValue ? ` (${limit.paidValue})` : ''}
                              </td>
                              <td>{limit.classification}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {preview.unconfiguredVsUnlimited.length > 0 ? (
                    <Alert tone="warning">
                      {t(
                        'pages.salesTrials.previewUnconfiguredWarning',
                        'Unconfigured and unlimited are different states. Review the flagged limits before converting.',
                      )}
                    </Alert>
                  ) : null}
                  {preview.incompatibilities.length > 0 ? (
                    <ul>
                      {preview.incompatibilities.map((issue) => (
                        <li key={`${issue.reasonCode}-${issue.message}`}>{issue.message}</li>
                      ))}
                    </ul>
                  ) : null}
                  {preview.requiredDispositionGrantKeys.length > 0 ? (
                    <div>
                      <h3>
                        {t('pages.salesTrials.dispositionsTitle', 'Trial-only grant dispositions')}
                      </h3>
                      <p className="sa-muted">
                        {t(
                          'pages.salesTrials.dispositionsRequiredNote',
                          'Every trial-only grant needs an explicit disposition before conversion.',
                        )}
                      </p>
                      {preview.requiredDispositionGrantKeys.map((grantKey) => (
                        <label className="sa-field" key={grantKey}>
                          {grantKey}
                          <select
                            value={dispositions[grantKey] ?? 'EXPIRE_ON_CONVERSION'}
                            onChange={(e) =>
                              setDispositions((current) => ({
                                ...current,
                                [grantKey]: e.target.value as SalesTrialGrantDisposition,
                              }))
                            }
                          >
                            {DISPOSITIONS.map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}

          {canConvert && trial.status === 'ACTIVE' ? (
            <section className="sa-section">
              <h2>{t('pages.salesTrials.convertTitle', 'Convert to paid')}</h2>
              <p className="sa-muted">
                {t(
                  'pages.salesTrials.convertNote',
                  'Conversion requires a published paid plan version and keeps the original sales attribution.',
                )}
              </p>
              <button
                className="sa-button sa-button-primary"
                type="button"
                onClick={() => {
                  setConvertReason('');
                  setConvertOpen(true);
                }}
              >
                {t('pages.salesTrials.convertButton', 'Convert trial')}
              </button>
            </section>
          ) : null}

          {canUpdate && trial.status !== 'CONVERTED' && trial.status !== 'CANCELLED' ? (
            <section className="sa-section">
              <h2>{t('pages.salesTrials.cancelTitle', 'Cancel trial')}</h2>
              <button
                className="sa-button sa-button-quiet"
                type="button"
                onClick={() => {
                  setCancelReason('');
                  setCancelOpen(true);
                }}
              >
                {t('pages.salesTrials.cancelButton', 'Cancel trial')}
              </button>
            </section>
          ) : null}

          <section className="sa-section">
            <h2>{t('pages.salesTrials.extensionHistoryTitle', 'Extension history')}</h2>
            {!history || history.extensions.length === 0 ? (
              <p className="sa-muted">{t('pages.salesTrials.historyEmpty', 'No history yet.')}</p>
            ) : (
              <ul>
                {history.extensions.map((ext) => (
                  <li key={ext.id}>
                    <time dateTime={ext.createdAt}>
                      {new Date(ext.createdAt).toLocaleString()}
                    </time>
                    {' — '}
                    {ext.extensionDays}
                    {t('pages.salesTrials.daysSuffix', 'd')}
                    {': '}
                    {new Date(ext.previousExpiresAt).toLocaleString()} →{' '}
                    {new Date(ext.newExpiresAt).toLocaleString()}
                    {ext.exceptional
                      ? ` (${t('pages.salesTrials.exceptionalTag', 'exceptional')})`
                      : ''}
                    {` — ${ext.reason}`}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="sa-section">
            <h2>{t('pages.salesTrials.conversionRecordTitle', 'Conversion record')}</h2>
            {history?.conversion ? (
              <dl className="sa-definition-list">
                <div>
                  <dt>{t('pages.salesTrials.convertedAtLabel', 'Converted at')}</dt>
                  <dd>{new Date(history.conversion.convertedAt).toLocaleString()}</dd>
                </div>
                <div>
                  <dt>{t('pages.salesTrials.targetPlanVersionLabel', 'Target paid plan version id')}</dt>
                  <dd>{history.conversion.targetPaidPlanVersionId}</dd>
                </div>
              </dl>
            ) : (
              <p className="sa-muted">
                {t('pages.salesTrials.noConversion', 'This trial has not been converted.')}
              </p>
            )}
          </section>

          <section className="sa-section">
            <h2>{t('pages.salesTrials.auditTrailTitle', 'Governance audit trail')}</h2>
            {!history || history.audits.length === 0 ? (
              <p className="sa-muted">{t('pages.salesTrials.historyEmpty', 'No history yet.')}</p>
            ) : (
              <ul>
                {history.audits.map((entry) => (
                  <li key={entry.id}>
                    <time dateTime={entry.createdAt}>
                      {new Date(entry.createdAt).toLocaleString()}
                    </time>
                    {' — '}
                    {entry.action}
                    {entry.reason ? ` (${entry.reason})` : ''}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <ConfirmationDialog
            open={convertOpen}
            title={t('pages.salesTrials.convertDialogTitle', 'Confirm trial conversion')}
            description={t(
              'pages.salesTrials.convertDialogDescription',
              'This moves the tenant commercial configuration to the target published paid plan version and closes the trial.',
            )}
            confirmLabel={t('pages.salesTrials.convertButton', 'Convert trial')}
            reasonRequired
            reasonLabel={t('pages.salesTrials.convertReasonLabel', 'Reason')}
            reasonValue={convertReason}
            onReasonChange={setConvertReason}
            pending={convertPending}
            onConfirm={() => void onConfirmConvert()}
            onClose={() => setConvertOpen(false)}
          />

          <ConfirmationDialog
            open={cancelOpen}
            title={t('pages.salesTrials.cancelDialogTitle', 'Confirm trial cancellation')}
            description={t(
              'pages.salesTrials.cancelDialogDescription',
              'Cancelling ends the trial immediately and suspends the provisioned tenant.',
            )}
            confirmLabel={t('pages.salesTrials.cancelButton', 'Cancel trial')}
            danger
            reasonRequired
            reasonLabel={t('pages.salesTrials.cancelReasonLabel', 'Reason')}
            reasonValue={cancelReason}
            onReasonChange={setCancelReason}
            pending={cancelPending}
            onConfirm={() => void onConfirmCancel()}
            onClose={() => setCancelOpen(false)}
          />
        </>
      ) : null}
    </PageLayout>
  );
}
