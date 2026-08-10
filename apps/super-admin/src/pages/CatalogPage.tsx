/**
 * Release 47 Step 12 — Healthcare Catalog management UI.
 * Catalog content translations come from the API; UI chrome uses message catalogs.
 */
import { FormEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useI18n } from '@booking/i18n/react';
import { PageLayout } from '../layout/PageLayout';
import { Alert, ConfirmationDialog, EmptyState, Spinner, StatusBadge } from '../ui';
import { StepUpModal } from '../auth/StepUpModal';
import { usePlatformAuth } from '../auth/PlatformAuthProvider';
import { hasPermission } from '../auth/permissions';
import {
  PlatformAuthApiError,
  type HealthcareCatalogItemDetail,
  type HealthcareCatalogRule,
} from '../auth/platform-auth-api';
import { useHighImpactAction } from '../shell/useHighImpactAction';

type CatalogKind =
  | 'FACILITY_TYPE'
  | 'SPECIALTY'
  | 'MODULE'
  | 'FEATURE'
  | 'LIMIT';

const KINDS: CatalogKind[] = [
  'FACILITY_TYPE',
  'SPECIALTY',
  'MODULE',
  'FEATURE',
  'LIMIT',
];

const KIND_PREFIX: Record<CatalogKind, string> = {
  FACILITY_TYPE: 'facility_type.',
  SPECIALTY: 'specialty.',
  MODULE: 'module.',
  FEATURE: 'feature.',
  LIMIT: 'limit.',
};

const RULE_TYPES = [
  'REQUIRES',
  'REQUIRES_ANY_OF',
  'INCOMPATIBLE_WITH',
  'ALLOWED_FOR',
  'NOT_ALLOWED_FOR',
] as const;

const ICON_OPTIONS = [
  'clinic',
  'dental',
  'cosmetic',
  'lab',
  'radiology',
  'hospital',
  'multi',
  'module',
  'feature',
  'limit',
] as const;

const LIMIT_VALUE_TYPES = ['INTEGER', 'DECIMAL', 'DURATION', 'BYTES', 'COUNT'] as const;
const LIMIT_UNITS = [
  'count',
  'users',
  'providers',
  'branches',
  'bytes',
  'megabytes',
  'gigabytes',
  'days',
  'hours',
  'minutes',
  'percent',
] as const;

function viewPermissionFor(kind: CatalogKind): string {
  switch (kind) {
    case 'FACILITY_TYPE':
      return 'facility-type.view';
    case 'SPECIALTY':
      return 'specialty.view';
    case 'MODULE':
      return 'module.view';
    case 'FEATURE':
      return 'feature.view';
    case 'LIMIT':
      return 'limit.view';
  }
}

function managePermissionFor(kind: CatalogKind): string {
  switch (kind) {
    case 'FACILITY_TYPE':
      return 'facility-type.manage';
    case 'SPECIALTY':
      return 'specialty.manage';
    case 'MODULE':
      return 'module.manage';
    case 'FEATURE':
      return 'feature.manage';
    case 'LIMIT':
      return 'limit.manage';
  }
}

function tr(
  detail: HealthcareCatalogItemDetail | null,
  locale: string,
): { displayName: string; shortDescription: string } {
  const row = detail?.translations.find((t) => t.locale === locale);
  return {
    displayName: row?.displayName ?? '',
    shortDescription: row?.shortDescription ?? '',
  };
}

