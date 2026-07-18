import { useCallback, useMemo, useState } from 'react';

import { Link } from 'react-router-dom';

import {

  Monitor,

  PhoneCall,

  RefreshCw,

  BarChart3,

  UserPlus,

  Wifi,

  WifiOff,

  History,

} from 'lucide-react';

import { hasPermission } from '@booking/permissions';

import { useI18n } from '@booking/i18n/react';

import { useAuth } from '@/app/providers/AuthProvider';

import { useOnlineStatus } from '@/features/auth/hooks/useOnlineStatus';

import { useDashboardBranches } from '@/features/dashboard/hooks/useDashboardBranches';

import { useSchedulingProviders, useSchedulingResources } from '@/features/scheduling/hooks/useScheduling';

import { AuthButton } from '@/features/auth/components/AuthButton';

import { AuthAlert } from '@/features/auth/components/AuthAlert';

import { Modal } from '@/features/patients/components/Modal';

import {

  canManageQueue,

  canSelectQueueBranch,

  canUpdateQueue,

  canViewQueue,

  resolveQueueViewMode,

} from './config/queue-config';

import {

  useAssignQueueRoom,

  useCallNextPatient,

  useQueueBoard,

  useQueueMetrics,

  useQueueRealtime,

  useReorderQueue,

  useTransferQueueTicket,

  useUpdateQueuePriority,

  useUpdateQueueTicketStatus,

} from './hooks/useQueue';

import { QueueMetrics } from './components/QueueMetrics';

import { QueueBoard } from './components/QueueBoard';

import { QueueFilterBar } from './components/QueueFilterBar';

import { QueueWalkInModal, QueueExportButton } from './components/QueueWalkInModal';

import type { QueueBoardItem, QueuePriority } from './types/queue.types';

import styles from './QueuePage.module.css';



type PendingAction = {

  ticket: QueueBoardItem;

  status: 'completed' | 'no_show' | 'cancelled';

} | null;



