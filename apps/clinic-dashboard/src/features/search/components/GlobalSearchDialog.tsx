import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useOptionalDynamicSearch } from '@/features/dynamic-search/context/DynamicSearchProvider';
import { resolveSearchHitUrl } from '@/features/dynamic-search/lib/resolve-search-hit-url';
import { recordRecentPatient } from '@/features/patients/lib/recent-patients';
import { globalClinicalSearch } from '@/features/search/api/search-api';
import styles from './GlobalSearchDialog.module.css';

interface GlobalSearchDialogProps {
  open: boolean;
  onClose: () => void;
}

interface SearchHit {
  type: string;
  id: string;
  title: string;
  subtitle: string | null;
  url?: string;
  metadata?: Record<string, string>;
}

export function GlobalSearchDialog({ open, onClose }: GlobalSearchDialogProps) {
  const { t } = useI18n();
  const { user, getValidAccessToken } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dynamicSearch = useOptionalDynamicSearch();
  const canSearch = dynamicSearch?.canSearch ?? false;
  const typesParam = dynamicSearch?.typesParam ?? '';

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setDebounced('');
    setResults([]);
    setError(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!open || !debounced || !canSearch || !typesParam) {
      setResults([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const token = await getValidAccessToken();
        if (!token || !user?.tenantId) return;
        const hits = await globalClinicalSearch(token, user.tenantId, debounced, typesParam);
        if (!cancelled) setResults(hits);
      } catch {
        if (!cancelled) setError(t('patients.search.error'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, debounced, canSearch, typesParam, getValidAccessToken, user?.tenantId, t]);

  if (!open) return null;

  function navigateHit(hit: SearchHit) {
    onClose();

    const deepLinkByEntityType = dynamicSearch?.snapshot.deepLinkByEntityType ?? {};
    const destination =
      resolveSearchHitUrl(hit, deepLinkByEntityType) ??
      (hit.type === 'patient' ? `/patients/${hit.id}` : null);

    if (!destination) return;

    if (hit.type === 'patient') {
      const parts = hit.title.trim().split(/\s+/);
      recordRecentPatient({
        id: hit.id,
        firstName: parts[0] ?? hit.title,
        lastName: parts.slice(1).join(' ') || '',
        firstNameAr: null,
        lastNameAr: null,
      });
    }

    navigate(destination);
  }

  function typeLabel(type: string): string {
    const labelKey = dynamicSearch?.snapshot.labelKeyByEntityType[type];
    if (labelKey) {
      const translated = t(labelKey as never);
      if (translated !== labelKey) return translated;
    }
    if (type === 'notification') return t('notifications.title');
    for (const prefix of ['emr.search.types', 'dental.search.types', 'beauty.search.types'] as const) {
      const key = `${prefix}.${type}`;
      const label = t(key as never);
      if (label !== key) return label;
    }
    return type;
  }

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={t('emr.search.globalTitle')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={styles.searchRow}>
          <Search size={18} aria-hidden />
          <input
            ref={inputRef}
            className={styles.searchInput}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('emr.search.globalPlaceholder')}
            aria-label={t('emr.search.globalPlaceholder')}
            autoComplete="off"
          />
          <span className={styles.hint}>{t('shell.searchShortcut')}</span>
        </div>

        <div className={styles.results} role="listbox" aria-label={t('patients.search.results')}>
          {!canSearch && <p className={styles.empty}>{t('patients.search.noAccess')}</p>}
          {canSearch && !debounced && (
            <p className={styles.empty}>{t('patients.search.typeToSearch')}</p>
          )}
          {canSearch && debounced && loading && (
            <p className={styles.status}>{t('auth.loading')}</p>
          )}
          {error && <p className={styles.empty}>{error}</p>}
          {canSearch &&
            !loading &&
            debounced &&
            results.length === 0 &&
            !error && <p className={styles.empty}>{t('patients.empty.search')}</p>}
          {results.map((hit) => (
            <button
              key={`${hit.type}-${hit.id}`}
              type="button"
              className={styles.resultBtn}
              role="option"
              onClick={() => navigateHit(hit)}
            >
              <span className={styles.resultType}>{typeLabel(hit.type)}</span>
              <span className={styles.resultTitle}>{hit.title}</span>
              {hit.subtitle && <span className={styles.resultSubtitle}>{hit.subtitle}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
