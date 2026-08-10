import { FormEvent, useCallback, useEffect, useId, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { usePlatformAuth } from '../auth/PlatformAuthProvider';
import { hasPermission } from '../auth/permissions';
import { PageLayout } from '../layout/PageLayout';
import { EmptyState } from '../ui/EmptyState';
import { StatusBadge, type StatusTone } from '../ui/StatusBadge';

type FeatureFlagRow = {
  id: string;
  canonicalKey: string;
  displayName: string;
  description: string;
  ownerTeam: string;
  category: string;
  effect: string;
  status: string;
  killSwitchActive: boolean;
  targetType: string;
  rolloutPercentage: number;
  rowVersion: number;
  targets?: Array<{ tenantId: string; mode: string }>;
  history?: Array<{
    id: string;
    operation: string;
    reason: string;
    createdAt: string;
    actorPlatformUserId: string;
  }>;
};

type GlobalSettingRow = {
  id: string;
  canonicalKey: string;
  displayName: string;
  description: string;
  ownerTeam: string;
  valueKind: string;
  safeValueJson: unknown;
  referenceConfigured: boolean;
  referenceProviderType: string | null;
  referenceId: string | null;
  referenceHealthCategory: string | null;
  referenceRotationRequired: boolean;
  highImpact: boolean;
  rowVersion: number;
};

function flagTone(flag: FeatureFlagRow): StatusTone {
  if (flag.killSwitchActive) return 'danger';
  if (flag.status === 'ACTIVE') return 'success';
  if (flag.status === 'DEPRECATED') return 'warning';
  return 'neutral';
}

/** Flexible Step 20 — Feature Flags and Global Settings (operational, not commercial). */
export function FeatureFlagsSettingsPage() {
  const { t, locale } = useI18n();
  const { client, getAccessToken, principal } = usePlatformAuth();
  const canViewFlags = hasPermission(principal, 'feature-flag.view');
  const canManageFlags = hasPermission(principal, 'feature-flag.manage');
  const canViewSettings = hasPermission(principal, 'settings.view');
  const [tab, setTab] = useState<'flags' | 'settings'>('flags');
  const [flags, setFlags] = useState<FeatureFlagRow[]>([]);
  const [settings, setSettings] = useState<GlobalSettingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const statusId = useId();
  const dir = locale === 'ar-SY' ? 'rtl' : 'ltr';

  const load = useCallback(async () => {
    const accessToken = getAccessToken();
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const nextFlags = canViewFlags
        ? ((await client.listFeatureFlags(accessToken)) as FeatureFlagRow[])
        : [];
      const nextSettings = canViewSettings
        ? ((await client.listGlobalSettings(accessToken)) as GlobalSettingRow[])
        : [];
      setFlags(Array.isArray(nextFlags) ? nextFlags : []);
      setSettings(Array.isArray(nextSettings) ? nextSettings : []);
    } catch {
      setError(t('pages.featureFlags.loadError', 'Unable to load feature flags and settings.'));
    } finally {
      setLoading(false);
    }
  }, [canViewFlags, canViewSettings, client, getAccessToken, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canViewFlags && !canViewSettings) {
    return (
      <PageLayout
        title={t('routes.settings.title', 'Feature Flags & Settings')}
        description={t(
          'routes.settings.description',
          'Operational feature flags and safe global settings.',
        )}
      >
        <EmptyState
          title={t('common.states.unauthorizedTitle', 'Unauthorized')}
          description={t(
            'pages.featureFlags.unauthorized',
            'You do not have permission to view operational flags or settings.',
          )}
        />
      </PageLayout>
    );
  }

  const filteredFlags = flags.filter((f) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return (
      f.canonicalKey.toLowerCase().includes(q) ||
      f.displayName.toLowerCase().includes(q) ||
      f.ownerTeam.toLowerCase().includes(q)
    );
  });

  return (
    <PageLayout
      title={t('routes.settings.title', 'Feature Flags & Settings')}
      description={t(
        'pages.featureFlags.banner',
        'Operational controls only. Feature flags never grant purchased entitlements.',
      )}
    >
      <div dir={dir} className="ff-settings">
        <p className="ff-settings__notice" role="note">
          {t(
            'pages.featureFlags.notEntitlement',
            'These are operational rollout and kill-switch controls — not commercial entitlements.',
          )}
        </p>

        <div role="tablist" aria-label={t('pages.featureFlags.tabs', 'Sections')}>
          {canViewFlags ? (
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'flags'}
              onClick={() => setTab('flags')}
            >
              {t('pages.featureFlags.tabFlags', 'Feature flags')}
            </button>
          ) : null}
          {canViewSettings ? (
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'settings'}
              onClick={() => setTab('settings')}
            >
              {t('pages.featureFlags.tabSettings', 'Global settings')}
            </button>
          ) : null}
        </div>

        <div id={statusId} aria-live="polite" className="visually-hidden">
          {loading
            ? t('common.states.loading', 'Loading…')
            : error
              ? error
              : t('pages.featureFlags.loaded', 'Loaded')}
        </div>

        {loading ? <p>{t('common.states.loading', 'Loading…')}</p> : null}
        {error ? (
          <div role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => void load()}>
              {t('common.buttons.retry', 'Try again')}
            </button>
          </div>
        ) : null}

        {!loading && !error && tab === 'flags' && canViewFlags ? (
          <section aria-labelledby="ff-list-h">
            <h2 id="ff-list-h">{t('pages.featureFlags.listTitle', 'Feature flags')}</h2>
            <label>
              {t('pages.featureFlags.filter', 'Filter')}
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                autoComplete="off"
              />
            </label>
            {canManageFlags ? (
              <p>
                <Link to="/settings/flags/new">
                  {t('pages.featureFlags.create', 'Create flag')}
                </Link>
              </p>
            ) : null}
            {filteredFlags.length === 0 ? (
              <EmptyState
                title={t('pages.featureFlags.empty', 'No feature flags')}
                description={t(
                  'pages.featureFlags.emptyHint',
                  'No operational flags are defined yet.',
                )}
              />
            ) : (
              <ul className="ff-settings__list">
                {filteredFlags.map((flag) => (
                  <li key={flag.id}>
                    <Link to={`/settings/flags/${flag.id}`}>
                      <strong>{flag.displayName}</strong>
                    </Link>
                    <code>{flag.canonicalKey}</code>
                    <StatusBadge
                      label={
                        flag.killSwitchActive
                          ? t('pages.featureFlags.killActive', 'Kill switch active')
                          : flag.status
                      }
                      tone={flagTone(flag)}
                    />
                    <span>
                      {t('pages.featureFlags.owner', 'Owner')}: {flag.ownerTeam}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {!loading && !error && tab === 'settings' && canViewSettings ? (
          <section aria-labelledby="gs-list-h">
            <h2 id="gs-list-h">{t('pages.featureFlags.settingsTitle', 'Global settings')}</h2>
            {settings.length === 0 ? (
              <EmptyState
                title={t('pages.featureFlags.settingsEmpty', 'No global settings')}
                description={t(
                  'pages.featureFlags.settingsEmptyHint',
                  'Safe non-secret settings appear here. Secrets stay in the environment store.',
                )}
              />
            ) : (
              <ul className="ff-settings__list">
                {settings.map((s) => (
                  <li key={s.id}>
                    <Link to={`/settings/global/${encodeURIComponent(s.canonicalKey)}`}>
                      <strong>{s.displayName}</strong>
                    </Link>
                    <code>{s.canonicalKey}</code>
                    <span>
                      {s.referenceConfigured
                        ? t('pages.featureFlags.refConfigured', 'Reference configured')
                        : t('pages.featureFlags.refMissing', 'No secret reference')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>
    </PageLayout>
  );
}

export function FeatureFlagDetailPage() {
  const { t, locale } = useI18n();
  const { flagId } = useParams();
  const navigate = useNavigate();
  const { client, getAccessToken, principal } = usePlatformAuth();
  const canManage = hasPermission(principal, 'feature-flag.manage');
  const canKill = hasPermission(principal, 'feature-flag.kill-switch');
  const [flag, setFlag] = useState<FeatureFlagRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmText, setConfirmText] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const dir = locale === 'ar-SY' ? 'rtl' : 'ltr';

  useEffect(() => {
    const accessToken = getAccessToken();
    if (!accessToken || !flagId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const row = (await client.getFeatureFlag(accessToken, flagId)) as FeatureFlagRow;
        if (!cancelled) setFlag(row);
      } catch {
        if (!cancelled) {
          setError(t('pages.featureFlags.detailError', 'Unable to load flag.'));
          setFlag(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, flagId, getAccessToken, t]);

  async function activateKill(e: FormEvent) {
    e.preventDefault();
    const accessToken = getAccessToken();
    if (!flag || !accessToken) return;
    setBusy(true);
    setError(null);
    try {
      const preview = await client.previewFeatureFlag(accessToken, {
        flagId: flag.id,
        action: flag.killSwitchActive ? 'KILL_SWITCH_DEACTIVATE' : 'KILL_SWITCH_ACTIVATE',
      });
      const body = {
        reason,
        expectedRowVersion: flag.rowVersion,
        previewFingerprint: preview.previewFingerprint,
        confirmation: confirmText,
      };
      const key = crypto.randomUUID();
      if (flag.killSwitchActive) {
        await client.deactivateFeatureFlagKillSwitch(accessToken, flag.id, body, key);
      } else {
        await client.activateFeatureFlagKillSwitch(accessToken, flag.id, body, key);
      }
      navigate('/settings');
    } catch {
      setError(
        t(
          'pages.featureFlags.killError',
          'Kill-switch action failed. Confirm step-up, CONFIRM text, and row version.',
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <PageLayout title={t('pages.featureFlags.detailTitle', 'Feature flag')}><p>{t('common.states.loading', 'Loading…')}</p></PageLayout>;
  }

  if (!flag) {
    return (
      <PageLayout title={t('pages.featureFlags.detailTitle', 'Feature flag')}>
        <EmptyState
          title={t('common.states.errorTitle', 'Something went wrong')}
          description={error ?? t('pages.featureFlags.notFound', 'Flag not found or access denied.')}
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={flag.displayName}
      description={t(
        'pages.featureFlags.detailBanner',
        'Operational flag detail. Never labeled as purchased access.',
      )}
    >
      <div dir={dir}>
        <p>
          <Link to="/settings">{t('pages.featureFlags.back', 'Back to list')}</Link>
        </p>
        <dl>
          <dt>{t('pages.featureFlags.key', 'Canonical key')}</dt>
          <dd>
            <code>{flag.canonicalKey}</code>
          </dd>
          <dt>{t('pages.featureFlags.effect', 'Effect')}</dt>
          <dd>{flag.effect}</dd>
          <dt>{t('pages.featureFlags.owner', 'Owner')}</dt>
          <dd>{flag.ownerTeam}</dd>
          <dt>{t('pages.featureFlags.targeting', 'Targeting')}</dt>
          <dd>
            {flag.targetType}
            {flag.targetType === 'PERCENTAGE' ? ` (${flag.rolloutPercentage}%)` : ''}
          </dd>
          <dt>{t('pages.featureFlags.status', 'Status')}</dt>
          <dd>
            <StatusBadge label={flag.status} tone={flagTone(flag)} />
            {flag.killSwitchActive
              ? ` — ${t('pages.featureFlags.killActive', 'Kill switch active')}`
              : ''}
          </dd>
        </dl>

        <section aria-labelledby="ff-hist-h">
          <h2 id="ff-hist-h">{t('pages.featureFlags.history', 'History')}</h2>
          {(flag.history ?? []).length === 0 ? (
            <p>{t('pages.featureFlags.historyEmpty', 'No history yet.')}</p>
          ) : (
            <ol>
              {(flag.history ?? []).map((h) => (
                <li key={h.id}>
                  <time dateTime={h.createdAt}>{h.createdAt}</time> — {h.operation}: {h.reason}
                </li>
              ))}
            </ol>
          )}
        </section>

        {canKill ? (
          <section aria-labelledby="ff-kill-h">
            <h2 id="ff-kill-h">{t('pages.featureFlags.killTitle', 'Kill switch')}</h2>
            <p>
              {t(
                'pages.featureFlags.killHint',
                'Requires fresh step-up, typed CONFIRM, reason, and impact preview.',
              )}
            </p>
            <form onSubmit={activateKill}>
              <label>
                {t('pages.featureFlags.reason', 'Reason')}
                <input
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={2000}
                />
              </label>
              <label>
                {t('pages.featureFlags.typeConfirm', 'Type CONFIRM')}
                <input
                  required
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  autoComplete="off"
                />
              </label>
              {error ? (
                <p role="alert">{error}</p>
              ) : null}
              <button type="submit" disabled={busy || confirmText.toUpperCase() !== 'CONFIRM'}>
                {flag.killSwitchActive
                  ? t('pages.featureFlags.deactivateKill', 'Deactivate kill switch')
                  : t('pages.featureFlags.activateKill', 'Activate kill switch')}
              </button>
            </form>
          </section>
        ) : null}

        {canManage ? (
          <p role="note">
            {t(
              'pages.featureFlags.manageNote',
              'Targeting and rollout edits use the Platform API with idempotency and rowVersion.',
            )}
          </p>
        ) : null}
      </div>
    </PageLayout>
  );
}

export function FeatureFlagCreatePage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { client, getAccessToken, principal } = usePlatformAuth();
  const canManage = hasPermission(principal, 'feature-flag.manage');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dir = locale === 'ar-SY' ? 'rtl' : 'ltr';

  if (!canManage) {
    return (
      <PageLayout title={t('pages.featureFlags.create', 'Create flag')}>
        <EmptyState
          title={t('common.states.unauthorizedTitle', 'Unauthorized')}
          description={t(
            'pages.featureFlags.createDenied',
            'You cannot create operational feature flags.',
          )}
        />
      </PageLayout>
    );
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const accessToken = getAccessToken();
    if (!accessToken) return;
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const created = (await client.createFeatureFlag(
        accessToken,
        {
          canonicalKey: String(fd.get('canonicalKey') ?? ''),
          displayName: String(fd.get('displayName') ?? ''),
          description: String(fd.get('description') ?? ''),
          ownerTeam: String(fd.get('ownerTeam') ?? ''),
          category: String(fd.get('category') ?? 'ops'),
          effect: String(fd.get('effect') ?? 'OPERATIONAL_ENABLEMENT'),
          reason: String(fd.get('reason') ?? ''),
        },
        crypto.randomUUID(),
      )) as FeatureFlagRow;
      navigate(`/settings/flags/${created.id}`);
    } catch {
      setError(t('pages.featureFlags.createError', 'Unable to create flag.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageLayout
      title={t('pages.featureFlags.create', 'Create flag')}
      description={t(
        'pages.featureFlags.createBanner',
        'Keys must use the ops. prefix. Flags cannot grant entitlements.',
      )}
    >
      <form dir={dir} onSubmit={onSubmit}>
        <fieldset>
          <legend>{t('pages.featureFlags.createLegend', 'New operational flag')}</legend>
          <label>
            {t('pages.featureFlags.key', 'Canonical key')}
            <input name="canonicalKey" required placeholder="ops.example.rollout" />
          </label>
          <label>
            {t('pages.featureFlags.displayName', 'Display name')}
            <input name="displayName" required />
          </label>
          <label>
            {t('pages.featureFlags.description', 'Description')}
            <textarea name="description" required rows={3} />
          </label>
          <label>
            {t('pages.featureFlags.owner', 'Owner')}
            <input name="ownerTeam" required defaultValue="platform-ops" />
          </label>
          <label>
            {t('pages.featureFlags.category', 'Category')}
            <input name="category" required defaultValue="rollout" />
          </label>
          <label>
            {t('pages.featureFlags.effect', 'Effect')}
            <select name="effect" defaultValue="ROLLOUT_ALLOW_FOR_ENTITLED">
              <option value="ROLLOUT_ALLOW_FOR_ENTITLED">ROLLOUT_ALLOW_FOR_ENTITLED</option>
              <option value="KILL_SWITCH_DENY">KILL_SWITCH_DENY</option>
              <option value="INTERNAL_IMPLEMENTATION_SELECTION">
                INTERNAL_IMPLEMENTATION_SELECTION
              </option>
              <option value="OPERATIONAL_ENABLEMENT">OPERATIONAL_ENABLEMENT</option>
            </select>
          </label>
          <label>
            {t('pages.featureFlags.reason', 'Reason')}
            <input name="reason" required />
          </label>
        </fieldset>
        {error ? <p role="alert">{error}</p> : null}
        <button type="submit" disabled={busy}>
          {t('common.buttons.save', 'Save')}
        </button>
      </form>
    </PageLayout>
  );
}

export function GlobalSettingDetailPage() {
  const { t, locale } = useI18n();
  const { settingKey } = useParams();
  const { client, getAccessToken, principal } = usePlatformAuth();
  const canManage = hasPermission(principal, 'settings.manage');
  const [setting, setSetting] = useState<GlobalSettingRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const dir = locale === 'ar-SY' ? 'rtl' : 'ltr';

  useEffect(() => {
    const accessToken = getAccessToken();
    if (!accessToken || !settingKey) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const row = (await client.getGlobalSetting(
          accessToken,
          settingKey,
        )) as GlobalSettingRow;
        if (!cancelled) setSetting(row);
      } catch {
        if (!cancelled) setError(t('pages.featureFlags.settingError', 'Unable to load setting.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, settingKey, getAccessToken, t]);

  if (loading) {
    return (
      <PageLayout title={t('pages.featureFlags.settingsTitle', 'Global settings')}>
        <p>{t('common.states.loading', 'Loading…')}</p>
      </PageLayout>
    );
  }

  if (!setting) {
    return (
      <PageLayout title={t('pages.featureFlags.settingsTitle', 'Global settings')}>
        <EmptyState
          title={t('common.states.errorTitle', 'Something went wrong')}
          description={error ?? t('pages.featureFlags.settingNotFound', 'Setting not found.')}
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout title={setting.displayName}>
      <div dir={dir}>
        <p>
          <Link to="/settings">{t('pages.featureFlags.back', 'Back to list')}</Link>
        </p>
        <dl>
          <dt>{t('pages.featureFlags.key', 'Canonical key')}</dt>
          <dd>
            <code>{setting.canonicalKey}</code>
          </dd>
          <dt>{t('pages.featureFlags.valueKind', 'Value kind')}</dt>
          <dd>{setting.valueKind}</dd>
          <dt>{t('pages.featureFlags.safeValue', 'Safe value')}</dt>
          <dd>
            <pre>{JSON.stringify(setting.safeValueJson, null, 2)}</pre>
          </dd>
          <dt>{t('pages.featureFlags.secretRef', 'Secret reference status')}</dt>
          <dd>
            {setting.referenceConfigured
              ? `${setting.referenceProviderType ?? 'provider'} / ${setting.referenceId ?? 'ref'} (${setting.referenceHealthCategory ?? 'unknown'})`
              : t('pages.featureFlags.refMissing', 'No secret reference')}
            {setting.referenceRotationRequired
              ? ` — ${t('pages.featureFlags.rotationRequired', 'Rotation required')}`
              : ''}
          </dd>
        </dl>
        {!canManage ? (
          <p>{t('pages.featureFlags.readOnlySetting', 'You have read-only access to this setting.')}</p>
        ) : (
          <p role="note">
            {t(
              'pages.featureFlags.settingMutateNote',
              'High-impact changes require fresh step-up. Secrets cannot be written here.',
            )}
          </p>
        )}
      </div>
    </PageLayout>
  );
}
