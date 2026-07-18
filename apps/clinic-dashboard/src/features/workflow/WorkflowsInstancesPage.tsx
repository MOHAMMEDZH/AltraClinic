import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { pickLocalizedName } from '@/features/dashboard/lib/dashboard-format';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import { buildWorkflowPermCheck, canViewWorkflows, WORKFLOW_STATUSES } from './config/workflow-config';
import { WorkflowSavedFilters } from './components/WorkflowSavedFilters';
import { useInfiniteWorkflows } from './hooks/useWorkflows';
import { WorkflowStatusBadge } from './components/WorkflowStatusBadge';
import { WorkflowPageHeader } from './components/enterprise/WorkflowPageHeader';
import { WorkflowSection } from './components/enterprise/WorkflowSection';
import { maxLoadedPages } from './lib/virtual-list-range';
import e from './workflow-enterprise.module.css';

const PAGE_SIZE = 50;
const MAX_LOADED_PAGES = 500;

export function WorkflowsInstancesPage() {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const status = params.get('status') ?? '';
  const perm = useMemo(() => buildWorkflowPermCheck(user?.roles ?? []), [user?.roles]);
  const listQuery = useInfiniteWorkflows({ status: status || undefined, search: search.trim() || undefined }, canViewWorkflows(perm));

  if (!canViewWorkflows(perm)) {
    return <AuthAlert variant="error">{t('workflow.accessDenied')}</AuthAlert>;
  }

  const items = listQuery.data?.pages.flatMap((p) => p.items) ?? [];
  const loadCapReached = maxLoadedPages(items.length, PAGE_SIZE, MAX_LOADED_PAGES);

  return (
    <>
      <WorkflowPageHeader title={t('workflow.nav.instances')} subtitle={t('workflow.instances.subtitle')} />

      <WorkflowSection title={t('workflow.filters.status')}>
        <div className={e.filterRow}>
          <select
            className={e.select}
            value={status}
            onChange={(ev) => {
              const next = new URLSearchParams(params);
              if (ev.target.value) next.set('status', ev.target.value);
              else next.delete('status');
              setParams(next);
            }}
            aria-label={t('workflow.filters.status')}
          >
            <option value="">{t('workflow.filters.allStatuses')}</option>
            {WORKFLOW_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <input
            className={e.input}
            value={search}
            onChange={(ev) => setSearch(ev.target.value)}
            placeholder={t('workflow.filters.search')}
            aria-label={t('workflow.filters.search')}
          />
          <Search size={18} aria-hidden />
        </div>

        <WorkflowSavedFilters
          scope="instances"
          currentFilters={{ status, search: search.trim() }}
          onLoad={(filters) => {
            const next = new URLSearchParams(params);
            if (typeof filters.status === 'string') {
              if (filters.status) next.set('status', filters.status);
              else next.delete('status');
              setParams(next);
            }
            if (typeof filters.search === 'string') setSearch(filters.search);
          }}
        />

        {listQuery.isLoading ? (
          <p className={e.pageSubtitle}>…</p>
        ) : items.length === 0 ? (
          <p className={e.pageSubtitle}>{t('workflow.instances.empty')}</p>
        ) : (
          <div className={e.executionGrid}>
            {items.map((row) => {
              const pct = row.steps?.length ? Math.round(((row.currentStepIndex + 1) / row.steps.length) * 100) : 0;
              return (
                <div key={row.workflowId} className={e.executionRow}>
                  <div>
                    <Link to={`/workflows/instances/${row.workflowId}`} style={{ fontWeight: 600 }}>
                      {pickLocalizedName(locale, row.nameEn, row.nameAr)}
                    </Link>
                    <div className={e.progressTrack} style={{ marginTop: 8, maxWidth: 200 }}>
                      <div className={e.progressFill} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <WorkflowStatusBadge status={row.status} />
                  <span>{pct}%</span>
                  <time style={{ fontSize: 'var(--text-xs)' }}>{new Date(row.updatedAt).toLocaleString(locale)}</time>
                </div>
              );
            })}
          </div>
        )}

        {listQuery.hasNextPage && !loadCapReached && (
          <AuthButton variant="secondary" loading={listQuery.isFetchingNextPage} onClick={() => void listQuery.fetchNextPage()}>
            {t('workflow.loadMore')}
          </AuthButton>
        )}
      </WorkflowSection>
    </>
  );
}
