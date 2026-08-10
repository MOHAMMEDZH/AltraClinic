import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { usePlatformAuth } from '../auth/PlatformAuthProvider';
import { PlatformAuthApiError } from '../auth/platform-auth-api';
import { hasPermission } from '../auth/permissions';
import { Alert, Surface } from '../ui';

type Props = { tenantId: string };

type PendingRequest = {
  id: string;
  type: string;
  status: string;
  requesterPlatformUserId?: string;
};

/**
 * Flexible Step 19 — Tenant Detail lifecycle panel.
 * Mutations require TENANT_LIFECYCLE_ENABLED on the API and explicit permissions.
 * UI visibility is never authorization.
 */
export function TenantLifecyclePanel({ tenantId }: Props) {
  const { t } = useI18n();
  const { client, withAccessToken, principal } = usePlatformAuth();
  const canView = hasPermission(principal, 'tenant.view');
  const canSuspend = hasPermission(principal, 'tenant.suspend');
  const canResume = hasPermission(principal, 'tenant.resume');
  const canActivate = hasPermission(principal, 'tenant.activate');
  const canArchive = hasPermission(principal, 'tenant.archive-request');
  const canDelete = hasPermission(principal, 'tenant.delete-request');
  const canApprove = hasPermission(principal, 'tenant.request.approve');
  const actorId = principal?.id ?? '';

  const [status, setStatus] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [rowVersion, setRowVersion] = useState<number | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [reason, setReason] = useState('');
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const [previewSummary, setPreviewSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const [busy, setBusy] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const reasonId = useId();
  const typedId = useId();

  const load = useCallback(async () => {
    if (!tenantId || !canView) return;
    setBusy(true);
    setError(null);
    try {
      const data = await withAccessToken((token) => client.getTenantLifecycle(token, tenantId));
      setStatus(data.status);
      setDisplayName(data.displayName);
      setRowVersion(data.rowVersion);
      setEnabled(data.lifecycleEnabled);
      setPendingRequests(data.pendingRequests ?? []);
    } catch (err) {
      setError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.tenantDetail.lifecycleForbidden', 'Forbidden'),
      );
    } finally {
      setBusy(false);
    }
    // `t` is stable enough for error mapping; omit from deps so locale flips do not clear in-flight validation errors.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: avoid reload on translator identity change
  }, [canView, client, tenantId, withAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.focus();
    }
  }, [error]);

  function mapError(err: unknown): string {
    if (!(err instanceof PlatformAuthApiError)) {
      return t('pages.tenantDetail.lifecycleGenericError', 'Lifecycle action failed. Try again.');
    }
    const code = err.code ?? '';
    if (code === 'preview_stale' || code === 'lifecyclePreviewStale') {
      return t('pages.tenantDetail.lifecyclePreviewStale', 'Impact preview is stale — refresh and try again.');
    }
    if (code === 'stale_row_version') {
      return t('pages.tenantDetail.lifecycleStaleRowVersion', 'Tenant was updated elsewhere. Refresh and retry.');
    }
    if (code === 'self_approval_denied') {
      return t('pages.tenantDetail.lifecycleSelfApprovalDenied', 'You cannot approve or reject your own request.');
    }
    if (err.status === 429) {
      return t('pages.tenantDetail.lifecycleRateLimited', 'Too many lifecycle attempts. Wait and retry.');
    }
    if (err.status === 403) {
      return t('pages.tenantDetail.lifecycleForbidden', 'Missing tenant lifecycle permission.');
    }
    if (err.status === 503 || code === 'tenant_lifecycle_disabled') {
      return t('pages.tenantDetail.lifecycleDisabled');
    }
    return err.message || t('pages.tenantDetail.lifecycleGenericError', 'Lifecycle action failed. Try again.');
  }

  async function runStatusAction(action: 'suspend' | 'reactivate' | 'activate') {
    if (rowVersion == null) return;
    setBusy(true);
    setError(null);
    setPreviewSummary(null);
    try {
      await withAccessToken(async (token) => {
        const preview = await client.previewTenantLifecycle(token, tenantId, action);
        setPreviewSummary(
          [
            t('pages.tenantDetail.lifecyclePreviewSessions', 'Active clinic sessions'),
            String(preview.activeSessionCount),
            preview.reversible
              ? t('pages.tenantDetail.lifecyclePreviewReversible', 'Reversible')
              : t('pages.tenantDetail.lifecyclePreviewIrreversible', 'Not immediately reversible'),
          ].join(' · '),
        );
        if (preview.blockers.length) {
          throw new PlatformAuthApiError(preview.blockers.join(', '), 409, 'lifecycle_blockers');
        }
        await client.mutateTenantLifecycle(
          token,
          tenantId,
          action,
          {
            expectedRowVersion: rowVersion,
            reason: reason.trim() || `${action} via Super Admin`,
            previewFingerprint: preview.previewFingerprint,
          },
          `${action}-${tenantId}-${rowVersion}-${Date.now()}`,
        );
      });
      setAnnounce(t('pages.tenantDetail.lifecycleActionSuccess', 'Lifecycle action completed.'));
      setReason('');
      await load();
    } catch (err) {
      setError(mapError(err));
    } finally {
      setBusy(false);
    }
  }

  async function runArchiveRequest() {
    if (rowVersion == null) return;
    setBusy(true);
    setError(null);
    try {
      await withAccessToken(async (token) => {
        const preview = await client.previewTenantLifecycle(token, tenantId, 'archive_request');
        if (preview.blockers.length) {
          throw new PlatformAuthApiError(preview.blockers.join(', '), 409, 'lifecycle_blockers');
        }
        await client.createTenantLifecycleArchiveRequest(
          token,
          tenantId,
          {
            expectedRowVersion: rowVersion,
            reason: reason.trim() || 'Archive request via Super Admin',
            previewFingerprint: preview.previewFingerprint,
          },
          `archive-req-${tenantId}-${rowVersion}-${Date.now()}`,
        );
      });
      setAnnounce(t('pages.tenantDetail.lifecycleRequestCreated', 'Lifecycle request created.'));
      setReason('');
      await load();
    } catch (err) {
      setError(mapError(err));
    } finally {
      setBusy(false);
    }
  }

  async function runDeletionRequest() {
    if (rowVersion == null) return;
    if (typedConfirmation.trim() !== displayName) {
      setError(
        t(
          'pages.tenantDetail.lifecycleTypedMismatch',
          'Typed confirmation must exactly match the tenant display name.',
        ),
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await withAccessToken(async (token) => {
        const preview = await client.previewTenantLifecycle(token, tenantId, 'deletion_request');
        if (preview.blockers.length) {
          throw new PlatformAuthApiError(preview.blockers.join(', '), 409, 'lifecycle_blockers');
        }
        await client.createTenantLifecycleDeletionRequest(
          token,
          tenantId,
          {
            expectedRowVersion: rowVersion,
            reason: reason.trim() || 'Deletion request via Super Admin',
            previewFingerprint: preview.previewFingerprint,
            typedConfirmation: typedConfirmation.trim(),
          },
          `delete-req-${tenantId}-${rowVersion}-${Date.now()}`,
        );
      });
      setAnnounce(t('pages.tenantDetail.lifecycleRequestCreated', 'Lifecycle request created.'));
      setReason('');
      setTypedConfirmation('');
      await load();
    } catch (err) {
      setError(mapError(err));
    } finally {
      setBusy(false);
    }
  }

  async function decide(requestId: string, decision: 'approve' | 'reject' | 'cancel') {
    if (rowVersion == null) return;
    setBusy(true);
    setError(null);
    try {
      await withAccessToken(async (token) => {
        await client.decideTenantLifecycleRequest(
          token,
          requestId,
          decision,
          {
            expectedRowVersion: rowVersion,
            reason: reason.trim() || `${decision} via Super Admin`,
            decisionReason: reason.trim() || undefined,
          },
          `${decision}-${requestId}-${Date.now()}`,
        );
      });
      setAnnounce(t('pages.tenantDetail.lifecycleDecisionSuccess', 'Request decision recorded.'));
      await load();
    } catch (err) {
      setError(mapError(err));
    } finally {
      setBusy(false);
    }
  }

  if (!canView) {
    return (
      <Surface as="section" level="raised" className="sa-metric-card">
        <header className="sa-metric-card-header">
          <h2 className="sa-metric-card-title">
            {t('pages.tenantDetail.lifecycle', 'Lifecycle actions')}
          </h2>
        </header>
        <p className="sa-muted" role="status">
          {t('pages.tenantDetail.lifecycleForbidden', 'Missing tenant lifecycle permission.')}
        </p>
      </Surface>
    );
  }

  return (
    <Surface as="section" level="raised" className="sa-metric-card">
      <header className="sa-metric-card-header">
        <h2 className="sa-metric-card-title">
          {t('pages.tenantDetail.lifecycle', 'Lifecycle actions')}
        </h2>
      </header>
      <div aria-live="polite" className="sa-sr-only">
        {announce}
      </div>
      {status ? (
        <p>
          {t('pages.tenantDetail.lifecycleStatus', 'Lifecycle status')}:{' '}
          <strong>{status}</strong>
          {rowVersion != null
            ? ` · ${t('pages.tenantDetail.lifecycleRowVersion', 'Row version')}: ${rowVersion}`
            : ''}
        </p>
      ) : null}
      {!enabled ? (
        <Alert tone="info" title={t('pages.tenantDetail.lifecycleDisabled')}>
          {t('pages.tenantDetail.lifecycleDisabled')}
        </Alert>
      ) : null}
      {previewSummary ? (
        <p className="sa-muted" role="status">
          {previewSummary}
        </p>
      ) : null}
      <label htmlFor={reasonId}>
        {t('pages.tenantDetail.lifecycleReason', 'Reason')}
        <input
          id={reasonId}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={busy || !enabled}
          aria-required="true"
        />
      </label>
      <p className="sa-lifecycle-actions">
        <button
          type="button"
          disabled={busy || !enabled || !canActivate || status !== 'PROVISIONING'}
          onClick={() => void runStatusAction('activate')}
        >
          {t('pages.tenantDetail.lifecycleActivate', 'Activate')}
        </button>{' '}
        <button
          type="button"
          disabled={busy || !enabled || !canSuspend || status !== 'ACTIVE'}
          onClick={() => void runStatusAction('suspend')}
        >
          {t('pages.tenantDetail.lifecycleSuspend', 'Suspend')}
        </button>{' '}
        <button
          type="button"
          disabled={busy || !enabled || !canResume || status !== 'SUSPENDED'}
          onClick={() => void runStatusAction('reactivate')}
        >
          {t('pages.tenantDetail.lifecycleReactivate', 'Reactivate')}
        </button>{' '}
        <button
          type="button"
          disabled={
            busy ||
            !enabled ||
            !canArchive ||
            status === 'ARCHIVED' ||
            pendingRequests.some((r) => r.type === 'ARCHIVE')
          }
          onClick={() => void runArchiveRequest()}
        >
          {t('pages.tenantDetail.lifecycleArchiveRequest', 'Request archival')}
        </button>
      </p>
      {status === 'ARCHIVED' ? (
        <div className="sa-lifecycle-delete">
          <p>
            {t(
              'pages.tenantDetail.lifecycleDeleteWarning',
              'Deletion creates an approved handoff only. No physical tenant or clinical data deletion.',
            )}
          </p>
          <label htmlFor={typedId}>
            {t('pages.tenantDetail.lifecycleTypedConfirm', 'Type the tenant display name to confirm')}
            <input
              id={typedId}
              value={typedConfirmation}
              onChange={(e) => setTypedConfirmation(e.target.value)}
              disabled={busy || !enabled || !canDelete}
              aria-required="true"
              autoComplete="off"
            />
          </label>
          <button
            type="button"
            disabled={
              busy ||
              !enabled ||
              !canDelete ||
              pendingRequests.some((r) => r.type === 'DELETE')
            }
            onClick={() => void runDeletionRequest()}
          >
            {t('pages.tenantDetail.lifecycleDeleteRequest', 'Request deletion')}
          </button>
        </div>
      ) : null}
      {pendingRequests.length > 0 ? (
        <div>
          <h3>{t('pages.tenantDetail.lifecyclePendingRequests', 'Pending requests')}</h3>
          <ul>
            {pendingRequests.map((req) => {
              const isSelf = req.requesterPlatformUserId === actorId;
              return (
                <li key={req.id}>
                  <span>
                    {req.type} · {req.status}
                  </span>{' '}
                  {canApprove && !isSelf ? (
                    <>
                      <button
                        type="button"
                        disabled={busy || !enabled}
                        onClick={() => void decide(req.id, 'approve')}
                      >
                        {t('pages.tenantDetail.lifecycleApprove', 'Approve')}
                      </button>{' '}
                      <button
                        type="button"
                        disabled={busy || !enabled}
                        onClick={() => void decide(req.id, 'reject')}
                      >
                        {t('pages.tenantDetail.lifecycleReject', 'Reject')}
                      </button>
                    </>
                  ) : null}
                  {isSelf || canApprove ? (
                    <button
                      type="button"
                      disabled={busy || !enabled}
                      onClick={() => void decide(req.id, 'cancel')}
                    >
                      {t('pages.tenantDetail.lifecycleCancel', 'Cancel')}
                    </button>
                  ) : null}
                  {isSelf && canApprove ? (
                    <span className="sa-muted" role="status">
                      {' '}
                      {t(
                        'pages.tenantDetail.lifecycleSelfApprovalDenied',
                        'You cannot approve or reject your own request.',
                      )}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {error ? (
        <div ref={errorRef} tabIndex={-1} data-testid="lifecycle-error">
          <Alert tone="danger" title={error}>
            {error}
          </Alert>
        </div>
      ) : null}
    </Surface>
  );
}
