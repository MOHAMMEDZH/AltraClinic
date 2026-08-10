/**
 * Step 17 — Bounded Super Admin runtime inspection panel (read-only).
 */
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { Alert, FormField, Spinner, StatusBadge, TextInput } from '../../ui';
import { usePlatformAuth } from '../../auth/PlatformAuthProvider';
import { PlatformAuthApiError } from '../../auth/platform-auth-api';
import {
  RUNTIME_DRAFT_UNCHANGED_WARNING,
  cacheStatusTone,
  classifyRuntimeHttpError,
  classifyRuntimeInspection,
  limitStateTone,
  runtimeUiStateTone,
  type SubscriptionRuntimeExplanation,
  type SubscriptionRuntimeInspection,
  type SubscriptionRuntimeUiState,
} from './subscriptions-shared';

type Props = {
  subscriptionId: string;
  lifecycle: string;
};

function truncateId(value: string | undefined, keep = 12): string {
  if (!value) return '—';
  if (value.length <= keep + 1) return value;
  return `${value.slice(0, keep)}…`;
}

export function SubscriptionRuntimePanel({ subscriptionId, lifecycle }: Props) {
  const { t } = useI18n();
  const { client, withAccessToken } = usePlatformAuth();
  const clientRef = useRef(client);
  const withAccessTokenRef = useRef(withAccessToken);
  clientRef.current = client;
  withAccessTokenRef.current = withAccessToken;

  const [runtime, setRuntime] = useState<SubscriptionRuntimeInspection | null>(null);
  const [uiState, setUiState] = useState<SubscriptionRuntimeUiState>('loading');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [explainKey, setExplainKey] = useState('');
  const [explainKeyError, setExplainKeyError] = useState<string | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<SubscriptionRuntimeExplanation | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setUiState('loading');
    try {
      const result = (await withAccessTokenRef.current((token) =>
        clientRef.current.getPlatformSubscriptionRuntime(token, subscriptionId),
      )) as SubscriptionRuntimeInspection;
      setRuntime(result);
      setUiState(classifyRuntimeInspection(result));
    } catch (err) {
      setRuntime(null);
      if (err instanceof PlatformAuthApiError) {
        const classified = classifyRuntimeHttpError(err.status);
        if (classified) {
          setUiState(classified);
          setError(
            t(`pages.subscriptions.runtime.states.${classified}`, err.message),
          );
        } else {
          setUiState('error');
          setError(err.message);
        }
      } else {
        setUiState('error');
        setError(
          t('pages.subscriptions.runtime.loadError', 'Unable to load runtime inspection.'),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [subscriptionId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onExplain(e: FormEvent) {
    e.preventDefault();
    const key = explainKey.trim();
    if (!key) {
      setExplainKeyError(
        t('pages.subscriptions.runtime.explainKeyRequired', 'Enter a canonical entitlement key.'),
      );
      return;
    }
    setExplainKeyError(null);
    setExplainLoading(true);
    setExplainError(null);
    setExplanation(null);
    try {
      const result = (await withAccessTokenRef.current((token) =>
        clientRef.current.explainPlatformSubscriptionRuntime(token, subscriptionId, key),
      )) as SubscriptionRuntimeExplanation;
      setExplanation(result);
    } catch (err) {
      if (err instanceof PlatformAuthApiError) {
        const classified = classifyRuntimeHttpError(err.status);
        setExplainError(
          classified
            ? t(`pages.subscriptions.runtime.states.${classified}`, err.message)
            : err.message,
        );
      } else {
        setExplainError(
          t('pages.subscriptions.runtime.explainError', 'Unable to explain entitlement key.'),
        );
      }
    } finally {
      setExplainLoading(false);
    }
  }

  if (loading) {
    return <Spinner label={t('pages.subscriptions.runtime.loading', 'Loading runtime…')} />;
  }

  if (!runtime) {
    return (
      <Alert
        tone={
          uiState === 'permission_denied' || uiState === 'rate_limited' || uiState === 'not_found'
            ? 'warning'
            : 'danger'
        }
        title={t(`pages.subscriptions.runtime.states.${uiState}`, uiState)}
      >
        {error ?? t('pages.subscriptions.runtime.loadError', 'Unable to load runtime inspection.')}
      </Alert>
    );
  }

  const stateLabel = t(`pages.subscriptions.runtime.states.${uiState}`, uiState);

  return (
    <section aria-labelledby="subscription-runtime-heading">
      <h2 id="subscription-runtime-heading">
        {t('pages.subscriptions.runtime.heading', 'Runtime inspection')}
      </h2>

      {lifecycle === 'DRAFT' ? (
        <Alert tone="info" title={t('pages.subscriptions.runtime.draftWarningTitle', 'Draft unchanged')}>
          {t('pages.subscriptions.runtime.draftUnchanged', RUNTIME_DRAFT_UNCHANGED_WARNING)}
        </Alert>
      ) : null}

      <p>
        <StatusBadge label={stateLabel} tone={runtimeUiStateTone(uiState)} />
      </p>

      <dl className="sa-metadata">
        <dt>{t('pages.subscriptions.runtime.source', 'Runtime source')}</dt>
        <dd>
          <StatusBadge
            label={runtime.source}
            tone={runtime.source === 'SNAPSHOT' ? 'success' : 'info'}
          />
        </dd>

        <dt>{t('pages.subscriptions.runtime.lifecycle', 'Commercial lifecycle')}</dt>
        <dd>{runtime.lifecycle ?? '—'}</dd>

        <dt>{t('pages.subscriptions.runtime.snapshotId', 'Active snapshot ID')}</dt>
        <dd>
          <code dir="ltr">{truncateId(runtime.snapshotId)}</code>
        </dd>

        <dt>{t('pages.subscriptions.runtime.fingerprintSchema', 'Fingerprint schema')}</dt>
        <dd>
          <code dir="ltr">{runtime.fingerprintSchema ?? '—'}</code>
        </dd>

        <dt>{t('pages.subscriptions.runtime.planSource', 'Plan source')}</dt>
        <dd dir="ltr">
          {runtime.planCanonicalKey
            ? `${runtime.planCanonicalKey}${
                runtime.planVersionNumber != null ? ` v${runtime.planVersionNumber}` : ''
              }`
            : '—'}
        </dd>

        <dt>{t('pages.subscriptions.runtime.addonCount', 'Add-on contributions')}</dt>
        <dd>{runtime.addonCount ?? 0}</dd>

        <dt>{t('pages.subscriptions.runtime.overrideCount', 'Override contributions')}</dt>
        <dd>{runtime.overrideCount ?? 0}</dd>

        <dt>{t('pages.subscriptions.runtime.moduleCount', 'Effective modules')}</dt>
        <dd>{runtime.moduleCount}</dd>

        <dt>{t('pages.subscriptions.runtime.featureCount', 'Effective features')}</dt>
        <dd>{runtime.featureCount}</dd>

        {runtime.specialtyCount != null ? (
          <>
            <dt>{t('pages.subscriptions.runtime.specialtyCount', 'Effective specialties')}</dt>
            <dd>{runtime.specialtyCount}</dd>
          </>
        ) : null}

        <dt>{t('pages.subscriptions.runtime.cacheStatus', 'Cache status')}</dt>
        <dd>
          <StatusBadge
            label={runtime.cacheStatus}
            tone={cacheStatusTone(runtime.cacheStatus)}
          />
        </dd>

        <dt>{t('pages.subscriptions.runtime.evaluatedAt', 'Evaluated at')}</dt>
        <dd>
          <time dateTime={runtime.evaluatedAt} dir="ltr">
            {new Date(runtime.evaluatedAt).toLocaleString()}
          </time>
        </dd>

        <dt>{t('pages.subscriptions.runtime.code', 'Runtime code')}</dt>
        <dd>
          <code dir="ltr">{runtime.code}</code>
        </dd>
      </dl>

      <h3>{t('pages.subscriptions.runtime.limitsHeading', 'Limit summary')}</h3>
      {runtime.limitsSummary.length === 0 ? (
        <p>{t('pages.subscriptions.runtime.limitsEmpty', 'No typed limits in this runtime projection.')}</p>
      ) : (
        <div className="sa-table-wrap">
          <table className="sa-table">
            <caption className="sa-visually-hidden">
              {t('pages.subscriptions.runtime.limitsHeading', 'Limit summary')}
            </caption>
            <thead>
              <tr>
                <th scope="col">{t('pages.subscriptions.runtime.limitKey', 'Key')}</th>
                <th scope="col">{t('pages.subscriptions.runtime.limitState', 'State')}</th>
              </tr>
            </thead>
            <tbody>
              {runtime.limitsSummary.map((limit) => (
                <tr key={limit.key}>
                  <td>
                    <code dir="ltr">{limit.key}</code>
                  </td>
                  <td>
                    <StatusBadge label={limit.state} tone={limitStateTone(limit.state)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3>{t('pages.subscriptions.runtime.blockersHeading', 'Runtime blockers')}</h3>
      {!runtime.blockers || runtime.blockers.length === 0 ? (
        <p>{t('pages.subscriptions.runtime.blockersEmpty', 'No runtime blockers.')}</p>
      ) : (
        <ul>
          {runtime.blockers.map((b) => (
            <li key={b.code}>
              <code dir="ltr">{b.code}</code>
            </li>
          ))}
        </ul>
      )}

      <h3>{t('pages.subscriptions.runtime.explainHeading', 'Explain entitlement')}</h3>
      <form className="sa-form" onSubmit={(e) => void onExplain(e)} noValidate>
        <FormField
          label={t('pages.subscriptions.runtime.explainKey', 'Canonical key')}
          hint={t(
            'pages.subscriptions.runtime.explainKeyHint',
            'Look up a module.*, feature.*, limit.*, or specialty key.',
          )}
          error={explainKeyError}
          required
        >
          <TextInput
            value={explainKey}
            onChange={(e) => setExplainKey(e.target.value)}
            dir="ltr"
            autoComplete="off"
            spellCheck={false}
          />
        </FormField>
        <button type="submit" className="sa-button sa-button-primary" disabled={explainLoading}>
          {explainLoading
            ? t('pages.subscriptions.runtime.explainSubmitting', 'Looking up…')
            : t('pages.subscriptions.runtime.explainSubmit', 'Explain')}
        </button>
      </form>

      {explainError ? <Alert tone="danger">{explainError}</Alert> : null}

      {explanation ? (
        <dl className="sa-metadata" aria-live="polite">
          <dt>{t('pages.subscriptions.runtime.explainResultKey', 'Key')}</dt>
          <dd>
            <code dir="ltr">{explanation.key}</code>
          </dd>
          <dt>{t('pages.subscriptions.runtime.explainAllowed', 'Allowed')}</dt>
          <dd>
            <StatusBadge
              label={
                explanation.allowed
                  ? t('common.yes', 'Yes')
                  : t('common.no', 'No')
              }
              tone={explanation.allowed ? 'success' : 'warning'}
            />
          </dd>
          <dt>{t('pages.subscriptions.runtime.explainResultCode', 'Code')}</dt>
          <dd>
            <code dir="ltr">{explanation.code}</code>
          </dd>
          {explanation.catalogKind ? (
            <>
              <dt>{t('pages.subscriptions.runtime.explainCatalogKind', 'Catalog kind')}</dt>
              <dd>{explanation.catalogKind}</dd>
            </>
          ) : null}
          {explanation.limitState ? (
            <>
              <dt>{t('pages.subscriptions.runtime.explainLimitState', 'Limit state')}</dt>
              <dd>
                <StatusBadge
                  label={explanation.limitState}
                  tone={limitStateTone(explanation.limitState)}
                />
              </dd>
            </>
          ) : null}
          <dt>{t('pages.subscriptions.runtime.explainSource', 'Source')}</dt>
          <dd>{explanation.source}</dd>
          <dt>{t('pages.subscriptions.runtime.evaluatedAt', 'Evaluated at')}</dt>
          <dd>
            <time dateTime={explanation.evaluatedAt} dir="ltr">
              {new Date(explanation.evaluatedAt).toLocaleString()}
            </time>
          </dd>
        </dl>
      ) : null}
    </section>
  );
}
