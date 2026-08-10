import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { Alert, Spinner } from '../../ui';
import { usePlatformAuth } from '../../auth/PlatformAuthProvider';
import { PlatformAuthApiError } from '../../auth/platform-auth-api';
import {
  type LimitAssignmentState,
  type PlanLimitDefinition,
  type PlanVersionLimits,
} from './plans-shared';
import { canManagePlanLimits } from './plan-permissions';
import { PlanVersionLegacyUnconfiguredNotice, PlanVersionPreviewBanner } from './PlanVersionTabNav';

type DraftAssignment = {
  state: LimitAssignmentState;
  value: string;
};

function draftFromLimit(limit: PlanLimitDefinition): DraftAssignment {
  if (limit.assignment.state === 'VALUE') {
    return { state: 'VALUE', value: limit.assignment.value ?? '' };
  }
  if (limit.assignment.state === 'UNLIMITED') {
    return { state: 'UNLIMITED', value: '' };
  }
  return { state: 'UNCONFIGURED', value: '' };
}

function formatAssignmentLabel(
  t: (key: string, fallback?: string) => string,
  assignment: DraftAssignment,
): string {
  if (assignment.state === 'UNLIMITED') {
    return t('pages.plans.limits.unlimited', 'Unlimited');
  }
  if (assignment.state === 'UNCONFIGURED') {
    return t('pages.plans.limits.unconfigured', 'Unconfigured');
  }
  return assignment.value || '—';
}

type PlanVersionLimitsPanelProps = {
  planId: string;
  versionId: string;
  readOnly: boolean;
  legacyUnconfigured?: boolean;
  onClone?: () => void;
  onRowVersionChange?: (rowVersion: number) => void;
};

