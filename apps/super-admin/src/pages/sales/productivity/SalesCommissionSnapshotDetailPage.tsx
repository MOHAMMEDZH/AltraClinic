import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { usePlatformAuth } from '../../../auth/PlatformAuthProvider';
import { hasPermission } from '../../../auth/permissions';
import {
  PlatformAuthApiError,
  type SalesCommissionPaidStatus,
  type SalesCommissionReviewStatus,
  type SalesCommissionSnapshot,
} from '../../../auth/platform-auth-api';
import { PageLayout } from '../../../layout/PageLayout';
import { Alert, StatusBadge } from '../../../ui';

function statusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === 'FINALIZED') return 'success';
  if (status === 'SUPERSEDED') return 'warning';
  return 'neutral';
}

/**
 * Flexible Step 26 — commission snapshot detail / review / administrative paid marker.
 * Never invents amounts; calculationStatus is always UNCONFIGURED here.
 */
export function SalesCommissionSnapshotDetailPage() {
  const { id = '' } = useParams();
  const { t } = useI18n();
  const { client, withAccessToken, principal } = usePlatformAuth();
  const canReview = hasPermission(principal, 'commission-snapshot.review');
  const canMarkPaid = hasPermission(principal, 'commission-snapshot.mark-paid');

  const [snapshot, setSnapshot] = useState<SalesCommissionSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reviewStatus, setReviewStatus] = useState<SalesCommissionReviewStatus>('IN_REVIEW');
  const [reviewReason, setReviewReason] = useState('');
  const [paidStatus, setPaidStatus] = useState<SalesCommissionPaidStatus>('PAID');
  const [paidReason, setPaidReason] = useState('');
  const [paidReference, setPaidReference] = useState('');

  const load = useCallback(async () => {
    try {
      const row = await withAccessToken((token) => client.getSalesCommissionSnapshot(token, id));
      setSnapshot(row);
      setReviewStatus(row.reviewStatus === 'NONE' ? 'IN_REVIEW' : row.reviewStatus);
      setPaidStatus(row.paidStatus === 'UNPAID' ? 'PAID' : 'UNPAID');
      setError(null);
    } catch (err) {
      setSnapshot(null);
      setError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.salesCommissions.loadDetailError', 'Unable to load commission snapshot.'),
      );
    }
  }, [client, id, withAccessToken, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onReview(e: FormEvent) {
    e.preventDefault();
    if (!snapshot) return;
    setNotice(null);
    try {
      const updated = await withAccessToken((token) =>
        client.reviewSalesCommissionSnapshot(
          token,
          snapshot.id,
          {
            reviewStatus,
            expectedRowVersion: snapshot.rowVersion,
            reason: reviewReason.trim() || undefined,
          },
          crypto.randomUUID(),
        ),
      );
      setSnapshot(updated);
      setNotice(t('pages.salesCommissions.reviewSuccess', 'Review status updated.'));
    } catch (err) {
      setError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.salesCommissions.reviewError', 'Unable to update review status.'),
      );
    }
  }

  async function onMarkPaid(e: FormEvent) {
    e.preventDefault();
    if (!snapshot) return;
    setNotice(null);
    try {
      const updated = await withAccessToken((token) =>
        client.markSalesCommissionSnapshotPaid(
          token,
          snapshot.id,
          {
            paidStatus,
            expectedRowVersion: snapshot.rowVersion,
            paidReason: paidReason.trim() || undefined,
            paidReference: paidReference.trim() || undefined,
          },
          crypto.randomUUID(),
        ),
      );
      setSnapshot(updated);
      setNotice(
        t(
          'pages.salesCommissions.markPaidSuccess',
          'Administrative paid status updated. No money was moved.',
        ),
      );
    } catch (err) {
      setError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.salesCommissions.markPaidError', 'Unable to update paid status.'),
      );
    }
  }

  return (
    <PageLayout
      title={
        snapshot
          ? t('pages.salesCommissions.detailTitle', 'Commission snapshot').concat(
              ` · ${snapshot.periodKey}`,
            )
          : t('pages.salesCommissions.detailTitle', 'Commission snapshot')
      }
      description={t(
        'pages.salesCommissions.detailDescription',
        'Review record. Calculation remains UNCONFIGURED — commission rates are not invented on this surface.',
      )}
      actions={
        <>
          <Link to="/audit">{t('pages.salesCommissions.auditCenterLink', 'Open Audit Center')}</Link>
          <Link to="/sales/commission-snapshots">
            {t('pages.salesCommissions.backToList', 'Back to snapshots')}
          </Link>
        </>
      }
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      {snapshot ? (
        <>
          <p className="sa-muted" data-testid="commission-admin-notice">
            {t(
              'pages.salesCommissions.paidAdminNotice',
              'Paid status records an administrative state only and does not execute payment, payroll, bank transfer, or tax filing.',
            )}
          </p>

          <dl className="sa-definition-list">
            <div>
              <dt>{t('pages.salesCommissions.colStatus', 'Status')}</dt>
              <dd>
                <StatusBadge label={snapshot.status} tone={statusTone(snapshot.status)} />
              </dd>
            </div>
            <div>
              <dt>{t('pages.salesCommissions.colReview', 'Review')}</dt>
              <dd>{snapshot.reviewStatus}</dd>
            </div>
            <div>
              <dt>{t('pages.salesCommissions.colPaid', 'Paid (admin)')}</dt>
              <dd>
                <StatusBadge
                  label={snapshot.paidStatus}
                  tone={snapshot.paidStatus === 'PAID' ? 'success' : 'neutral'}
                />
              </dd>
            </div>
            <div>
              <dt>{t('pages.salesCommissions.colCalculation', 'Calculation')}</dt>
              <dd data-testid="calculation-status">
                <StatusBadge label={snapshot.calculationStatus} tone="warning" />
              </dd>
            </div>
            <div>
              <dt>{t('pages.salesCommissions.computedAmountLabel', 'Computed amount')}</dt>
              <dd data-testid="computed-amount">
                {snapshot.computedAmount ??
                  t('pages.salesCommissions.amountUnconfigured', '— (rates UNCONFIGURED)')}
              </dd>
            </div>
            <div>
              <dt>{t('pages.salesCommissions.formulaVersionLabel', 'Formula version')}</dt>
              <dd>
                <code>{snapshot.formulaVersion}</code>
              </dd>
            </div>
            <div>
              <dt>{t('pages.salesCommissions.colRepresentative', 'Representative')}</dt>
              <dd>
                <code>{snapshot.representativeId}</code>
              </dd>
            </div>
            <div>
              <dt>{t('pages.salesCommissions.periodTimezoneLabel', 'Period timezone')}</dt>
              <dd>{snapshot.periodTimezone}</dd>
            </div>
            <div>
              <dt>{t('pages.salesCommissions.sourceCutoffLabel', 'Source cutoff')}</dt>
              <dd>
                <time dateTime={snapshot.sourceCutoffAt}>
                  {new Date(snapshot.sourceCutoffAt).toLocaleString()}
                </time>
              </dd>
            </div>
            <div>
              <dt>{t('pages.salesCommissions.reportingCompletenessLabel', 'Reporting completeness')}</dt>
              <dd>
                <StatusBadge
                  label={snapshot.completeness.reporting_completeness}
                  tone={
                    snapshot.completeness.reporting_completeness === 'COMPLETE'
                      ? 'success'
                      : 'warning'
                  }
                />
              </dd>
            </div>
          </dl>

          <section aria-labelledby="snapshot-plan-mix-h">
            <h2 id="snapshot-plan-mix-h">
              {t('pages.salesCommissions.planVersionMixTitle', 'Plan Version mix')}
            </h2>
            {snapshot.planVersionAttribution.length === 0 ? (
              <p className="sa-muted">
                {t('pages.salesCommissions.attributionEmpty', 'No plan version attribution.')}
              </p>
            ) : (
              <div className="sa-table-wrap">
                <table className="sa-table">
                  <thead>
                    <tr>
                      <th>{t('pages.salesCommissions.colPlanVersionId', 'Plan version id')}</th>
                      <th>{t('pages.salesCommissions.colCount', 'Count')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.planVersionAttribution.map((row) => (
                      <tr key={row.planVersionId}>
                        <td>
                          <code>{row.planVersionId}</code>
                        </td>
                        <td>{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section aria-labelledby="snapshot-addon-h">
            <h2 id="snapshot-addon-h">
              {t('pages.salesCommissions.addonAttributionTitle', 'Add-on attribution')}
            </h2>
            {snapshot.addOnAttribution.length === 0 ? (
              <p className="sa-muted">
                {t('pages.salesCommissions.attributionEmpty', 'No add-on attribution.')}
              </p>
            ) : (
              <div className="sa-table-wrap">
                <table className="sa-table">
                  <thead>
                    <tr>
                      <th>{t('pages.salesCommissions.colAddOnVersionId', 'Add-on version id')}</th>
                      <th>{t('pages.salesCommissions.colCount', 'Count')}</th>
                      <th>{t('pages.salesCommissions.colBasis', 'Basis')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.addOnAttribution.map((row) => (
                      <tr key={`${row.addOnVersionId}-${row.basis}`}>
                        <td>
                          <code>{row.addOnVersionId}</code>
                        </td>
                        <td>{row.count}</td>
                        <td>{row.basis}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {canReview ? (
            <form onSubmit={(e) => void onReview(e)} aria-labelledby="review-h">
              <h2 id="review-h">{t('pages.salesCommissions.reviewTitle', 'Review')}</h2>
              <label className="sa-field">
                {t('pages.salesCommissions.reviewStatusLabel', 'Review status')}{' '}
                <select
                  value={reviewStatus}
                  onChange={(e) => setReviewStatus(e.target.value as SalesCommissionReviewStatus)}
                >
                  {(['NONE', 'IN_REVIEW', 'REVIEWED', 'REJECTED'] as const).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="sa-field">
                {t('pages.salesCommissions.reasonLabel', 'Reason')}{' '}
                <input value={reviewReason} onChange={(e) => setReviewReason(e.target.value)} />
              </label>
              <button className="sa-button sa-button-primary" type="submit">
                {t('pages.salesCommissions.reviewSubmit', 'Update review')}
              </button>
            </form>
          ) : null}

          {canMarkPaid ? (
            <form onSubmit={(e) => void onMarkPaid(e)} aria-labelledby="mark-paid-h">
              <h2 id="mark-paid-h">
                {t('pages.salesCommissions.markPaidTitle', 'Administrative paid status')}
              </h2>
              <p className="sa-muted">
                {t(
                  'pages.salesCommissions.markPaidDisclaimer',
                  'This does not run payroll, open a bank transfer, or write a payment ledger.',
                )}
              </p>
              <label className="sa-field">
                {t('pages.salesCommissions.paidStatusLabel', 'Paid status')}{' '}
                <select
                  value={paidStatus}
                  onChange={(e) => setPaidStatus(e.target.value as SalesCommissionPaidStatus)}
                >
                  <option value="UNPAID">UNPAID</option>
                  <option value="PAID">PAID</option>
                </select>
              </label>
              <label className="sa-field">
                {t('pages.salesCommissions.paidReasonLabel', 'Paid reason')}{' '}
                <input value={paidReason} onChange={(e) => setPaidReason(e.target.value)} />
              </label>
              <label className="sa-field">
                {t('pages.salesCommissions.paidReferenceLabel', 'Paid reference')}{' '}
                <input value={paidReference} onChange={(e) => setPaidReference(e.target.value)} />
              </label>
              <button className="sa-button sa-button-primary" type="submit">
                {t('pages.salesCommissions.markPaidSubmit', 'Update paid status')}
              </button>
            </form>
          ) : null}

          <p className="sa-muted">
            {t(
              'pages.salesCommissions.boundaryNote',
              'No payroll, bank, tax, PHI, or Step 27 notification UI on this page.',
            )}
          </p>
        </>
      ) : null}
    </PageLayout>
  );
}