export function QueuePage() {

  const { t } = useI18n();

  const { user } = useAuth();

  const online = useOnlineStatus();

  const roles = user?.roles ?? [];



  const perm = useCallback(

    (action: string) => hasPermission(roles, 'api.queue', action as never),

    [roles],

  );



  const viewMode = resolveQueueViewMode(roles);

  const canSelectBranch = canSelectQueueBranch(roles);

  const { data: branches = [] } = useDashboardBranches();

  const showBranchSelect = canSelectBranch && branches.length > 0;



  const [branchFilter, setBranchFilter] = useState<string | null>(null);

  const effectiveBranchId = useMemo(() => {

    if (!canSelectBranch) return user?.branchId ?? undefined;

    return branchFilter;

  }, [branchFilter, canSelectBranch, user?.branchId]);



  const branchLabels = useMemo(

    () => Object.fromEntries(branches.map((b) => [b.id, b.name])),

    [branches],

  );

  const showAllBranchLabels = canSelectBranch && !branchFilter;



  const providerId = viewMode === 'doctor' ? user?.userId : undefined;



  const [search, setSearch] = useState('');

  const [statusFilter, setStatusFilter] = useState('');

  const [priorityFilter, setPriorityFilter] = useState('');

  const [providerFilter, setProviderFilter] = useState('');

  const [pending, setPending] = useState<PendingAction>(null);

  const [transferTarget, setTransferTarget] = useState<QueueBoardItem | null>(null);

  const [transferBranchId, setTransferBranchId] = useState('');

  const [transferProviderId, setTransferProviderId] = useState('');

  const [walkInOpen, setWalkInOpen] = useState(false);

  const [assignRoomTarget, setAssignRoomTarget] = useState<QueueBoardItem | null>(null);

  const [assignResourceId, setAssignResourceId] = useState('');

  const [actionError, setActionError] = useState<string | null>(null);

  const [actionSuccess, setActionSuccess] = useState<string | null>(null);



  const boardProviderId = providerId ?? (providerFilter || undefined);

  const boardQuery = useQueueBoard(effectiveBranchId, boardProviderId);

  const metricsQuery = useQueueMetrics(effectiveBranchId);

  const { connectionState } = useQueueRealtime(online && canViewQueue(perm));

  const updateMutation = useUpdateQueueTicketStatus();

  const callNextMutation = useCallNextPatient();

  const reorderMutation = useReorderQueue();

  const transferMutation = useTransferQueueTicket();

  const priorityMutation = useUpdateQueuePriority();

  const assignRoomMutation = useAssignQueueRoom();



  const resourcesQuery = useSchedulingResources(effectiveBranchId ?? undefined);

  const resources = resourcesQuery.data?.items ?? [];



  const isDemo = boardQuery.isError;

  const canUpdate = canUpdateQueue(perm);

  const canManage = canManageQueue(perm);

  const canCreate = hasPermission(roles, 'api.queue', 'create');

  const providersQuery = useSchedulingProviders(effectiveBranchId ?? undefined);

  const providers = providersQuery.data?.items ?? [];



  const board = boardQuery.data;



  async function handleCall(ticket: QueueBoardItem) {

    setActionError(null);

    try {

      await updateMutation.mutateAsync({ queueTicketId: ticket.queueTicketId, status: 'called' });

      setActionSuccess(t('queue.success.callNext'));

    } catch {

      setActionError(t('queue.errors.update'));

    }

  }



  async function handleStartServing(ticket: QueueBoardItem) {

    setActionError(null);

    try {

      await updateMutation.mutateAsync({ queueTicketId: ticket.queueTicketId, status: 'serving' });

      setActionSuccess(t('queue.success.serving'));

    } catch {

      setActionError(t('queue.errors.update'));

    }

  }



  async function handleCallNext() {

    setActionError(null);

    try {

      await callNextMutation.mutateAsync({

        branchId: effectiveBranchId ?? undefined,

        providerId,

      });

      setActionSuccess(t('queue.success.callNext'));

    } catch {

      setActionError(t('queue.errors.callNext'));

    }

  }



  async function confirmPending() {

    if (!pending) return;

    setActionError(null);

    try {

      await updateMutation.mutateAsync({

        queueTicketId: pending.ticket.queueTicketId,

        status: pending.status,

      });

      const msg =

        pending.status === 'completed'

          ? t('queue.success.complete')

          : pending.status === 'no_show'

            ? t('queue.success.noShow')

            : t('queue.success.cancelled');

      setActionSuccess(msg);

      setPending(null);

    } catch {

      setActionError(t('queue.errors.update'));

    }

  }



  async function handleMove(ticket: QueueBoardItem, direction: 'up' | 'down') {

    const waiting = board?.waiting ?? [];

    const idx = waiting.findIndex((t) => t.queueTicketId === ticket.queueTicketId);

    if (idx < 0) return;

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;

    if (swapIdx < 0 || swapIdx >= waiting.length) return;



    const ids = waiting.map((t) => t.queueTicketId);

    [ids[idx], ids[swapIdx]] = [ids[swapIdx], ids[idx]];



    setActionError(null);

    try {

      await reorderMutation.mutateAsync({ ticketIds: ids, branchId: effectiveBranchId ?? undefined });

      setActionSuccess(t('queue.success.reordered'));

    } catch {

      setActionError(t('queue.errors.reorder'));

    }

  }



  async function handlePriorityChange(ticket: QueueBoardItem, priority: QueuePriority) {

    setActionError(null);

    try {

      await priorityMutation.mutateAsync({ queueTicketId: ticket.queueTicketId, priority });

      setActionSuccess(t('queue.success.priority'));

    } catch {

      setActionError(t('queue.errors.update'));

    }

  }



  async function confirmTransfer() {

    if (!transferTarget) return;

    setActionError(null);

    try {

      await transferMutation.mutateAsync({

        queueTicketId: transferTarget.queueTicketId,

        branchId: transferBranchId || undefined,

        providerId: transferProviderId || undefined,

      });

      setActionSuccess(t('queue.success.transfer'));

      setTransferTarget(null);

      setTransferBranchId('');

    } catch {

      setActionError(t('queue.errors.transfer'));

    }

  }



  async function confirmAssignRoom() {

    if (!assignRoomTarget) return;

    setActionError(null);

    try {

      await assignRoomMutation.mutateAsync({

        queueTicketId: assignRoomTarget.queueTicketId,

        resourceId: assignResourceId || null,

      });

      setActionSuccess(t('queue.success.roomAssigned'));

      setAssignRoomTarget(null);

      setAssignResourceId('');

    } catch {

      setActionError(t('queue.errors.roomAssign'));

    }

  }



  const liveLabel =

    connectionState === 'connected'

      ? t('queue.liveConnected')

      : connectionState === 'connecting'

        ? t('queue.liveConnecting')

        : t('queue.liveDisconnected');



  if (!canViewQueue(perm)) {

    return (

      <div className={styles.page}>

        <AuthAlert variant="error">{t('queue.errors.accessDenied')}</AuthAlert>

      </div>

    );

  }



  return (

    <div className={styles.page}>

      <header className={styles.header}>

        <div>

          <h1 className={styles.title}>{t('queue.title')}</h1>

          <p className={styles.subtitle}>{t('queue.subtitle')}</p>

          <div className={styles.metaRow}>

            <span className={styles.viewBadge}>{t(`queue.views.${viewMode}`)}</span>

            <span

              className={[

                styles.liveDot,

                connectionState === 'connected' ? styles.liveOn : '',

              ].join(' ')}

              aria-hidden

            />

            <span className={styles.liveLabel}>

              {connectionState === 'connected' ? (

                <Wifi size={14} aria-hidden />

              ) : (

                <WifiOff size={14} aria-hidden />

              )}

              {liveLabel}

            </span>

          </div>

        </div>

        <div className={styles.headerActions}>

          <Link to="/queue/history" className={styles.displayLink}>

            <History size={16} aria-hidden />

            {t('queue.history.link')}

          </Link>

          <Link to="/queue/analytics" className={styles.displayLink}>

            <BarChart3 size={16} aria-hidden />

            {t('queue.analytics.link')}

          </Link>

          <Link to="/queue/display" className={styles.displayLink} target="_blank" rel="noreferrer">

            <Monitor size={16} aria-hidden />

            {t('queue.displayLink')}

          </Link>

          <QueueExportButton branchId={effectiveBranchId} />

          {canCreate && (

            <AuthButton variant="secondary" onClick={() => setWalkInOpen(true)}>

              <UserPlus size={16} aria-hidden />

              {t('queue.walkIn.button')}

            </AuthButton>

          )}

          <AuthButton variant="secondary" onClick={() => void boardQuery.refetch()}>

            <RefreshCw

              size={16}

              aria-hidden

              className={boardQuery.isFetching ? styles.spin : ''}

            />

            {t('queue.refresh')}

          </AuthButton>

          {canUpdate && (

            <AuthButton

              onClick={() => void handleCallNext()}

              loading={callNextMutation.isPending}

            >

              <PhoneCall size={16} aria-hidden />

              {t('queue.actions.callNext')}

            </AuthButton>

          )}

        </div>

      </header>



      {!online && <AuthAlert variant="warning">{t('queue.offlineBanner')}</AuthAlert>}

      {isDemo && online && <AuthAlert variant="warning">{t('queue.demoBanner')}</AuthAlert>}

      {actionError && <AuthAlert variant="error">{actionError}</AuthAlert>}

      {actionSuccess && (

        <AuthAlert variant="success">{actionSuccess}</AuthAlert>

      )}



      <QueueMetrics

        metrics={metricsQuery.data}

        loading={metricsQuery.isLoading}

        managerView={viewMode === 'manager'}

      />



      <div className={styles.toolbar}>

        <QueueFilterBar

          search={search}

          onSearchChange={setSearch}

          statusFilter={statusFilter}

          onStatusFilterChange={setStatusFilter}

          priorityFilter={priorityFilter}

          onPriorityFilterChange={setPriorityFilter}

          providerFilter={providerFilter}

          onProviderFilterChange={setProviderFilter}

          providers={providers}

          showProviderFilter={viewMode !== 'doctor'}

        />

        {showBranchSelect && (

          <select

            className={styles.select}

            value={branchFilter ?? ''}

            onChange={(e) => setBranchFilter(e.target.value || null)}

            aria-label={t('queue.filter.branch')}

          >

            <option value="">{t('queue.filter.allBranches')}</option>

            {branches.map((b) => (

              <option key={b.id} value={b.id}>

                {b.name}

              </option>

            ))}

          </select>

        )}

      </div>



      <QueueBoard

        board={board}

        loading={boardQuery.isLoading}

        canUpdate={canUpdate}

        canManage={canManage}

        busy={

          updateMutation.isPending ||

          reorderMutation.isPending ||

          transferMutation.isPending ||

          priorityMutation.isPending ||

          assignRoomMutation.isPending

        }

        search={search}

        statusFilter={statusFilter}

        priorityFilter={priorityFilter}

        branchLabels={branchLabels}

        showBranchLabels={showAllBranchLabels}

        onCall={handleCall}

        onStartServing={handleStartServing}

        onComplete={(ticket) => setPending({ ticket, status: 'completed' })}

        onSkip={(ticket) => setPending({ ticket, status: 'no_show' })}

        onCancel={(ticket) => setPending({ ticket, status: 'cancelled' })}

        onMoveUp={(ticket) => void handleMove(ticket, 'up')}

        onMoveDown={(ticket) => void handleMove(ticket, 'down')}

        onPriorityChange={(ticket, priority) => void handlePriorityChange(ticket, priority)}

        onTransfer={(ticket) => {

          setTransferTarget(ticket);

          setTransferBranchId(ticket.branchId ?? '');

          setTransferProviderId(ticket.providerId);

        }}

        onAssignRoom={(ticket) => {

          setAssignRoomTarget(ticket);

          setAssignResourceId(ticket.resourceId ?? '');

        }}

      />



      <Modal

        open={pending !== null}

        title={

          pending?.status === 'no_show'

            ? t('queue.actions.confirmNoShow')

            : pending?.status === 'cancelled'

              ? t('queue.actions.confirmCancel')

              : t('queue.actions.confirmComplete')

        }

        onClose={() => setPending(null)}

        footer={

          <div className={styles.modalFooter}>

            <AuthButton variant="secondary" onClick={() => setPending(null)}>

              {t('queue.actions.cancelAction')}

            </AuthButton>

            <AuthButton

              variant={pending?.status !== 'completed' ? 'danger' : 'primary'}

              loading={updateMutation.isPending}

              onClick={() => void confirmPending()}

            >

              {t('queue.actions.confirm')}

            </AuthButton>

          </div>

        }

      >

        {pending?.status === 'no_show' && (

          <p>{t('queue.actions.confirmNoShowBody')}</p>

        )}

        {pending?.status === 'cancelled' && (

          <p>{t('queue.actions.confirmCancelBody')}</p>

        )}

        {pending && (

          <p className={styles.modalPatient}>

            <strong>{pending.ticket.patientName}</strong>

          </p>

        )}

      </Modal>



      <Modal

        open={transferTarget !== null}

        title={t('queue.actions.transferTitle')}

        onClose={() => setTransferTarget(null)}

        footer={

          <div className={styles.modalFooter}>

            <AuthButton variant="secondary" onClick={() => setTransferTarget(null)}>

              {t('queue.actions.cancelAction')}

            </AuthButton>

            <AuthButton

              loading={transferMutation.isPending}

              onClick={() => void confirmTransfer()}

            >

              {t('queue.actions.confirm')}

            </AuthButton>

          </div>

        }

      >

        <p>{t('queue.actions.transferBody')}</p>

        {transferTarget && (

          <p className={styles.modalPatient}>

            <strong>{transferTarget.patientName}</strong>

          </p>

        )}

        {branches.length > 0 && (

          <label className={styles.transferField}>

            <span>{t('queue.filter.branch')}</span>

            <select

              className={styles.select}

              value={transferBranchId}

              onChange={(e) => setTransferBranchId(e.target.value)}

            >

              {branches.map((b) => (

                <option key={b.id} value={b.id}>

                  {b.name}

                </option>

              ))}

            </select>

          </label>

        )}

        {providers.length > 0 && (

          <label className={styles.transferField}>

            <span>{t('queue.walkIn.provider')}</span>

            <select

              className={styles.select}

              value={transferProviderId}

              onChange={(e) => setTransferProviderId(e.target.value)}

            >

              {providers.map((p) => (

                <option key={p.id} value={p.id}>

                  {p.name}

                </option>

              ))}

            </select>

          </label>

        )}

      </Modal>



      <Modal

        open={assignRoomTarget !== null}

        title={t('queue.room.assignTitle')}

        onClose={() => setAssignRoomTarget(null)}

        footer={

          <div className={styles.modalFooter}>

            <AuthButton variant="secondary" onClick={() => setAssignRoomTarget(null)}>

              {t('queue.actions.cancelAction')}

            </AuthButton>

            <AuthButton

              loading={assignRoomMutation.isPending}

              onClick={() => void confirmAssignRoom()}

            >

              {t('queue.actions.confirm')}

            </AuthButton>

          </div>

        }

      >

        <p>{t('queue.room.assignBody')}</p>

        {assignRoomTarget && (

          <p className={styles.modalPatient}>

            <strong>{assignRoomTarget.patientName}</strong>

          </p>

        )}

        {resources.length > 0 ? (

          <label className={styles.transferField}>

            <span>{t('queue.room.select')}</span>

            <select

              className={styles.select}

              value={assignResourceId}

              onChange={(e) => setAssignResourceId(e.target.value)}

            >

              <option value="">{t('queue.room.unassigned')}</option>

              {resources.map((r) => (

                <option key={r.id} value={r.id}>

                  {r.name}

                </option>

              ))}

            </select>

          </label>

        ) : (

          <AuthAlert variant="warning">{t('queue.room.noResources')}</AuthAlert>

        )}

      </Modal>



      <QueueWalkInModal

        open={walkInOpen}

        branchId={effectiveBranchId ?? undefined}

        onClose={() => setWalkInOpen(false)}

        onSuccess={() => setActionSuccess(t('queue.success.walkIn'))}

      />

    </div>

  );

}

