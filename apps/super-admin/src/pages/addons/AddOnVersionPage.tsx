/**
 * Release 47 Step 15 — Add-on version detail + panel routes.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useI18n } from '@booking/i18n/react';
import { PageLayout } from '../../layout/PageLayout';
import { Alert, Checkbox, ConfirmationDialog, Spinner, StatusBadge } from '../../ui';
import { StepUpModal } from '../../auth/StepUpModal';
import { usePlatformAuth } from '../../auth/PlatformAuthProvider';
import { PlatformAuthApiError } from '../../auth/platform-auth-api';
import { useHighImpactAction } from '../../shell/useHighImpactAction';
import { canManageAddOns, canViewAddOns } from './addon-permissions';
import { AddOnVersionTabNav, StaticCommercialPreviewBanner } from './AddOnVersionTabNav';
import {
  isAddOnVersionMutable,
  versionLifecycleTone,
  type AddOnLimitEffect,
  type AddOnLimitEffectType,
  type AddOnVersion,
  type AddOnVersionCompare,
  type AddOnVersionPanel,
  type AddOnVersionReadiness,
} from './addons-shared';

type CatalogPick = {
  id: string;
  canonicalKey: string;
  kind: string;
  displayName: string;
  lifecycle: string;
};

type AddOnVersionPageProps = {
  panel: AddOnVersionPanel;
};

export function AddOnVersionPage({ panel }: AddOnVersionPageProps) {
  const { t } = useI18n();
  const { addOnId = '', versionId = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { client, withAccessToken, principal } = usePlatformAuth();
  const clientRef = useRef(client);
  const withAccessTokenRef = useRef(withAccessToken);
  clientRef.current = client;
  withAccessTokenRef.current = withAccessToken;
  const highImpact = useHighImpactAction();

  const canView = canViewAddOns(principal);
  const canManage = canManageAddOns(principal);

  const [version, setVersion] = useState<AddOnVersion | null>(null);
  const [readiness, setReadiness] = useState<AddOnVersionReadiness | null>(null);
  const [compare, setCompare] = useState<AddOnVersionCompare | null>(null);
  const [siblingVersions, setSiblingVersions] = useState<AddOnVersion[]>([]);
  const [catalogModules, setCatalogModules] = useState<CatalogPick[]>([]);
  const [catalogFeatures, setCatalogFeatures] = useState<CatalogPick[]>([]);
  const [catalogLimits, setCatalogLimits] = useState<CatalogPick[]>([]);
  const [planKeys, setPlanKeys] = useState<Array<{ id: string; canonicalKey: string; displayName: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [selectedEntitlementIds, setSelectedEntitlementIds] = useState<Set<string>>(new Set());
  const [entitlementKind, setEntitlementKind] = useState<'MODULE' | 'FEATURE'>('MODULE');
  const [entitlementSearch, setEntitlementSearch] = useState('');
  const [limitEffects, setLimitEffects] = useState<AddOnLimitEffect[]>([]);
  const [selectedPlanKeys, setSelectedPlanKeys] = useState<Set<string>>(new Set());
  const [compareRightId, setCompareRightId] = useState(searchParams.get('rightId') ?? '');

  const mutable = version ? isAddOnVersionMutable(version.lifecycle) : false;
  const readOnly = !mutable || !canManage;

  const load = useCallback(async () => {
    if (!canView || !addOnId || !versionId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const raw = (await withAccessTokenRef.current((token) =>
        clientRef.current.getPlatformAddOnVersion(token, addOnId, versionId),
      )) as AddOnVersion;
      setVersion(raw);
      setSelectedEntitlementIds(new Set((raw.entitlements ?? []).map((e) => e.catalogItemId)));
      setLimitEffects(raw.limitEffects ?? []);
      setSelectedPlanKeys(new Set((raw.applicability ?? []).map((a) => a.planCanonicalKey)));

      if (panel === 'readiness' || panel === 'overview') {
        const ready = (await withAccessTokenRef.current((token) =>
          clientRef.current.getPlatformAddOnVersionReadiness(token, addOnId, versionId),
        )) as AddOnVersionReadiness;
        setReadiness(ready);
      }

      if (panel === 'entitlements' || panel === 'limits' || panel === 'applicability') {
        const [modules, features, limits, plans] = await Promise.all([
          withAccessTokenRef.current((token) =>
            clientRef.current.listHealthcareCatalogItems(token, { kind: 'MODULE', pageSize: 100 }),
          ),
          withAccessTokenRef.current((token) =>
            clientRef.current.listHealthcareCatalogItems(token, { kind: 'FEATURE', pageSize: 100 }),
          ),
          withAccessTokenRef.current((token) =>
            clientRef.current.listHealthcareCatalogItems(token, { kind: 'LIMIT', pageSize: 100 }),
          ),
          withAccessTokenRef.current((token) =>
            clientRef.current.listPlatformPlans(token, { pageSize: 100 }),
          ),
        ]);
        setCatalogModules(modules.items as CatalogPick[]);
        setCatalogFeatures(features.items as CatalogPick[]);
        setCatalogLimits(limits.items as CatalogPick[]);
        setPlanKeys(
          plans.items.map((p) => ({
            id: p.id,
            canonicalKey: p.canonicalKey,
            displayName: p.displayName,
          })),
        );
      }

      if (panel === 'compare') {
        const siblings = await withAccessTokenRef.current((token) =>
          clientRef.current.listPlatformAddOnVersions(token, addOnId),
        );
        const items = siblings.items as AddOnVersion[];
        setSiblingVersions(items.filter((v) => v.id !== versionId));
        const rightId = searchParams.get('rightId') || items.find((v) => v.id !== versionId)?.id || '';
        setCompareRightId(rightId);
        if (rightId) {
          const diff = (await withAccessTokenRef.current((token) =>
            clientRef.current.comparePlatformAddOnVersions(token, addOnId, versionId, rightId),
          )) as AddOnVersionCompare;
          setCompare(diff);
        } else {
          setCompare(null);
        }
      }
    } catch (err) {
      setError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('pages.addons.version.loadError', 'Unable to load add-on version.'),
      );
      setVersion(null);
    } finally {
      setLoading(false);
    }
  }, [addOnId, canView, panel, searchParams, t, versionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const entitlementCatalog = entitlementKind === 'MODULE' ? catalogModules : catalogFeatures;
  const filteredEntitlements = useMemo(() => {
    const q = entitlementSearch.trim().toLowerCase();
    return entitlementCatalog.filter((item) => {
      if (!q) return true;
      return `${item.canonicalKey} ${item.displayName}`.toLowerCase().includes(q);
    });
  }, [entitlementCatalog, entitlementSearch]);

  async function saveEntitlements() {
    if (!version || readOnly) return;
    setSubmitting(true);
    setSaveError(null);
    try {
      const updated = (await withAccessToken((token) =>
        client.replacePlatformAddOnEntitlements(
          token,
          addOnId,
          versionId,
          {
            expectedRowVersion: version.rowVersion,
            catalogItemIds: [...selectedEntitlementIds],
          },
          crypto.randomUUID(),
        ),
      )) as AddOnVersion;
      setVersion(updated);
      setSelectedEntitlementIds(new Set((updated.entitlements ?? []).map((e) => e.catalogItemId)));
    } catch (err) {
      setSaveError(
        err instanceof PlatformAuthApiError && err.status === 409
          ? t('pages.addons.staleVersion', 'This add-on changed. Reload and retry — your edits were kept on screen.')
          : err instanceof PlatformAuthApiError
            ? err.message
            : t('pages.addons.saveError', 'Unable to save add-on.'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function saveLimitEffects() {
    if (!version || readOnly) return;
    setSubmitting(true);
    setSaveError(null);
    try {
      const updated = (await withAccessToken((token) =>
        client.replacePlatformAddOnLimitEffects(
          token,
          addOnId,
          versionId,
          {
            expectedRowVersion: version.rowVersion,
            effects: limitEffects.map((e) => ({
              catalogItemId: e.catalogItemId,
              effectType: e.effectType,
              unlimited: e.effectType === 'SET_UNLIMITED' || e.unlimited,
              valueText: e.effectType === 'SET_UNLIMITED' ? null : e.valueText,
            })),
          },
          crypto.randomUUID(),
        ),
      )) as AddOnVersion;
      setVersion(updated);
      setLimitEffects(updated.limitEffects ?? []);
    } catch (err) {
      setSaveError(
        err instanceof PlatformAuthApiError && err.status === 409
          ? t('pages.addons.staleVersion', 'This add-on changed. Reload and retry — your edits were kept on screen.')
          : err instanceof PlatformAuthApiError
            ? err.message
            : t('pages.addons.saveError', 'Unable to save add-on.'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function saveApplicability() {
    if (!version || readOnly) return;
    setSubmitting(true);
    setSaveError(null);
    try {
      const updated = (await withAccessToken((token) =>
        client.replacePlatformAddOnApplicability(
          token,
          addOnId,
          versionId,
          {
            expectedRowVersion: version.rowVersion,
            planCanonicalKeys: [...selectedPlanKeys],
          },
          crypto.randomUUID(),
        ),
      )) as AddOnVersion;
      setVersion(updated);
      setSelectedPlanKeys(new Set((updated.applicability ?? []).map((a) => a.planCanonicalKey)));
    } catch (err) {
      setSaveError(
        err instanceof PlatformAuthApiError && err.status === 409
          ? t('pages.addons.staleVersion', 'This add-on changed. Reload and retry — your edits were kept on screen.')
          : err instanceof PlatformAuthApiError
            ? err.message
            : t('pages.addons.saveError', 'Unable to save add-on.'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  function openPublish() {
    if (!version) return;
    highImpact.open({
      kind: 'addon-publish',
      targetId: version.id,
      targetLabel: `v${version.versionNumber}`,
      reasonRequired: true,
      execute: async (reason) => {
        await withAccessToken((token) =>
          client.publishPlatformAddOnVersion(
            token,
            addOnId,
            versionId,
            { expectedRowVersion: version.rowVersion, reason: reason.trim() },
            crypto.randomUUID(),
          ),
        );
        await load();
      },
    });
  }

  function openRetire() {
    if (!version) return;
    highImpact.open({
      kind: 'addon-retire',
      targetId: version.id,
      targetLabel: `v${version.versionNumber}`,
      reasonRequired: true,
      execute: async (reason) => {
        await withAccessToken((token) =>
          client.retirePlatformAddOnVersion(token, addOnId, versionId, {
            expectedRowVersion: version.rowVersion,
            reason: reason.trim(),
          }),
        );
        await load();
      },
    });
  }

  async function onClone() {
    if (!version || !canManage) return;
    const created = await withAccessToken((token) =>
      client.clonePlatformAddOnVersion(token, addOnId, versionId, {}, crypto.randomUUID()),
    );
    navigate(`/add-ons/${addOnId}/versions/${String(created.id)}`);
  }

  async function runCompare(rightId: string) {
    setCompareRightId(rightId);
    if (!rightId) {
      setCompare(null);
      return;
    }
    const diff = (await withAccessToken((token) =>
      client.comparePlatformAddOnVersions(token, addOnId, versionId, rightId),
    )) as AddOnVersionCompare;
    setCompare(diff);
  }

  if (!canView) {
    return (
      <PageLayout title={t('routes.addOnsVersion.title', 'Add-on version')}>
        <Alert tone="warning">
          {t('pages.addons.permissionLimited', 'You do not have addon.view permission.')}
        </Alert>
      </PageLayout>
    );
  }

  if (loading) {
    return (
      <PageLayout title={t('routes.addOnsVersion.title', 'Add-on version')}>
        <Spinner label={t('pages.addons.loading', 'Loading add-ons')} />
      </PageLayout>
    );
  }

  if (!version) {
    return (
      <PageLayout title={t('routes.addOnsVersion.title', 'Add-on version')}>
        <Alert tone="danger">
          {error ?? t('pages.addons.version.loadError', 'Unable to load add-on version.')}
        </Alert>
        <p>
          <Link to={`/add-ons/${addOnId}`}>{t('pages.addons.backToDetail', 'Back to add-on')}</Link>
        </p>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={`v${version.versionNumber}`}
      description={t('routes.addOnsVersion.description', 'Add-on version commercial definition')}
      actions={
        <>
          {canManage && version.lifecycle === 'DRAFT' ? (
            <button type="button" className="sa-button sa-button-primary" onClick={openPublish}>
              {t('pages.addons.version.publish', 'Publish')}
            </button>
          ) : null}
          {canManage && version.lifecycle === 'PUBLISHED' ? (
            <button type="button" className="sa-button" onClick={openRetire}>
              {t('pages.addons.version.retire', 'Retire')}
            </button>
          ) : null}
          {canManage ? (
            <button type="button" className="sa-button" onClick={() => void onClone()}>
              {t('pages.addons.version.clone', 'Clone to draft')}
            </button>
          ) : null}
        </>
      }
    >
      <p>
        <Link to={`/add-ons/${addOnId}`}>{t('pages.addons.backToDetail', 'Back to add-on')}</Link>
      </p>
      <StaticCommercialPreviewBanner />
      {!mutable ? (
        <Alert tone="info">
          {t(
            'pages.addons.version.readOnlyPublished',
            'Published and Retired versions are read-only. Clone to Draft to edit.',
          )}
        </Alert>
      ) : null}

      <dl className="sa-metadata">
        <dt>{t('pages.addons.col.lifecycle', 'Lifecycle')}</dt>
        <dd>
          <StatusBadge label={version.lifecycle} tone={versionLifecycleTone(version.lifecycle)} />
        </dd>
        <dt>{t('pages.addons.version.rowVersion', 'Row version (OCC)')}</dt>
        <dd>{version.rowVersion}</dd>
      </dl>

      <AddOnVersionTabNav addOnId={addOnId} versionId={versionId} active={panel} />

      {panel === 'overview' ? (
        <section>
          <h2>{t('pages.addons.version.tabs.overview', 'Overview')}</h2>
          <ul>
            {(version.translations ?? []).map((tr) => (
              <li key={tr.locale}>
                <strong>{tr.locale}:</strong> {tr.releaseLabel} — {tr.shortDescription}
              </li>
            ))}
          </ul>
          {readiness ? (
            <p>
              {readiness.publicationReady
                ? t('pages.addons.version.ready', 'Ready to publish.')
                : t('pages.addons.version.notReady', 'Not ready to publish.')}
            </p>
          ) : null}
        </section>
      ) : null}

      {panel === 'entitlements' ? (
        <section>
          <h2>{t('pages.addons.version.tabs.entitlements', 'Entitlements')}</h2>
          {saveError ? <Alert tone="danger">{saveError}</Alert> : null}
          <div className="sa-toolbar" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={entitlementKind === 'MODULE' ? 'sa-button sa-button-primary' : 'sa-button'}
              onClick={() => setEntitlementKind('MODULE')}
            >
              MODULE
            </button>
            <button
              type="button"
              className={entitlementKind === 'FEATURE' ? 'sa-button sa-button-primary' : 'sa-button'}
              onClick={() => setEntitlementKind('FEATURE')}
            >
              FEATURE
            </button>
            <input
              className="sa-input"
              value={entitlementSearch}
              onChange={(e) => setEntitlementSearch(e.target.value)}
              placeholder={t('pages.addons.entitlements.search', 'Search catalog')}
            />
          </div>
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th scope="col">{t('pages.addons.entitlements.select', 'Select')}</th>
                  <th scope="col">{t('pages.addons.col.key', 'Canonical key')}</th>
                  <th scope="col">{t('pages.addons.col.name', 'Name')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntitlements.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Checkbox
                        label={item.canonicalKey}
                        checked={selectedEntitlementIds.has(item.id)}
                        disabled={readOnly}
                        onChange={(e) => {
                          if (readOnly) return;
                          const checked = e.target.checked;
                          setSelectedEntitlementIds((prev) => {
                            const next = new Set(prev);
                            if (checked) next.add(item.id);
                            else next.delete(item.id);
                            return next;
                          });
                        }}
                      />
                    </td>
                    <td>
                      <code dir="ltr">{item.canonicalKey}</code>
                    </td>
                    <td>{item.displayName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!readOnly ? (
            <button
              type="button"
              className="sa-button sa-button-primary"
              disabled={submitting}
              onClick={() => void saveEntitlements()}
            >
              {submitting ? t('pages.addons.submitting', 'Saving…') : t('pages.addons.save', 'Save')}
            </button>
          ) : null}
        </section>
      ) : null}

      {panel === 'limits' ? (
        <section>
          <h2>{t('pages.addons.version.tabs.limits', 'Limits')}</h2>
          {saveError ? <Alert tone="danger">{saveError}</Alert> : null}
          <p>
            {t(
              'pages.addons.limits.effectHelp',
              'Effect types: SET_ABSOLUTE, INCREASE_BY, SET_UNLIMITED.',
            )}
          </p>
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th scope="col">{t('pages.addons.col.key', 'Canonical key')}</th>
                  <th scope="col">{t('pages.addons.limits.effectType', 'Effect type')}</th>
                  <th scope="col">{t('pages.addons.limits.value', 'Value')}</th>
                  {!readOnly ? <th scope="col">{t('pages.addons.col.actions', 'Actions')}</th> : null}
                </tr>
              </thead>
              <tbody>
                {limitEffects.map((effect, index) => (
                  <tr key={`${effect.catalogItemId}-${index}`}>
                    <td>
                      <code dir="ltr">{effect.canonicalKey}</code>
                    </td>
                    <td>
                      {readOnly ? (
                        effect.effectType
                      ) : (
                        <select
                          className="sa-select"
                          value={effect.effectType}
                          onChange={(e) => {
                            const effectType = e.target.value as AddOnLimitEffectType;
                            setLimitEffects((prev) =>
                              prev.map((row, i) =>
                                i === index
                                  ? {
                                      ...row,
                                      effectType,
                                      unlimited: effectType === 'SET_UNLIMITED',
                                      valueText: effectType === 'SET_UNLIMITED' ? null : row.valueText,
                                    }
                                  : row,
                              ),
                            );
                          }}
                        >
                          <option value="SET_ABSOLUTE">SET_ABSOLUTE</option>
                          <option value="INCREASE_BY">INCREASE_BY</option>
                          <option value="SET_UNLIMITED">SET_UNLIMITED</option>
                        </select>
                      )}
                    </td>
                    <td>
                      {effect.effectType === 'SET_UNLIMITED' ? (
                        t('pages.addons.limits.unlimited', 'Unlimited')
                      ) : readOnly ? (
                        (effect.valueText ?? '—')
                      ) : (
                        <input
                          className="sa-input"
                          dir="ltr"
                          value={effect.valueText ?? ''}
                          onChange={(e) => {
                            const valueText = e.target.value;
                            setLimitEffects((prev) =>
                              prev.map((row, i) => (i === index ? { ...row, valueText } : row)),
                            );
                          }}
                        />
                      )}
                    </td>
                    {!readOnly ? (
                      <td>
                        <button
                          type="button"
                          className="sa-button"
                          onClick={() =>
                            setLimitEffects((prev) => prev.filter((_, i) => i !== index))
                          }
                        >
                          {t('pages.addons.limits.remove', 'Remove')}
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!readOnly ? (
            <>
              <label>
                {t('pages.addons.limits.add', 'Add limit effect')}
                <select
                  className="sa-select"
                  defaultValue=""
                  onChange={(e) => {
                    const id = e.target.value;
                    if (!id) return;
                    const item = catalogLimits.find((c) => c.id === id);
                    if (!item) return;
                    if (limitEffects.some((l) => l.catalogItemId === id)) return;
                    setLimitEffects((prev) => [
                      ...prev,
                      {
                        catalogItemId: item.id,
                        canonicalKey: item.canonicalKey,
                        effectType: 'SET_ABSOLUTE',
                        unlimited: false,
                        valueText: '0',
                      },
                    ]);
                    e.target.value = '';
                  }}
                >
                  <option value="">{t('pages.addons.limits.choose', 'Choose limit…')}</option>
                  {catalogLimits.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.displayName} ({item.canonicalKey})
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="sa-button sa-button-primary"
                disabled={submitting}
                onClick={() => void saveLimitEffects()}
              >
                {submitting ? t('pages.addons.submitting', 'Saving…') : t('pages.addons.save', 'Save')}
              </button>
            </>
          ) : null}
        </section>
      ) : null}

      {panel === 'applicability' ? (
        <section>
          <h2>{t('pages.addons.version.tabs.applicability', 'Applicability')}</h2>
          <p>
            {t(
              'pages.addons.applicability.help',
              'Select plan canonical keys this add-on version may apply to (commercial definition only).',
            )}
          </p>
          {saveError ? <Alert tone="danger">{saveError}</Alert> : null}
          <ul className="sa-checklist">
            {planKeys.map((plan) => (
              <li key={plan.id}>
                <Checkbox
                  label={
                    <>
                      <code dir="ltr">{plan.canonicalKey}</code> — {plan.displayName}
                    </>
                  }
                  checked={selectedPlanKeys.has(plan.canonicalKey)}
                  disabled={readOnly}
                  onChange={(e) => {
                    if (readOnly) return;
                    const checked = e.target.checked;
                    setSelectedPlanKeys((prev) => {
                      const next = new Set(prev);
                      if (checked) next.add(plan.canonicalKey);
                      else next.delete(plan.canonicalKey);
                      return next;
                    });
                  }}
                />
              </li>
            ))}
          </ul>
          {!readOnly ? (
            <button
              type="button"
              className="sa-button sa-button-primary"
              disabled={submitting}
              onClick={() => void saveApplicability()}
            >
              {submitting ? t('pages.addons.submitting', 'Saving…') : t('pages.addons.save', 'Save')}
            </button>
          ) : null}
        </section>
      ) : null}

      {panel === 'readiness' ? (
        <section>
          <h2>{t('pages.addons.version.tabs.readiness', 'Readiness')}</h2>
          {!readiness ? (
            <Alert tone="info">{t('pages.addons.version.readinessUnavailable', 'Readiness unavailable.')}</Alert>
          ) : (
            <>
              <dl className="sa-metadata">
                <dt>{t('pages.addons.version.publicationReady', 'Publication ready')}</dt>
                <dd>
                  {readiness.publicationReady
                    ? t('pages.addons.yes', 'Yes')
                    : t('pages.addons.no', 'No')}
                </dd>
                <dt>{t('pages.addons.version.runtimeEffective', 'Runtime effective')}</dt>
                <dd>{t('pages.addons.no', 'No')}</dd>
                <dt>{t('pages.addons.version.entitlementCount', 'Entitlements')}</dt>
                <dd>{readiness.entitlementCount}</dd>
                <dt>{t('pages.addons.version.limitEffectCount', 'Limit effects')}</dt>
                <dd>{readiness.limitEffectCount}</dd>
                <dt>{t('pages.addons.version.applicabilityCount', 'Applicability')}</dt>
                <dd>{readiness.applicabilityCount}</dd>
              </dl>
              {readiness.blockers.length > 0 ? (
                <Alert tone="danger" title={t('pages.addons.version.blockers', 'Blockers')}>
                  <ul>
                    {readiness.blockers.map((b) => (
                      <li key={b.code}>{b.message}</li>
                    ))}
                  </ul>
                </Alert>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {panel === 'compare' ? (
        <section>
          <h2>{t('pages.addons.version.tabs.compare', 'Compare')}</h2>
          <label>
            {t('pages.addons.compare.rightVersion', 'Compare against')}
            <select
              className="sa-select"
              value={compareRightId}
              onChange={(e) => void runCompare(e.target.value)}
            >
              <option value="">{t('pages.addons.compare.choose', 'Choose version…')}</option>
              {siblingVersions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.versionNumber} ({v.lifecycle})
                </option>
              ))}
            </select>
          </label>
          {!compare ? (
            <Alert tone="info">{t('pages.addons.compare.missingRight', 'Select a version to compare against.')}</Alert>
          ) : (
            <>
              <h3>{t('pages.addons.compare.added', 'Added')}</h3>
              <ul>
                {compare.entitlementsAdded.length === 0 ? (
                  <li>—</li>
                ) : (
                  compare.entitlementsAdded.map((k) => (
                    <li key={k}>
                      <code dir="ltr">{k}</code>
                    </li>
                  ))
                )}
              </ul>
              <h3>{t('pages.addons.compare.removed', 'Removed')}</h3>
              <ul>
                {compare.entitlementsRemoved.length === 0 ? (
                  <li>—</li>
                ) : (
                  compare.entitlementsRemoved.map((k) => (
                    <li key={k}>
                      <code dir="ltr">{k}</code>
                    </li>
                  ))
                )}
              </ul>
            </>
          )}
        </section>
      ) : null}

      <ConfirmationDialog {...highImpact.dialogProps} />
      <StepUpModal
        open={highImpact.stepUpProps.open}
        onClose={highImpact.stepUpProps.onClose}
        onVerified={highImpact.stepUpProps.onVerified}
      />
    </PageLayout>
  );
}

export function AddOnVersionOverviewPage() {
  return <AddOnVersionPage panel="overview" />;
}
export function AddOnVersionEntitlementsPage() {
  return <AddOnVersionPage panel="entitlements" />;
}
export function AddOnVersionLimitsPage() {
  return <AddOnVersionPage panel="limits" />;
}
export function AddOnVersionApplicabilityPage() {
  return <AddOnVersionPage panel="applicability" />;
}
export function AddOnVersionReadinessPage() {
  return <AddOnVersionPage panel="readiness" />;
}
export function AddOnVersionComparePage() {
  return <AddOnVersionPage panel="compare" />;
}