export function CatalogPage() {
  const { t } = useI18n();
  const { client, withAccessToken, principal } = usePlatformAuth();
  const highImpact = useHighImpactAction();
  const formId = useId();
  const clientRef = useRef(client);
  const withAccessTokenRef = useRef(withAccessToken);
  clientRef.current = client;
  withAccessTokenRef.current = withAccessToken;

  const permissionKeys = principal?.permissions?.join('\0') ?? '';
  const viewableKinds = useMemo(
    () => KINDS.filter((k) => hasPermission(principal, viewPermissionFor(k))),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- permissionKeys is the stable fingerprint
    [permissionKeys],
  );
  const canRead = viewableKinds.length > 0 || hasPermission(principal, 'compatibility-rule.view');
  const canPreview = hasPermission(principal, 'compatibility-rule.view');
  const canManageRules = hasPermission(principal, 'compatibility-rule.manage');

  const [kind, setKind] = useState<CatalogKind>(viewableKinds[0] ?? 'FACILITY_TYPE');
  const canManageKind = hasPermission(principal, managePermissionFor(kind));
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [lifecycle, setLifecycle] = useState('');
  const [missingOnly, setMissingOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<
    Array<{
      id: string;
      canonicalKey: string;
      displayName: string;
      lifecycle: string;
      missingTranslations: string[];
      referenceCount: number;
      version: number;
      systemSeeded: boolean;
    }>
  >([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 25,
    total: 0,
    hasNextPage: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [driftSummary, setDriftSummary] = useState<{
    errors: number;
    warnings: number;
  } | null>(null);

  const [mode, setMode] = useState<'list' | 'create' | 'detail'>('list');
  const [detail, setDetail] = useState<HealthcareCatalogItemDetail | null>(null);
  const [refs, setRefs] = useState<
    Array<{
      sourceType: string;
      count: number;
      availability: string;
      reasonCode?: string;
      keys?: string[];
    }>
  >([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Create/edit form fields (never persisted to browser storage)
  const [canonicalKey, setCanonicalKey] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [iconKey, setIconKey] = useState('');
  const [displayNameEn, setDisplayNameEn] = useState('');
  const [shortDescEn, setShortDescEn] = useState('');
  const [displayNameAr, setDisplayNameAr] = useState('');
  const [shortDescAr, setShortDescAr] = useState('');
  const [parentKey, setParentKey] = useState('');
  const [owningModuleKey, setOwningModuleKey] = useState('');
  const [limitValueType, setLimitValueType] = useState('INTEGER');
  const [limitUnit, setLimitUnit] = useState('count');
  const [limitMin, setLimitMin] = useState('');
  const [limitMax, setLimitMax] = useState('');
  const [limitZeroValid, setLimitZeroValid] = useState(false);
  const [limitUnlimited, setLimitUnlimited] = useState(false);
  const [aliasValue, setAliasValue] = useState('');
  const [aliasNamespace, setAliasNamespace] = useState('admin');

  const [rules, setRules] = useState<HealthcareCatalogRule[]>([]);
  const [ruleType, setRuleType] = useState<(typeof RULE_TYPES)[number]>('REQUIRES');
  const [ruleSubject, setRuleSubject] = useState('');
  const [ruleTarget, setRuleTarget] = useState('');
  const [ruleAnyOf, setRuleAnyOf] = useState('');
  const [ruleExplEn, setRuleExplEn] = useState('');
  const [ruleExplAr, setRuleExplAr] = useState('');
  const [selectorKeys, setSelectorKeys] = useState<string[]>([]);

  const [facilityKey, setFacilityKey] = useState('facility_type.dental_clinic');
  const [moduleKey, setModuleKey] = useState('module.dental');
  const [specialtyKey, setSpecialtyKey] = useState('specialty.dentistry');
  const [preview, setPreview] = useState<{
    valid: boolean;
    violations: Array<{ reasonCode: string; message: string }>;
    warnings: Array<{ reasonCode: string; message: string }>;
  } | null>(null);

  useEffect(() => {
    if (viewableKinds.length && !viewableKinds.includes(kind)) {
      setKind(viewableKinds[0]!);
    }
  }, [viewableKinds, kind]);

  const reloadList = useCallback(() => {
    if (!canRead || !viewableKinds.includes(kind)) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void withAccessTokenRef.current((token) =>
      clientRef.current.listHealthcareCatalogItems(token, {
        kind,
        search: appliedSearch,
        lifecycle: lifecycle || undefined,
        missingTranslation: missingOnly ? 'true' : undefined,
        page,
        pageSize: 25,
      }),
    )
      .then((res) => {
        if (!cancelled) {
          setItems(res.items);
          setPagination(res.pagination);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof PlatformAuthApiError
              ? err.message
              : t('routes.catalog.loadError', 'Unable to load catalog.'),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canRead, kind, appliedSearch, lifecycle, missingOnly, page, viewableKinds]);

  useEffect(() => reloadList(), [reloadList]);

  useEffect(() => {
    if (!hasPermission(principal, 'module.view')) return;
    void withAccessTokenRef.current((token) =>
      clientRef.current.getHealthcareCatalogDriftReport(token),
    ).then((report) => {
      setDriftSummary({
        errors: report.summary.errors,
        warnings: report.summary.warnings,
      });
    });
  }, [permissionKeys]);

  useEffect(() => {
    if (!canPreview) return;
    void withAccessTokenRef.current((token) =>
      clientRef.current.listHealthcareCatalogCompatibilityRules(token),
    ).then((res) => setRules(res.items));
  }, [canPreview, permissionKeys]);

  useEffect(() => {
    void withAccessTokenRef
      .current(async (token) => {
        const [modules, features, facilities, specialties, limits] = await Promise.all([
          clientRef.current.listHealthcareCatalogItems(token, {
            kind: 'MODULE',
            pageSize: 100,
          }),
          clientRef.current.listHealthcareCatalogItems(token, {
            kind: 'FEATURE',
            pageSize: 100,
          }),
          clientRef.current.listHealthcareCatalogItems(token, {
            kind: 'FACILITY_TYPE',
            pageSize: 100,
          }),
          clientRef.current.listHealthcareCatalogItems(token, {
            kind: 'SPECIALTY',
            pageSize: 100,
          }),
          clientRef.current.listHealthcareCatalogItems(token, {
            kind: 'LIMIT',
            pageSize: 100,
          }),
        ]);
        setSelectorKeys(
          Array.from(
            new Set(
              [
                ...modules.items,
                ...features.items,
                ...facilities.items,
                ...specialties.items,
                ...limits.items,
              ].map((i) => i.canonicalKey),
            ),
          ),
        );
      })
      .catch(() => undefined);
  }, []);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(search.trim());
  }

  function resetFormFields() {
    setCanonicalKey('');
    setSortOrder(0);
    setIconKey('');
    setDisplayNameEn('');
    setShortDescEn('');
    setDisplayNameAr('');
    setShortDescAr('');
    setParentKey('');
    setOwningModuleKey('');
    setLimitValueType('INTEGER');
    setLimitUnit('count');
    setLimitMin('');
    setLimitMax('');
    setLimitZeroValid(false);
    setLimitUnlimited(false);
    setAliasValue('');
    setAliasNamespace('admin');
    setFormError(null);
  }

  function openCreate() {
    if (!canManageKind) return;
    resetFormFields();
    setMode('create');
    setDetail(null);
  }

  async function openDetail(id: string) {
    setFormError(null);
    setMode('detail');
    const item = await withAccessTokenRef.current((token) =>
      clientRef.current.getHealthcareCatalogItem(token, id),
    );
    setDetail(item);
    const en = tr(item, 'en-US');
    const ar = tr(item, 'ar-SY');
    setCanonicalKey(item.canonicalKey);
    setSortOrder(item.sortOrder);
    setIconKey(item.iconKey ?? '');
    setDisplayNameEn(en.displayName);
    setShortDescEn(en.shortDescription);
    setDisplayNameAr(ar.displayName);
    setShortDescAr(ar.shortDescription);
    setParentKey(item.parentCanonicalKey ?? '');
    setOwningModuleKey(item.owningModuleCanonicalKey ?? '');
    if (item.limit) {
      setLimitValueType(item.limit.valueType);
      setLimitUnit(item.limit.unit);
      setLimitMin(item.limit.min ?? '');
      setLimitMax(item.limit.max ?? '');
      setLimitZeroValid(item.limit.zeroValid);
      setLimitUnlimited(item.limit.unlimitedSupported);
    }
    const references = await withAccessTokenRef.current((token) =>
      clientRef.current.getHealthcareCatalogItemReferences(token, id),
    );
    setRefs(references.buckets);
  }

  async function submitCreate(e: FormEvent) {
    e.preventDefault();
    if (!canManageKind || submitting) return;
    if (!canonicalKey.startsWith(KIND_PREFIX[kind])) {
      setFormError(t('routes.catalog.createError', 'Unable to create catalog item.'));
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const idem = crypto.randomUUID();
      const created = await withAccessToken((token) =>
        client.createHealthcareCatalogItem(
          token,
          {
            kind,
            canonicalKey: canonicalKey.trim(),
            sortOrder,
            iconKey: iconKey || undefined,
            parentCanonicalKey: kind === 'SPECIALTY' ? parentKey || null : undefined,
            owningModuleCanonicalKey:
              kind === 'FEATURE' || kind === 'LIMIT' ? owningModuleKey || null : undefined,
            translations: [
              {
                locale: 'en-US',
                displayName: displayNameEn,
                shortDescription: shortDescEn,
              },
              {
                locale: 'ar-SY',
                displayName: displayNameAr,
                shortDescription: shortDescAr,
              },
            ],
            limit:
              kind === 'LIMIT'
                ? {
                    valueType: limitValueType,
                    unit: limitUnit,
                    min: limitMin === '' ? undefined : Number(limitMin),
                    max: limitMax === '' ? undefined : Number(limitMax),
                    zeroValid: limitZeroValid,
                    unlimitedSupported: limitUnlimited,
                  }
                : undefined,
          },
          idem,
        ),
      );
      await openDetail(created.id);
      reloadList();
    } catch (err: unknown) {
      setFormError(
        err instanceof PlatformAuthApiError
          ? err.message
          : t('routes.catalog.createError', 'Unable to create catalog item.'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function submitUpdate(e: FormEvent) {
    e.preventDefault();
    if (!detail || !canManageKind || submitting) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const updated = await withAccessToken((token) =>
        client.updateHealthcareCatalogItem(token, detail.id, {
          expectedVersion: detail.version,
          sortOrder,
          iconKey: iconKey || null,
          parentCanonicalKey: kind === 'SPECIALTY' ? parentKey || null : undefined,
          owningModuleCanonicalKey:
            kind === 'FEATURE' || kind === 'LIMIT' ? owningModuleKey || null : undefined,
          translations: [
            {
              locale: 'en-US',
              displayName: displayNameEn,
              shortDescription: shortDescEn,
            },
            {
              locale: 'ar-SY',
              displayName: displayNameAr,
              shortDescription: shortDescAr,
            },
          ],
          limit:
            kind === 'LIMIT'
              ? {
                  valueType: limitValueType,
                  unit: limitUnit,
                  min: limitMin === '' ? null : Number(limitMin),
                  max: limitMax === '' ? null : Number(limitMax),
                  zeroValid: limitZeroValid,
                  unlimitedSupported: limitUnlimited,
                }
              : undefined,
        }),
      );
      setDetail(updated);
      reloadList();
    } catch (err: unknown) {
      if (err instanceof PlatformAuthApiError && /stale/i.test(err.message)) {
        setFormError(t('routes.catalog.staleVersion', 'Stale version — form kept.'));
      } else {
        setFormError(
          err instanceof PlatformAuthApiError
            ? err.message
            : t('routes.catalog.saveError', 'Unable to save catalog item.'),
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function submitAlias(e: FormEvent) {
    e.preventDefault();
    if (!detail || !canManageKind || submitting) return;
    setSubmitting(true);
    try {
      const updated = await withAccessToken((token) =>
        client.addHealthcareCatalogAlias(token, detail.id, {
          aliasValue,
          sourceNamespace: aliasNamespace,
          expectedVersion: detail.version,
        }),
      );
      setDetail(updated);
      setAliasValue('');
    } catch (err: unknown) {
      setFormError(err instanceof PlatformAuthApiError ? err.message : 'Alias failed.');
    } finally {
      setSubmitting(false);
    }
  }

  function openLifecycle(
    action: 'catalog-activate' | 'catalog-deprecate' | 'catalog-retire' | 'catalog-reactivate',
  ) {
    if (!detail || !canManageKind) return;
    const api =
      action === 'catalog-activate'
        ? client.activateHealthcareCatalogItem
        : action === 'catalog-deprecate'
          ? client.deprecateHealthcareCatalogItem
          : action === 'catalog-retire'
            ? client.retireHealthcareCatalogItem
            : client.reactivateHealthcareCatalogItem;
    highImpact.open({
      kind: action,
      targetId: detail.id,
      targetLabel: detail.canonicalKey,
      reasonRequired: true,
      execute: async (reason) => {
        const updated = await withAccessToken((token) =>
          api.call(client, token, detail.id, {
            expectedVersion: detail.version,
            reason,
          }),
        );
        setDetail(updated);
        reloadList();
      },
    });
  }

  async function submitRule(e: FormEvent) {
    e.preventDefault();
    if (!canManageRules || submitting) return;
    if (ruleSubject === ruleTarget) {
      setFormError('Self-reference is not allowed.');
      return;
    }
    setSubmitting(true);
    try {
      await withAccessToken((token) =>
        client.createHealthcareCatalogCompatibilityRule(
          token,
          {
            ruleType,
            subjectKey: ruleSubject,
            targetKey: ruleTarget,
            anyOfGroupKey: ruleType === 'REQUIRES_ANY_OF' ? ruleAnyOf : undefined,
            explanationEn: ruleExplEn,
            explanationAr: ruleExplAr,
          },
          crypto.randomUUID(),
        ),
      );
      const res = await withAccessToken((token) =>
        client.listHealthcareCatalogCompatibilityRules(token),
      );
      setRules(res.items);
      setRuleExplEn('');
      setRuleExplAr('');
    } catch (err: unknown) {
      setFormError(err instanceof PlatformAuthApiError ? err.message : 'Rule create failed.');
    } finally {
      setSubmitting(false);
    }
  }

  function openRuleLifecycle(rule: HealthcareCatalogRule, action: 'activate' | 'retire') {
    if (!canManageRules) return;
    highImpact.open({
      kind: action === 'activate' ? 'catalog-rule-activate' : 'catalog-rule-retire',
      targetId: rule.id,
      targetLabel: `${rule.subjectKey} → ${rule.targetKey}`,
      reasonRequired: true,
      execute: async (reason) => {
        const api =
          action === 'activate'
            ? client.activateHealthcareCatalogCompatibilityRule
            : client.retireHealthcareCatalogCompatibilityRule;
        await withAccessToken((token) =>
          api.call(client, token, rule.id, {
            expectedVersion: rule.version,
            reason,
          }),
        );
        const res = await withAccessToken((token) =>
          client.listHealthcareCatalogCompatibilityRules(token),
        );
        setRules(res.items);
      },
    });
  }

  async function runPreview(e: FormEvent) {
    e.preventDefault();
    if (!canPreview) return;
    setPreview(null);
    const result = await withAccessToken((token) =>
      client.validateHealthcareCatalogSelection(token, {
        facilityTypeKey: facilityKey,
        moduleKeys: moduleKey ? [moduleKey] : [],
        specialtyKeys: specialtyKey ? [specialtyKey] : [],
      }),
    );
    setPreview(result);
  }

  if (!canRead) {
    return (
      <PageLayout
        title={t('routes.catalog.title', 'Catalog')}
        description={t('routes.catalog.description', 'Healthcare catalog')}
      >
        <Alert tone="warning">
          {t('routes.catalog.permissionLimited', 'Permission limited')}
        </Alert>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={t('routes.catalog.title', 'Catalog')}
      description={t(
        'routes.catalog.description',
        'Facility types, specialties, modules, features, limits, and compatibility rules.',
      )}
    >
      <Alert tone="info" title={t('routes.catalog.boundaryTitle', 'Catalog metadata only')}>
        {t(
          'routes.catalog.boundaryBody',
          'This catalog does not grant tenant entitlements, change clinic navigation, or provision tenants. LicensingEngineService remains the runtime authority until a later step.',
        )}
      </Alert>

      {driftSummary ? (
        <p className="sa-meta">
          {t('routes.catalog.driftLabel', 'Drift')}: {driftSummary.errors}{' '}
          {t('routes.catalog.errors', 'errors')}, {driftSummary.warnings}{' '}
          {t('routes.catalog.warnings', 'warnings')}
        </p>
      ) : null}

      <div
        className="sa-filter-row"
        role="tablist"
        aria-label={t('routes.catalog.kinds', 'Catalog kinds')}
      >
        {viewableKinds.map((k) => (
          <button
            key={k}
            type="button"
            className={`sa-button sa-button-quiet${kind === k ? ' is-active' : ''}`}
            aria-selected={kind === k}
            onClick={() => {
              setKind(k);
              setPage(1);
              setMode('list');
            }}
          >
            {t(`routes.catalog.kind.${k}`, k)}
          </button>
        ))}
      </div>

      {mode === 'list' ? (
        <>
          <form className="sa-filter-row" onSubmit={onSearch}>
            <label className="sa-field" htmlFor={`${formId}-search`}>
              {t('routes.catalog.searchLabel', 'Search')}{' '}
              <input
                id={`${formId}-search`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                maxLength={64}
                dir="ltr"
              />
            </label>
            <label className="sa-field" htmlFor={`${formId}-lifecycle`}>
              {t('routes.catalog.lifecycleFilter', 'Lifecycle')}{' '}
              <select
                id={`${formId}-lifecycle`}
                value={lifecycle}
                onChange={(e) => {
                  setLifecycle(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">{t('routes.catalog.allLifecycles', 'All')}</option>
                <option value="DRAFT">DRAFT</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="DEPRECATED">DEPRECATED</option>
                <option value="RETIRED">RETIRED</option>
              </select>
            </label>
            <label className="sa-field">
              <input
                type="checkbox"
                checked={missingOnly}
                onChange={(e) => {
                  setMissingOnly(e.target.checked);
                  setPage(1);
                }}
              />{' '}
              {t('routes.catalog.missingTranslationFilter', 'Missing translation only')}
            </label>
            <button type="submit" className="sa-button">
              {t('routes.catalog.searchButton', 'Search')}
            </button>
            {canManageKind ? (
              <button type="button" className="sa-button" onClick={openCreate}>
                {t('routes.catalog.create', 'Create item')}
              </button>
            ) : null}
          </form>

          {error ? <Alert tone="danger">{error}</Alert> : null}
          {loading ? <Spinner label={t('common.states.loading', 'Loading…')} /> : null}
          {!loading && items.length === 0 ? (
            <EmptyState title={t('routes.catalog.empty', 'No catalog items')} />
          ) : null}
          {!loading && items.length > 0 ? (
            <div className="sa-table-wrap">
              <table className="sa-table">
                <caption className="sa-visually-hidden">
                  {t(`routes.catalog.kind.${kind}`, kind)}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">{t('routes.catalog.col.displayName', 'Display name')}</th>
                    <th scope="col">{t('routes.catalog.col.key', 'Canonical key')}</th>
                    <th scope="col">{t('routes.catalog.col.lifecycle', 'Lifecycle')}</th>
                    <th scope="col">{t('routes.catalog.col.refs', 'References')}</th>
                    <th scope="col">{t('routes.catalog.col.version', 'Version')}</th>
                    <th scope="col">{t('routes.catalog.col.seeded', 'Seeded')}</th>
                    <th scope="col">{t('routes.catalog.col.actions', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {item.displayName}
                        {item.missingTranslations.length > 0 ? (
                          <StatusBadge
                            tone="warning"
                            label={t('routes.catalog.missingTranslation', 'Missing translation')}
                          />
                        ) : null}
                      </td>
                      <td dir="ltr">{item.canonicalKey}</td>
                      <td>
                        <StatusBadge tone="neutral" label={item.lifecycle} />
                      </td>
                      <td>{item.referenceCount}</td>
                      <td>{item.version}</td>
                      <td>
                        {item.systemSeeded
                          ? t('routes.catalog.systemSeeded', 'System seeded')
                          : '—'}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="sa-button sa-button-quiet"
                          onClick={() => void openDetail(item.id)}
                        >
                          {canManageKind
                            ? t('routes.catalog.edit', 'Edit')
                            : t('routes.catalog.openDetail', 'Open')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="sa-filter-row" role="navigation" aria-label="Pagination">
            <button
              type="button"
              className="sa-button sa-button-quiet"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t('routes.catalog.pagePrev', 'Previous')}
            </button>
            <span>
              {t('routes.catalog.pageLabel', 'Page {page}').replace('{page}', String(page))} (
              {pagination.total})
            </span>
            <button
              type="button"
              className="sa-button sa-button-quiet"
              disabled={!pagination.hasNextPage}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('routes.catalog.pageNext', 'Next')}
            </button>
          </div>
        </>
      ) : null}

      {mode === 'create' || mode === 'detail' ? (
        <section className="sa-section" aria-labelledby={`${formId}-editor-heading`}>
          <h2 id={`${formId}-editor-heading`}>
            {mode === 'create'
              ? t('routes.catalog.create', 'Create item')
              : t('routes.catalog.edit', 'Edit')}
          </h2>
          <Alert tone="info">
            {t(
              'routes.catalog.immutableKeyWarning',
              'Canonical keys are immutable after create.',
            )}
          </Alert>
          {!canManageKind && mode === 'detail' ? (
            <Alert tone="warning">{t('routes.catalog.noManage', 'Read only')}</Alert>
          ) : null}
          {formError ? <Alert tone="danger">{formError}</Alert> : null}

          <form
            onSubmit={mode === 'create' ? submitCreate : submitUpdate}
            className="sa-form"
            noValidate
          >
            <label className="sa-field" htmlFor={`${formId}-key`}>
              {t('routes.catalog.canonicalKeyLabel', 'Canonical key')}{' '}
              <input
                id={`${formId}-key`}
                dir="ltr"
                value={canonicalKey}
                disabled={mode === 'detail'}
                onChange={(e) => setCanonicalKey(e.target.value)}
                required
                aria-describedby={`${formId}-key-hint`}
              />
            </label>
            <p id={`${formId}-key-hint`} className="sa-meta" dir="ltr">
              Prefix: {KIND_PREFIX[kind]}*
            </p>
            <label className="sa-field" htmlFor={`${formId}-sort`}>
              {t('routes.catalog.sortOrderLabel', 'Sort order')}{' '}
              <input
                id={`${formId}-sort`}
                type="number"
                value={sortOrder}
                disabled={!canManageKind && mode === 'detail'}
                onChange={(e) => setSortOrder(Number(e.target.value))}
              />
            </label>
            {kind === 'FACILITY_TYPE' ? (
              <label className="sa-field" htmlFor={`${formId}-icon`}>
                {t('routes.catalog.iconKeyLabel', 'Icon')}{' '}
                <select
                  id={`${formId}-icon`}
                  value={iconKey}
                  disabled={!canManageKind && mode === 'detail'}
                  onChange={(e) => setIconKey(e.target.value)}
                >
                  <option value="">{t('routes.catalog.noneOption', 'None')}</option>
                  {ICON_OPTIONS.map((icon) => (
                    <option key={icon} value={icon}>
                      {icon}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="sa-field" htmlFor={`${formId}-en-name`}>
              {t('routes.catalog.displayNameEn', 'Display name (en-US)')}{' '}
              <input
                id={`${formId}-en-name`}
                value={displayNameEn}
                disabled={!canManageKind && mode === 'detail'}
                onChange={(e) => setDisplayNameEn(e.target.value)}
                required
              />
            </label>
            <label className="sa-field" htmlFor={`${formId}-en-desc`}>
              {t('routes.catalog.shortDescEn', 'Short description (en-US)')}{' '}
              <input
                id={`${formId}-en-desc`}
                value={shortDescEn}
                disabled={!canManageKind && mode === 'detail'}
                onChange={(e) => setShortDescEn(e.target.value)}
                required
              />
            </label>
            <label className="sa-field" htmlFor={`${formId}-ar-name`}>
              {t('routes.catalog.displayNameAr', 'Display name (ar-SY)')}{' '}
              <input
                id={`${formId}-ar-name`}
                value={displayNameAr}
                disabled={!canManageKind && mode === 'detail'}
                onChange={(e) => setDisplayNameAr(e.target.value)}
                required
                dir="rtl"
              />
            </label>
            <label className="sa-field" htmlFor={`${formId}-ar-desc`}>
              {t('routes.catalog.shortDescAr', 'Short description (ar-SY)')}{' '}
              <input
                id={`${formId}-ar-desc`}
                value={shortDescAr}
                disabled={!canManageKind && mode === 'detail'}
                onChange={(e) => setShortDescAr(e.target.value)}
                required
                dir="rtl"
              />
            </label>
            {kind === 'SPECIALTY' ? (
              <label className="sa-field" htmlFor={`${formId}-parent`}>
                {t('routes.catalog.parentSpecialty', 'Parent specialty')}{' '}
                <select
                  id={`${formId}-parent`}
                  value={parentKey}
                  disabled={!canManageKind && mode === 'detail'}
                  onChange={(e) => setParentKey(e.target.value)}
                >
                  <option value="">{t('routes.catalog.noneOption', 'None')}</option>
                  {selectorKeys
                    .filter((k) => k.startsWith('specialty.') && k !== canonicalKey)
                    .map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                </select>
              </label>
            ) : null}
            {kind === 'FEATURE' || kind === 'LIMIT' ? (
              <label className="sa-field" htmlFor={`${formId}-owner`}>
                {t('routes.catalog.owningModule', 'Owning module')}{' '}
                <select
                  id={`${formId}-owner`}
                  value={owningModuleKey}
                  disabled={!canManageKind && mode === 'detail'}
                  onChange={(e) => setOwningModuleKey(e.target.value)}
                >
                  <option value="">{t('routes.catalog.noneOption', 'None')}</option>
                  {selectorKeys
                    .filter((k) => k.startsWith('module.'))
                    .map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                </select>
              </label>
            ) : null}
            {kind === 'LIMIT' ? (
              <fieldset className="sa-fieldset">
                <legend>{t('routes.catalog.kind.LIMIT', 'Limits')}</legend>
                <label className="sa-field" htmlFor={`${formId}-lvt`}>
                  {t('routes.catalog.limitValueType', 'Value type')}{' '}
                  <select
                    id={`${formId}-lvt`}
                    value={limitValueType}
                    disabled={!canManageKind && mode === 'detail'}
                    onChange={(e) => setLimitValueType(e.target.value)}
                  >
                    {LIMIT_VALUE_TYPES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="sa-field" htmlFor={`${formId}-lu`}>
                  {t('routes.catalog.limitUnit', 'Unit')}{' '}
                  <select
                    id={`${formId}-lu`}
                    value={limitUnit}
                    disabled={!canManageKind && mode === 'detail'}
                    onChange={(e) => setLimitUnit(e.target.value)}
                  >
                    {LIMIT_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="sa-field" htmlFor={`${formId}-lmin`}>
                  {t('routes.catalog.limitMin', 'Minimum')}{' '}
                  <input
                    id={`${formId}-lmin`}
                    type="number"
                    value={limitMin}
                    disabled={!canManageKind && mode === 'detail'}
                    onChange={(e) => setLimitMin(e.target.value)}
                  />
                </label>
                <label className="sa-field" htmlFor={`${formId}-lmax`}>
                  {t('routes.catalog.limitMax', 'Maximum')}{' '}
                  <input
                    id={`${formId}-lmax`}
                    type="number"
                    value={limitMax}
                    disabled={!canManageKind && mode === 'detail'}
                    onChange={(e) => setLimitMax(e.target.value)}
                  />
                </label>
                <label className="sa-field">
                  <input
                    type="checkbox"
                    checked={limitZeroValid}
                    disabled={!canManageKind && mode === 'detail'}
                    onChange={(e) => setLimitZeroValid(e.target.checked)}
                  />{' '}
                  {t('routes.catalog.limitZeroValid', 'Zero is valid')}
                </label>
                <label className="sa-field">
                  <input
                    type="checkbox"
                    checked={limitUnlimited}
                    disabled={!canManageKind && mode === 'detail'}
                    onChange={(e) => setLimitUnlimited(e.target.checked)}
                  />{' '}
                  {t('routes.catalog.limitUnlimited', 'Unlimited supported')}
                </label>
              </fieldset>
            ) : null}

            {canManageKind ? (
              <div className="sa-filter-row">
                <button type="submit" className="sa-button" disabled={submitting}>
                  {submitting
                    ? t('routes.catalog.submitting', 'Saving…')
                    : mode === 'create'
                      ? t('routes.catalog.create', 'Create item')
                      : t('routes.catalog.save', 'Save changes')}
                </button>
                <button
                  type="button"
                  className="sa-button sa-button-quiet"
                  onClick={() => {
                    setMode('list');
                  }}
                >
                  {t('routes.catalog.cancel', 'Cancel')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="sa-button sa-button-quiet"
                onClick={() => setMode('list')}
              >
                {t('routes.catalog.cancel', 'Cancel')}
              </button>
            )}
          </form>

          {mode === 'detail' && detail && canManageKind ? (
            <div className="sa-filter-row">
              {detail.lifecycle === 'DRAFT' || detail.lifecycle === 'DEPRECATED' || detail.lifecycle === 'RETIRED' ? (
                <button
                  type="button"
                  className="sa-button"
                  onClick={() =>
                    openLifecycle(
                      detail.lifecycle === 'RETIRED' || detail.lifecycle === 'DEPRECATED'
                        ? 'catalog-reactivate'
                        : 'catalog-activate',
                    )
                  }
                >
                  {detail.lifecycle === 'DRAFT'
                    ? t('routes.catalog.activate', 'Activate')
                    : t('routes.catalog.reactivate', 'Reactivate')}
                </button>
              ) : null}
              {detail.lifecycle === 'ACTIVE' ? (
                <button
                  type="button"
                  className="sa-button"
                  onClick={() => openLifecycle('catalog-deprecate')}
                >
                  {t('routes.catalog.deprecate', 'Deprecate')}
                </button>
              ) : null}
              {detail.lifecycle !== 'RETIRED' ? (
                <button
                  type="button"
                  className="sa-button sa-button-danger"
                  onClick={() => openLifecycle('catalog-retire')}
                >
                  {t('routes.catalog.retire', 'Retire')}
                </button>
              ) : null}
              <span className="sa-meta" dir="ltr">
                v{detail.version}
              </span>
            </div>
          ) : null}

          {mode === 'detail' && detail && canManageKind ? (
            <section aria-labelledby={`${formId}-aliases-h`}>
              <h3 id={`${formId}-aliases-h`}>
                {t('routes.catalog.aliasesTitle', 'Aliases')}
              </h3>
              <ul>
                {detail.aliases.map((a) => (
                  <li key={a.id} dir="ltr">
                    {a.aliasValue} ({a.sourceNamespace}) — {a.lifecycle}
                    {a.lifecycle !== 'RETIRED' ? (
                      <button
                        type="button"
                        className="sa-button sa-button-quiet"
                        onClick={() => {
                          void withAccessToken((token) =>
                            client.retireHealthcareCatalogAlias(token, detail.id, a.id, {
                              expectedVersion: detail.version,
                              reason: 'Retire alias from catalog UI',
                            }),
                          ).then(setDetail);
                        }}
                      >
                        {t('routes.catalog.retireAlias', 'Retire')}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
              <form onSubmit={submitAlias} className="sa-filter-row">
                <label className="sa-field">
                  {t('routes.catalog.aliasValue', 'Alias value')}{' '}
                  <input
                    dir="ltr"
                    value={aliasValue}
                    onChange={(e) => setAliasValue(e.target.value)}
                    required
                  />
                </label>
                <label className="sa-field">
                  {t('routes.catalog.aliasNamespace', 'Namespace')}{' '}
                  <input
                    dir="ltr"
                    value={aliasNamespace}
                    onChange={(e) => setAliasNamespace(e.target.value)}
                    required
                  />
                </label>
                <button type="submit" className="sa-button" disabled={submitting}>
                  {t('routes.catalog.addAlias', 'Add alias')}
                </button>
              </form>
            </section>
          ) : null}

          {mode === 'detail' && detail ? (
            <section aria-labelledby={`${formId}-refs-h`}>
              <h3 id={`${formId}-refs-h`}>
                {t('routes.catalog.referencesTitle', 'References')}
              </h3>
              <ul>
                {refs.map((b) => (
                  <li key={b.sourceType}>
                    {b.sourceType}: {b.count} ({b.availability}
                    {b.reasonCode ? ` — ${b.reasonCode}` : ''})
                    {b.keys?.length ? (
                      <span dir="ltr"> [{b.keys.slice(0, 10).join(', ')}]</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </section>
      ) : null}

      {canPreview ? (
        <section className="sa-section" aria-labelledby="catalog-rules-heading">
          <h2 id="catalog-rules-heading">{t('routes.catalog.rulesTitle', 'Compatibility rules')}</h2>
          {canManageRules ? (
            <form onSubmit={submitRule} className="sa-form">
              <label className="sa-field">
                {t('routes.catalog.ruleType', 'Rule type')}{' '}
                <select
                  value={ruleType}
                  onChange={(e) => setRuleType(e.target.value as (typeof RULE_TYPES)[number])}
                >
                  {RULE_TYPES.map((rt) => (
                    <option key={rt} value={rt}>
                      {rt}
                    </option>
                  ))}
                </select>
              </label>
              <label className="sa-field">
                {t('routes.catalog.subjectKey', 'Subject')}{' '}
                <select
                  value={ruleSubject}
                  onChange={(e) => setRuleSubject(e.target.value)}
                  required
                >
                  <option value="">—</option>
                  {selectorKeys.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </label>
              <label className="sa-field">
                {t('routes.catalog.targetKey', 'Target')}{' '}
                <select
                  value={ruleTarget}
                  onChange={(e) => setRuleTarget(e.target.value)}
                  required
                >
                  <option value="">—</option>
                  {selectorKeys.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </label>
              {ruleType === 'REQUIRES_ANY_OF' ? (
                <label className="sa-field">
                  {t('routes.catalog.anyOfGroup', 'Any-of group key')}{' '}
                  <input
                    dir="ltr"
                    value={ruleAnyOf}
                    onChange={(e) => setRuleAnyOf(e.target.value)}
                  />
                </label>
              ) : null}
              <label className="sa-field">
                {t('routes.catalog.explanationEn', 'Explanation (en)')}{' '}
                <input
                  value={ruleExplEn}
                  onChange={(e) => setRuleExplEn(e.target.value)}
                  required
                  maxLength={500}
                />
              </label>
              <label className="sa-field">
                {t('routes.catalog.explanationAr', 'Explanation (ar)')}{' '}
                <input
                  value={ruleExplAr}
                  onChange={(e) => setRuleExplAr(e.target.value)}
                  required
                  maxLength={500}
                  dir="rtl"
                />
              </label>
              <button type="submit" className="sa-button" disabled={submitting}>
                {t('routes.catalog.createRule', 'Create draft rule')}
              </button>
            </form>
          ) : null}
          <ul>
            {rules.map((rule) => (
              <li key={rule.id} dir="ltr">
                {rule.ruleType} {rule.subjectKey} → {rule.targetKey} [{rule.lifecycle}]
                {canManageRules && rule.lifecycle === 'DRAFT' ? (
                  <button
                    type="button"
                    className="sa-button sa-button-quiet"
                    onClick={() => openRuleLifecycle(rule, 'activate')}
                  >
                    {t('routes.catalog.activateRule', 'Activate rule')}
                  </button>
                ) : null}
                {canManageRules && rule.lifecycle !== 'RETIRED' ? (
                  <button
                    type="button"
                    className="sa-button sa-button-quiet"
                    onClick={() => openRuleLifecycle(rule, 'retire')}
                  >
                    {t('routes.catalog.retireRule', 'Retire rule')}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canPreview ? (
        <section className="sa-section" aria-labelledby="catalog-preview-heading">
          <h2 id="catalog-preview-heading">
            {t('routes.catalog.previewTitle', 'Compatibility preview')}
          </h2>
          <p>
            {t(
              'routes.catalog.previewDisclaimer',
              'Validates catalog compatibility only. This is not a subscription decision, runtime license decision, or tenant provisioning action.',
            )}
          </p>
          <form className="sa-filter-row" onSubmit={runPreview}>
            <label className="sa-field">
              {t('routes.catalog.facilityKey', 'Facility type key')}{' '}
              <input dir="ltr" value={facilityKey} onChange={(e) => setFacilityKey(e.target.value)} />
            </label>
            <label className="sa-field">
              {t('routes.catalog.moduleKey', 'Module key')}{' '}
              <input dir="ltr" value={moduleKey} onChange={(e) => setModuleKey(e.target.value)} />
            </label>
            <label className="sa-field">
              {t('routes.catalog.specialtyKey', 'Specialty key')}{' '}
              <input
                dir="ltr"
                value={specialtyKey}
                onChange={(e) => setSpecialtyKey(e.target.value)}
              />
            </label>
            <button type="submit" className="sa-button">
              {t('routes.catalog.previewRun', 'Validate selection')}
            </button>
          </form>
          {preview ? (
            <div role="status" aria-live="polite">
              <StatusBadge
                tone={preview.valid ? 'success' : 'danger'}
                label={
                  preview.valid
                    ? t('routes.catalog.previewValid', 'Valid')
                    : t('routes.catalog.previewInvalid', 'Invalid')
                }
              />
              <ul>
                {preview.violations.map((v) => (
                  <li key={v.reasonCode + v.message}>
                    {v.reasonCode}: {v.message}
                  </li>
                ))}
                {preview.warnings.map((w) => (
                  <li key={w.reasonCode + w.message}>
                    {w.reasonCode}: {w.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
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