export function PlanVersionLimitsPanel({
  planId,
  versionId,
  readOnly,
  legacyUnconfigured,
  onClone,
  onRowVersionChange,
}: PlanVersionLimitsPanelProps) {
  const { t } = useI18n();
  const { client, withAccessToken, principal } = usePlatformAuth();
  const clientRef = useRef(client);
  const withAccessTokenRef = useRef(withAccessToken);
  clientRef.current = client;
  withAccessTokenRef.current = withAccessToken;
  const canManage = canManagePlanLimits(principal) && !readOnly;

  const [data, setData] = useState<PlanVersionLimits | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftAssignment>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = (await withAccessTokenRef.current((token) =>
        clientRef.current.getPlatformPlanVersionLimits(token, planId, versionId),
      )) as PlanVersionLimits;
      setData(raw);
      onRowVersionChange?.(raw.rowVersion);
      const next: Record<string, DraftAssignment> = {};
      for (const group of raw.groups) {
        for (const limit of group.limits) {
          next[limit.canonicalKey] = draftFromLimit(limit);
        }
      }
      for (const limit of raw.ungrouped) {
        next[limit.canonicalKey] = draftFromLimit(limit);
      }
      setDrafts(next);
    } catch (err) {
      if (err instanceof PlatformAuthApiError && err.status === 404) {
        setError(
          t(
            'pages.plans.limits.apiUnavailable',
            'Limits API is not available yet. Backend Step 14 routes may be missing.',
          ),
        );
      } else {
        setError(
          err instanceof PlatformAuthApiError
            ? err.message
            : t('pages.plans.limits.loadError', 'Unable to load limits.'),
        );
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [onRowVersionChange, planId, t, versionId]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateDraft(key: string, patch: Partial<DraftAssignment>) {
    setDrafts((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? { state: 'UNCONFIGURED', value: '' }), ...patch },
    }));
  }

  function setState(key: string, state: LimitAssignmentState) {
    if (state === 'UNLIMITED' || state === 'UNCONFIGURED') {
      updateDraft(key, { state, value: '' });
      return;
    }
    updateDraft(key, { state, value: drafts[key]?.value ?? '' });
  }

  async function onSave() {
    if (!data || !canManage) return;
    setSubmitting(true);
    setSaveError(null);
    const assignments = Object.entries(drafts).map(([canonicalKey, draft]) => ({
      canonicalKey,
      state: draft.state,
      value: draft.state === 'VALUE' ? draft.value : null,
    }));
    try {
      const updated = (await withAccessToken((token) =>
        client.updatePlatformPlanVersionLimits(token, planId, versionId, {
          expectedRowVersion: data.rowVersion,
          assignments,
        }),
      )) as PlanVersionLimits;
      setData(updated);
      onRowVersionChange?.(updated.rowVersion);
      const next: Record<string, DraftAssignment> = {};
      for (const group of updated.groups) {
        for (const limit of group.limits) {
          next[limit.canonicalKey] = draftFromLimit(limit);
        }
      }
      for (const limit of updated.ungrouped) {
        next[limit.canonicalKey] = draftFromLimit(limit);
      }
      setDrafts(next);
    } catch (err) {
      if (err instanceof PlatformAuthApiError && err.status === 409) {
        setSaveError(
          t(
            'pages.plans.staleVersion',
            'This version changed. Reload and retry — your edits were kept on screen.',
          ),
        );
      } else {
        setSaveError(
          err instanceof PlatformAuthApiError
            ? err.message
            : t('pages.plans.limits.saveError', 'Unable to save limits.'),
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  function renderLimitRow(limit: PlanLimitDefinition, disabled: boolean) {
    const draft = drafts[limit.canonicalKey] ?? draftFromLimit(limit);
    const ownerWarning = !limit.ownerModuleGranted && limit.owningModuleKey;

    if (disabled) {
      return (
        <tr key={limit.canonicalKey}>
          <td>
            <strong>{limit.displayName}</strong>
            <br />
            <code dir="ltr">{limit.canonicalKey}</code>
          </td>
          <td>
            {limit.valueType} / {limit.unit}
          </td>
          <td>{formatAssignmentLabel(t, draft)}</td>
        </tr>
      );
    }

    return (
      <tr key={limit.canonicalKey}>
        <td>
          <strong>{limit.displayName}</strong>
          <br />
          <code dir="ltr">{limit.canonicalKey}</code>
          {ownerWarning ? (
            <p className="sa-warning-text" role="note">
              {t(
                'pages.plans.limits.ownerWarning',
                'Owning module is not granted — limit may not apply at runtime until Step 18.',
              )}{' '}
              <code dir="ltr">{limit.owningModuleKey}</code>
            </p>
          ) : null}
        </td>
        <td>
          {limit.valueType} / {limit.unit}
        </td>
        <td>
          <fieldset className="sa-limit-assignment">
            <label>
              <input
                type="radio"
                name={`limit-${limit.canonicalKey}`}
                checked={draft.state === 'UNCONFIGURED'}
                onChange={() => setState(limit.canonicalKey, 'UNCONFIGURED')}
              />
              {t('pages.plans.limits.unconfigured', 'Unconfigured')}
            </label>
            <label>
              <input
                type="radio"
                name={`limit-${limit.canonicalKey}`}
                checked={draft.state === 'VALUE'}
                onChange={() => setState(limit.canonicalKey, 'VALUE')}
              />
              {t('pages.plans.limits.value', 'Value')}
            </label>
            {limit.unlimitedSupported ? (
              <label>
                <input
                  type="radio"
                  name={`limit-${limit.canonicalKey}`}
                  checked={draft.state === 'UNLIMITED'}
                  onChange={() => setState(limit.canonicalKey, 'UNLIMITED')}
                />
                {t('pages.plans.limits.unlimited', 'Unlimited')}
              </label>
            ) : null}
            {draft.state === 'VALUE' ? (
              <input
                className="sa-input"
                dir="ltr"
                type={limit.valueType === 'INTEGER' || limit.valueType === 'COUNT' ? 'number' : 'text'}
                value={draft.value}
                min={limit.min ?? undefined}
                max={limit.max ?? undefined}
                onChange={(e) => updateDraft(limit.canonicalKey, { value: e.target.value, state: 'VALUE' })}
              />
            ) : null}
          </fieldset>
        </td>
      </tr>
    );
  }

  if (loading) {
    return <Spinner label={t('pages.plans.limits.loading', 'Loading limits…')} />;
  }

  if (error) {
    return <Alert tone="danger">{error}</Alert>;
  }

  if (!data) return null;

  const effectiveReadOnly = readOnly || data.readOnly;
  const showLegacy = legacyUnconfigured ?? data.legacyUnconfigured;
  const disabled = effectiveReadOnly || !canManage;

  return (
    <section aria-labelledby="limits-heading">
      <h2 id="limits-heading">{t('pages.plans.version.tabs.limits', 'Limits')}</h2>
      <PlanVersionPreviewBanner />
      {showLegacy && effectiveReadOnly ? (
        <PlanVersionLegacyUnconfiguredNotice onClone={onClone} />
      ) : null}
      {data.availability?.status === 'unavailable' ? (
        <Alert tone="warning">{t('pages.plans.limits.unavailable', 'Limits are unavailable for this version.')}</Alert>
      ) : null}
      {saveError ? <Alert tone="danger">{saveError}</Alert> : null}

      {data.groups.map((group) => (
        <section key={group.moduleKey} aria-labelledby={`limits-${group.moduleKey}`}>
          <h3 id={`limits-${group.moduleKey}`}>
            {group.moduleDisplayName}{' '}
            <code dir="ltr" className="sa-muted">
              {group.moduleKey}
            </code>
          </h3>
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>{t('routes.catalog.col.displayName', 'Display name')}</th>
                  <th>{t('pages.plans.limits.type', 'Type')}</th>
                  <th>{t('pages.plans.limits.assignment', 'Assignment')}</th>
                </tr>
              </thead>
              <tbody>{group.limits.map((limit) => renderLimitRow(limit, disabled))}</tbody>
            </table>
          </div>
        </section>
      ))}

      {data.ungrouped.length > 0 ? (
        <section aria-labelledby="limits-ungrouped">
          <h3 id="limits-ungrouped">{t('pages.plans.limits.ungrouped', 'Ungrouped limits')}</h3>
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>{t('routes.catalog.col.displayName', 'Display name')}</th>
                  <th>{t('pages.plans.limits.type', 'Type')}</th>
                  <th>{t('pages.plans.limits.assignment', 'Assignment')}</th>
                </tr>
              </thead>
              <tbody>{data.ungrouped.map((limit) => renderLimitRow(limit, disabled))}</tbody>
            </table>
          </div>
        </section>
      ) : null}

      {canManage ? (
        <div className="sa-form-actions">
          <button type="button" className="sa-button sa-button-primary" onClick={() => void onSave()} disabled={submitting}>
            {submitting ? t('pages.plans.submitting', 'Saving…') : t('plansPage.save', 'Save')}
          </button>
          <button type="button" className="sa-button" onClick={() => void load()} disabled={submitting}>
            {t('plansPage.refresh', 'Refresh')}
          </button>
        </div>
      ) : effectiveReadOnly ? (
        <p className="sa-muted">{t('pages.plans.limits.readOnly', 'Published and retired versions are read-only.')}</p>
      ) : (
        <Alert tone="warning">
          {t('pages.plans.limits.manageDenied', 'You do not have plan-limit.manage permission.')}
        </Alert>
      )}
    </section>
  );
}
