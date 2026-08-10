import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { Alert, Checkbox, ConfirmationDialog, Spinner } from '../../ui';
import { usePlatformAuth } from '../../auth/PlatformAuthProvider';
import { PlatformAuthApiError } from '../../auth/platform-auth-api';
import {
  type EntitlementCatalogKind,
  type EntitlementGrantKind,
  type PlanVersionEntitlements,
} from './plans-shared';
import { canManagePlanEntitlements } from './plan-permissions';
import { PlanVersionLegacyUnconfiguredNotice, PlanVersionPreviewBanner } from './PlanVersionTabNav';

type EntitlementEditorKind = 'MODULE' | 'FEATURE';

const EDITOR_KINDS: EntitlementEditorKind[] = ['MODULE', 'FEATURE'];

function grantKey(kind: string, canonicalKey: string) {
  return `${kind}:${canonicalKey}`;
}

type PlanVersionEntitlementsPanelProps = {
  planId: string;
  versionId: string;
  readOnly: boolean;
  legacyUnconfigured?: boolean;
  onClone?: () => void;
  onRowVersionChange?: (rowVersion: number) => void;
};

export function PlanVersionEntitlementsPanel({
  planId,
  versionId,
  readOnly,
  legacyUnconfigured,
  onClone,
  onRowVersionChange,
}: PlanVersionEntitlementsPanelProps) {
  const { t } = useI18n();
  const { client, withAccessToken, principal } = usePlatformAuth();
  const clientRef = useRef(client);
  const withAccessTokenRef = useRef(withAccessToken);
  clientRef.current = client;
  withAccessTokenRef.current = withAccessToken;
  const canManage = canManagePlanEntitlements(principal) && !readOnly;

  const [data, setData] = useState<PlanVersionEntitlements | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [kindTab, setKindTab] = useState<EntitlementEditorKind>('MODULE');
  const [search, setSearch] = useState('');
  const [lifecycleFilter, setLifecycleFilter] = useState('');
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyPending, setApplyPending] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = (await withAccessTokenRef.current((token) =>
        clientRef.current.getPlatformPlanVersionEntitlements(token, planId, versionId),
      )) as PlanVersionEntitlements;
      setData(raw);
      onRowVersionChange?.(raw.rowVersion);
      setSelected(
        new Set(raw.grants.map((g) => grantKey(g.kind, g.canonicalKey))),
      );
    } catch (err) {
      if (err instanceof PlatformAuthApiError && err.status === 404) {
        setError(
          t(
            'pages.plans.entitlements.apiUnavailable',
            'Entitlements API is not available yet. Backend Step 14 routes may be missing.',
          ),
        );
      } else {
        setError(
          err instanceof PlatformAuthApiError
            ? err.message
            : t('pages.plans.entitlements.loadError', 'Unable to load entitlements.'),
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

  const filteredItems = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.catalogItems.filter((item) => {
      if (kindTab === 'MODULE' && item.kind !== 'MODULE' && item.kind !== 'FACILITY_TYPE') return false;
      if (kindTab === 'FEATURE' && item.kind !== 'FEATURE' && item.kind !== 'SPECIALTY') return false;
      if (lifecycleFilter && item.lifecycle !== lifecycleFilter) return false;
      if (selectedOnly && !selected.has(grantKey(item.kind === 'FACILITY_TYPE' || item.kind === 'SPECIALTY' ? kindTab : item.kind, item.canonicalKey))) {
        return false;
      }
      if (q) {
        const hay = `${item.canonicalKey} ${item.displayName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data, kindTab, lifecycleFilter, search, selected, selectedOnly]);

  function toggleItem(itemKind: EntitlementCatalogKind, canonicalKey: string, selectable: boolean) {
    if (!selectable || !canManage) return;
    const effectiveKind: EntitlementGrantKind =
      itemKind === 'MODULE' || itemKind === 'FEATURE' ? itemKind : kindTab;
    const key = grantKey(effectiveKind, canonicalKey);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function onSave() {
    if (!data || !canManage) return;
    setSubmitting(true);
    setSaveError(null);
    const grants = [...selected].map((key) => {
      const [kind, ...rest] = key.split(':');
      return { kind, canonicalKey: rest.join(':') };
    });
    try {
      const updated = (await withAccessToken((token) =>
        client.updatePlatformPlanVersionEntitlements(token, planId, versionId, {
          expectedRowVersion: data.rowVersion,
          grants,
        }),
      )) as PlanVersionEntitlements;
      setData(updated);
      onRowVersionChange?.(updated.rowVersion);
      setSelected(new Set(updated.grants.map((g) => grantKey(g.kind, g.canonicalKey))));
    } catch (err) {
      if (err instanceof PlatformAuthApiError && err.status === 409) {
        setSaveError(t('pages.plans.staleVersion', 'This version changed. Reload and retry — your edits were kept on screen.'));
      } else {
        setSaveError(
          err instanceof PlatformAuthApiError
            ? err.message
            : t('pages.plans.entitlements.saveError', 'Unable to save entitlements.'),
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function onApplyRequired() {
    if (!data || !canManage) return;
    setApplyPending(true);
    setApplyError(null);
    try {
      const updated = (await withAccessToken((token) =>
        client.applyRequiredPlatformPlanVersionEntitlements(token, planId, versionId, {
          expectedRowVersion: data.rowVersion,
        }),
      )) as PlanVersionEntitlements;
      setData(updated);
      onRowVersionChange?.(updated.rowVersion);
      setSelected(new Set(updated.grants.map((g) => grantKey(g.kind, g.canonicalKey))));
      setApplyOpen(false);
    } catch (err) {
      if (err instanceof PlatformAuthApiError && err.status === 409) {
        setApplyError(t('pages.plans.staleVersion', 'This version changed. Reload and retry — your edits were kept on screen.'));
      } else {
        setApplyError(
          err instanceof PlatformAuthApiError
            ? err.message
            : t('pages.plans.entitlements.applyError', 'Unable to apply required entitlements.'),
        );
      }
    } finally {
      setApplyPending(false);
    }
  }

  if (loading) {
    return <Spinner label={t('pages.plans.entitlements.loading', 'Loading entitlements…')} />;
  }

  if (error) {
    return <Alert tone="danger">{error}</Alert>;
  }

  if (!data) return null;

  const showLegacy = legacyUnconfigured ?? data.legacyUnconfigured;
  const effectiveReadOnly = readOnly || data.readOnly;

  return (
    <section aria-labelledby="entitlements-heading">
      <h2 id="entitlements-heading">{t('pages.plans.version.tabs.entitlements', 'Entitlements')}</h2>
      <PlanVersionPreviewBanner />
      {showLegacy && effectiveReadOnly ? (
        <PlanVersionLegacyUnconfiguredNotice onClone={onClone} />
      ) : null}
      {data.availability?.status === 'unavailable' ? (
        <Alert tone="warning">
          {t('pages.plans.entitlements.unavailable', 'Entitlements are unavailable for this version.')}
        </Alert>
      ) : null}
      {data.dependencyWarnings.length > 0 ? (
        <Alert tone="warning" title={t('pages.plans.entitlements.dependencyWarnings', 'Dependency warnings')}>
          <ul>
            {data.dependencyWarnings.map((w) => (
              <li key={`${w.code}-${w.subjectKey}`}>{w.message}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
      {data.requiredMissing.length > 0 ? (
        <Alert tone="info" title={t('pages.plans.entitlements.requiredMissing', 'Required dependencies missing')}>
          <ul>
            {data.requiredMissing.map((m) => (
              <li key={m.canonicalKey}>
                <code dir="ltr">{m.canonicalKey}</code> — {m.displayName}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}
      {saveError ? <Alert tone="danger">{saveError}</Alert> : null}

      <div className="sa-tab-nav" role="tablist" aria-label={t('pages.plans.entitlements.kindTabs', 'Entitlement kinds')}>
        {EDITOR_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kindTab === k}
            className={kindTab === k ? 'sa-tab sa-tab-active' : 'sa-tab'}
            onClick={() => setKindTab(k)}
          >
            {t(`routes.catalog.kind.${k}`, k)}
          </button>
        ))}
      </div>

      <div className="sa-filter-row">
        <label>
          {t('plansPage.searchLabel', 'Search')}
          <input
            className="sa-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('pages.plans.entitlements.searchPlaceholder', 'Search keys or names')}
          />
        </label>
        <label>
          {t('plansPage.lifecycleFilter', 'Lifecycle filter')}
          <select value={lifecycleFilter} onChange={(e) => setLifecycleFilter(e.target.value)}>
            <option value="">{t('plansPage.allLifecycles', 'All lifecycles')}</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="DRAFT">DRAFT</option>
            <option value="DEPRECATED">DEPRECATED</option>
          </select>
        </label>
        <Checkbox
          label={t('pages.plans.entitlements.selectedOnly', 'Selected only')}
          checked={selectedOnly}
          onChange={(e) => setSelectedOnly(e.target.checked)}
        />
      </div>

      {filteredItems.length === 0 ? (
        <p>{t('pages.plans.entitlements.empty', 'No catalog items match the current filters.')}</p>
      ) : (
        <ul className="sa-checklist">
          {filteredItems.map((item) => {
            const isNonCommercial =
              item.kind === 'FACILITY_TYPE' || item.kind === 'SPECIALTY';
            const effectiveKind: EntitlementGrantKind = isNonCommercial
              ? kindTab
              : item.kind === 'MODULE' || item.kind === 'FEATURE'
                ? item.kind
                : kindTab;
            const checked = selected.has(grantKey(effectiveKind, item.canonicalKey));
            const disabled = effectiveReadOnly || !canManage || !item.selectable || isNonCommercial;
            return (
              <li key={`${item.kind}-${item.canonicalKey}`}>
                <Checkbox
                  label={
                    <>
                      <strong>{item.displayName}</strong>{' '}
                      <code dir="ltr">{item.canonicalKey}</code>{' '}
                      <span className="sa-muted">({item.lifecycle})</span>
                      {isNonCommercial ? (
                        <span className="sa-badge sa-badge-neutral">
                          {t('pages.plans.entitlements.notSelectable', 'Not a commercial grant')}
                        </span>
                      ) : null}
                      {!item.selectable && !isNonCommercial ? (
                        <span className="sa-muted">{item.unselectableReason}</span>
                      ) : null}
                    </>
                  }
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggleItem(item.kind, item.canonicalKey, item.selectable && !isNonCommercial)}
                />
              </li>
            );
          })}
        </ul>
      )}

      {canManage ? (
        <div className="sa-form-actions">
          <button
            type="button"
            className="sa-button"
            onClick={() => {
              setApplyError(null);
              setApplyOpen(true);
            }}
            disabled={submitting}
          >
            {t('pages.plans.entitlements.applyRequired', 'Apply required dependencies')}
          </button>
          <button type="button" className="sa-button sa-button-primary" onClick={() => void onSave()} disabled={submitting}>
            {submitting ? t('pages.plans.submitting', 'Saving…') : t('plansPage.save', 'Save')}
          </button>
          <button type="button" className="sa-button" onClick={() => void load()} disabled={submitting}>
            {t('plansPage.refresh', 'Refresh')}
          </button>
        </div>
      ) : effectiveReadOnly ? (
        <p className="sa-muted">{t('pages.plans.entitlements.readOnly', 'Published and retired versions are read-only.')}</p>
      ) : (
        <Alert tone="warning">
          {t('pages.plans.entitlements.manageDenied', 'You do not have plan-entitlement.manage permission.')}
        </Alert>
      )}

      <ConfirmationDialog
        open={applyOpen}
        title={t('pages.plans.entitlements.applyRequiredTitle', 'Apply required entitlements?')}
        description={t(
          'pages.plans.entitlements.applyRequiredBody',
          'Adds catalog-required module and feature grants implied by your current selection. This updates the draft atomically.',
        )}
        confirmLabel={t('pages.plans.entitlements.applyRequiredConfirm', 'Apply required')}
        pending={applyPending}
        error={applyError}
        onConfirm={() => void onApplyRequired()}
        onClose={() => {
          if (!applyPending) setApplyOpen(false);
        }}
      />
    </section>
  );
}
