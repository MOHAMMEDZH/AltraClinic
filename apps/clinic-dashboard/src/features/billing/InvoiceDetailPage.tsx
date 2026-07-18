import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { hasPermission } from '@booking/permissions';
import { useI18n } from '@booking/i18n/react';
import { useAuth } from '@/app/providers/AuthProvider';
import { AuthAlert } from '@/features/auth/components/AuthAlert';
import { AuthButton } from '@/features/auth/components/AuthButton';
import {
  canCancelInvoice,
  canCreateBilling,
  canManageBilling,
  canRecordPayment,
  canUpdateBilling,
  canViewBilling,
  formatBillingCurrency,
  formatBillingDate,
  invoiceCanReceivePayment,
  invoiceIsDraft,
  resolveBillingWorkspaceMode,
} from './config/billing-config';
import { mapBillingApiError } from './api/billing-api';
import {
  useCancelInvoice,
  useInvoice,
  useInvoiceConsumptions,
  useCreateCreditNote,
  useCreatePaymentPlan,
  useIssueInvoice,
  usePaymentPlans,
  useRecordInvoicePayment,
  useRecordRefund,
  useRecordSplitPayments,
  useWriteOffInvoice,
  useInvoiceReceipts,
} from './hooks/useBilling';
import { UnbilledConsumptionsPanel } from './components/UnbilledConsumptionsPanel';
import { RecordPaymentModal } from './components/RecordPaymentModal';
import { RefundModal } from './components/RefundModal';
import { WriteOffModal } from './components/WriteOffModal';
import { CreditNoteModal } from './components/CreditNoteModal';
import { SplitPaymentModal } from './components/SplitPaymentModal';
import { PaymentPlanModal } from './components/PaymentPlanModal';
import { BillingQuickNav } from './components/BillingQuickNav';
import { InsurancePanel } from './components/InsurancePanel';
import { InvoiceAttachmentsPanel } from './components/InvoiceAttachmentsPanel';
import styles from './InvoiceDetailPage.module.css';
import layoutStyles from './billing-layout.module.css';

export function InvoiceDetailPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const workspaceMode = resolveBillingWorkspaceMode(roles);
  const perm = useCallback((action: string) => hasPermission(roles, 'api.billing', action as never), [roles]);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [writeOffModalOpen, setWriteOffModalOpen] = useState(false);
  const [creditNoteModalOpen, setCreditNoteModalOpen] = useState(false);
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canView = canViewBilling(perm);
  const canCreate = canCreateBilling(perm);
  const canUpdate = canUpdateBilling(perm);
  const canPay = canRecordPayment(perm);
  const canCancel = canCancelInvoice(perm);
  const canManage = canManageBilling(perm);

  const invoiceQuery = useInvoice(invoiceId, canView);
  const consumptionsQuery = useInvoiceConsumptions(invoiceId, canView);
  const plansQuery = usePaymentPlans(invoiceId, canView);
  const receiptsQuery = useInvoiceReceipts(invoiceId, canView);
  const payMutation = useRecordInvoicePayment();
  const cancelMutation = useCancelInvoice();
  const issueMutation = useIssueInvoice();
  const refundMutation = useRecordRefund();
  const writeOffMutation = useWriteOffInvoice();
  const creditNoteMutation = useCreateCreditNote();
  const splitMutation = useRecordSplitPayments();
  const planMutation = useCreatePaymentPlan();

  const invoice = invoiceQuery.data;
  const consumptions = consumptionsQuery.data ?? [];

  useEffect(() => {
    if (searchParams.get('issue') !== '1' || !invoice || !invoiceIsDraft(invoice.status)) return;
    void (async () => {
      try {
        await issueMutation.mutateAsync(invoice.invoiceId);
        setSuccess(t('billing.detail.issueSuccess'));
        void invoiceQuery.refetch();
      } catch (err) {
        setErrorKey(mapBillingApiError(err));
      } finally {
        const params = new URLSearchParams(searchParams);
        params.delete('issue');
        setSearchParams(params, { replace: true });
      }
    })();
  }, [invoice?.invoiceId, invoice?.status, searchParams, issueMutation, invoiceQuery, setSearchParams, t]);

  async function handlePaymentSubmit(payload: {
    amount: number;
    paymentMethod: string;
    paymentReference?: string;
    paymentDate?: string;
  }) {
    if (!invoice) return;
    setErrorKey(null);
    setSuccess(null);
    try {
      const result = await payMutation.mutateAsync({
        invoiceId: invoice.invoiceId,
        amount: payload.amount,
        paymentMethod: payload.paymentMethod,
        paymentReference: payload.paymentReference,
        paymentDate: payload.paymentDate ?? new Date().toISOString(),
      });
      setSuccess(t('billing.detail.paymentSuccess'));
      setPaymentModalOpen(false);
      void invoiceQuery.refetch();
      if (result.receiptNumber) {
        navigate(`/billing/receipts/${encodeURIComponent(result.receiptNumber)}?print=1`);
      }
    } catch (err) {
      setErrorKey(mapBillingApiError(err));
    }
  }

  async function handleIssue() {
    if (!invoice) return;
    setErrorKey(null);
    setSuccess(null);
    try {
      await issueMutation.mutateAsync(invoice.invoiceId);
      setSuccess(t('billing.detail.issueSuccess'));
      void invoiceQuery.refetch();
    } catch (err) {
      setErrorKey(mapBillingApiError(err));
    }
  }

  async function handleCancel() {
    if (!invoice) return;
    setErrorKey(null);
    try {
      await cancelMutation.mutateAsync(invoice.invoiceId);
      setSuccess(t('billing.detail.cancelSuccess'));
      void invoiceQuery.refetch();
    } catch (err) {
      setErrorKey(mapBillingApiError(err));
    }
  }

  if (!canView) {
    return (
      <div className={styles.page}>
        <AuthAlert variant="error">{t('billing.accessDenied')}</AuthAlert>
      </div>
    );
  }

  if (invoiceQuery.isLoading && !invoice) {
    return (
      <div className={styles.page} aria-busy="true">
        …
      </div>
    );
  }

  if (invoiceQuery.isError || !invoice) {
    return (
      <div className={styles.page}>
        <AuthAlert variant="error">{t('billing.errors.notFound')}</AuthAlert>
        <Link to="/billing/invoices" className={styles.backLink}>
          <ArrowLeft size={16} aria-hidden />
          {t('billing.detail.back')}
        </Link>
      </div>
    );
  }

  const showPaymentForm =
    canPay && invoiceCanReceivePayment(invoice.status) && invoice.amountDue > 0;
  const showDraftPaymentHint =
    canPay && invoiceIsDraft(invoice.status) && invoice.amountDue > 0;
  const showCancel =
    canCancel &&
    (invoiceIsDraft(invoice.status) || invoice.status === 'issued') &&
    invoice.amountPaid <= 0;
  const showAddMaterials = canCreate && invoiceIsDraft(invoice.status);
  const showIssue =
    canUpdate &&
    invoiceIsDraft(invoice.status) &&
    invoice.lineItems.length > 0 &&
    invoice.amountTotal > 0;
  const showIssueHint =
    canUpdate && invoiceIsDraft(invoice.status) && invoice.lineItems.length === 0;

  return (
    <div className={styles.page}>
      <Link to="/billing/invoices" className={styles.backLink}>
        <ArrowLeft size={16} aria-hidden />
        {t('billing.detail.back')}
      </Link>

      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{invoice.invoiceNumber}</h1>
          <p className={styles.subtitle}>
            {formatBillingDate(invoice.invoiceDate, locale)} ·{' '}
            <span className={styles.badge}>
              {t(`billing.status.${invoice.status}` as 'billing.status.draft')}
            </span>
          </p>
        </div>
        <div className={styles.actions}>
          <AuthButton variant="secondary" onClick={() => navigate(`/patients/${invoice.patientId}`)}>
            {t('billing.detail.viewPatient')}
          </AuthButton>
          {showIssue && (
            <AuthButton loading={issueMutation.isPending} onClick={() => void handleIssue()}>
              {t('billing.detail.issue')}
            </AuthButton>
          )}
          {showCancel && (
            <AuthButton variant="danger" loading={cancelMutation.isPending} onClick={() => void handleCancel()}>
              {t('billing.detail.cancel')}
            </AuthButton>
          )}
          {canPay && invoiceCanReceivePayment(invoice.status) && invoice.amountDue > 0 && (
            <AuthButton variant="secondary" onClick={() => setSplitModalOpen(true)}>{t('billing.split.open')}</AuthButton>
          )}
          {canPay && invoice.amountPaid > 0 && (
            <AuthButton variant="secondary" onClick={() => setRefundModalOpen(true)}>{t('billing.refund.open')}</AuthButton>
          )}
          {canUpdate && invoice.amountDue > 0 && (
            <AuthButton variant="secondary" onClick={() => setCreditNoteModalOpen(true)}>{t('billing.creditNote.open')}</AuthButton>
          )}
          {canManage && invoice.amountDue > 0 && (
            <AuthButton variant="secondary" onClick={() => setWriteOffModalOpen(true)}>{t('billing.writeOff.open')}</AuthButton>
          )}
          {canCreate && invoice.amountDue > 0 && (
            <AuthButton variant="secondary" onClick={() => setPlanModalOpen(true)}>{t('billing.paymentPlan.open')}</AuthButton>
          )}
        </div>
      </header>

      <BillingQuickNav mode={workspaceMode} canCreate={canCreate} />

      {errorKey && (
        <AuthAlert variant="error">
          {t(`billing.errors.${errorKey}` as 'billing.errors.generic')}
        </AuthAlert>
      )}
      {success && <AuthAlert variant="success">{success}</AuthAlert>}
      {showIssueHint && (
        <AuthAlert variant="info">{t('billing.detail.issueHint')}</AuthAlert>
      )}
      {showDraftPaymentHint && (
        <AuthAlert variant="info">{t('billing.detail.draftPaymentHint')}</AuthAlert>
      )}

      <div className={styles.kpis}>
        <article className={styles.kpi}>
          <span>{t('billing.invoices.total')}</span>
          <strong>{formatBillingCurrency(invoice.amountTotal, locale, invoice.currency)}</strong>
        </article>
        <article className={styles.kpi}>
          <span>{t('billing.invoices.paid')}</span>
          <strong>{formatBillingCurrency(invoice.amountPaid, locale, invoice.currency)}</strong>
        </article>
        <article className={styles.kpi}>
          <span>{t('billing.detail.due')}</span>
          <strong>{formatBillingCurrency(invoice.amountDue, locale, invoice.currency)}</strong>
        </article>
      </div>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>{t('billing.detail.lineItems')}</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t('billing.detail.description')}</th>
                <th scope="col">{t('billing.unbilled.quantity')}</th>
                <th scope="col">{t('billing.unbilled.unitPrice')}</th>
                <th scope="col">{t('billing.detail.lineTotal')}</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.map((line) => (
                <tr key={line.itemId}>
                  <td>{line.description}</td>
                  <td>{line.quantity}</td>
                  <td>{formatBillingCurrency(line.unitPrice, locale, invoice.currency)}</td>
                  <td>{formatBillingCurrency(line.lineTotal, locale, invoice.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {consumptions.length > 0 && (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>{t('billing.detail.linkedMaterials')}</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t('billing.unbilled.item')}</th>
                  <th scope="col">{t('billing.unbilled.sku')}</th>
                  <th scope="col">{t('billing.unbilled.quantity')}</th>
                  <th scope="col">{t('billing.unbilled.consumedAt')}</th>
                </tr>
              </thead>
              <tbody>
                {consumptions.map((row) => (
                  <tr key={row.id}>
                    <td>{row.itemName}</td>
                    <td>{row.sku}</td>
                    <td>
                      {row.quantityUsed} {row.unit}
                    </td>
                    <td>{formatBillingDate(row.consumedAt, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {(invoice.payments?.length ?? 0) > 0 && (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>{t('billing.detail.payments')}</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t('billing.detail.paymentDate')}</th>
                  <th scope="col">{t('billing.detail.paymentMethod')}</th>
                  <th scope="col">{t('billing.detail.amount')}</th>
                  <th scope="col">{t('billing.detail.reference')}</th>
                </tr>
              </thead>
              <tbody>
                {invoice.payments!.map((payment) => (
                  <tr key={payment.paymentId}>
                    <td>{formatBillingDate(payment.paymentDate, locale)}</td>
                    <td>{t(`billing.paymentMethods.${payment.paymentMethod}` as 'billing.paymentMethods.cash')}</td>
                    <td>{formatBillingCurrency(payment.amount, locale, invoice.currency)}</td>
                    <td>{payment.paymentReference ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <InsurancePanel invoice={invoice} locale={locale} canEdit={canUpdate} />
      <InvoiceAttachmentsPanel invoiceId={invoice.invoiceId} patientId={invoice.patientId} />

      {(receiptsQuery.data?.length ?? 0) > 0 && (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>{t('billing.receipt.history')}</h2>
          <ul className={layoutStyles.recentList}>
            {receiptsQuery.data!.map((receipt) => (
              <li key={receipt.receiptNumber} className={layoutStyles.recentItem}>
                <Link to={`/billing/receipts/${encodeURIComponent(receipt.receiptNumber)}`}>
                  {receipt.receiptNumber}
                </Link>
                <strong>{formatBillingCurrency(receipt.amount, locale, receipt.currency)}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      {showPaymentForm && (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>{t('billing.detail.recordPayment')}</h2>
          <AuthButton onClick={() => setPaymentModalOpen(true)}>
            {t('billing.detail.recordPayment')}
          </AuthButton>
        </section>
      )}

      {(plansQuery.data?.length ?? 0) > 0 && (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>{t('billing.paymentPlan.title')}</h2>
          <ul className={layoutStyles.recentList}>
            {plansQuery.data![0].installments.map((inst) => (
              <li key={inst.installmentId} className={layoutStyles.recentItem}>
                <span>#{inst.sequence} · {formatBillingDate(inst.dueDate, locale)}</span>
                <strong>{formatBillingCurrency(inst.amount, locale, invoice.currency)}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      <RecordPaymentModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        amountDue={invoice.amountDue}
        currency={invoice.currency}
        loading={payMutation.isPending}
        onSubmit={(payload) => void handlePaymentSubmit(payload)}
      />

      <RefundModal
        open={refundModalOpen}
        onClose={() => setRefundModalOpen(false)}
        maxAmount={invoice.amountPaid}
        loading={refundMutation.isPending}
        onSubmit={(payload) => {
          void refundMutation.mutateAsync({ invoiceId: invoice.invoiceId, ...payload }).then(() => {
            setRefundModalOpen(false);
            void invoiceQuery.refetch();
          });
        }}
      />

      <WriteOffModal
        open={writeOffModalOpen}
        onClose={() => setWriteOffModalOpen(false)}
        maxAmount={invoice.amountDue}
        loading={writeOffMutation.isPending}
        onSubmit={(payload) => {
          void writeOffMutation.mutateAsync({ invoiceId: invoice.invoiceId, ...payload }).then(() => {
            setWriteOffModalOpen(false);
            void invoiceQuery.refetch();
          });
        }}
      />

      <CreditNoteModal
        open={creditNoteModalOpen}
        onClose={() => setCreditNoteModalOpen(false)}
        maxAmount={invoice.amountTotal}
        loading={creditNoteMutation.isPending}
        onSubmit={(payload) => {
          void creditNoteMutation.mutateAsync({ invoiceId: invoice.invoiceId, ...payload }).then(() => {
            setCreditNoteModalOpen(false);
            void invoiceQuery.refetch();
          });
        }}
      />

      <SplitPaymentModal
        open={splitModalOpen}
        onClose={() => setSplitModalOpen(false)}
        amountDue={invoice.amountDue}
        currency={invoice.currency}
        locale={locale}
        loading={splitMutation.isPending}
        onSubmit={(payments) => {
          void splitMutation.mutateAsync({ invoiceId: invoice.invoiceId, payments }).then((result) => {
            setSplitModalOpen(false);
            void invoiceQuery.refetch();
            if (result.receiptNumber) {
              navigate(`/billing/receipts/${encodeURIComponent(result.receiptNumber)}?print=1`);
            }
          });
        }}
      />

      <PaymentPlanModal
        open={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        loading={planMutation.isPending}
        onSubmit={(payload) => {
          void planMutation.mutateAsync({
            invoiceId: invoice.invoiceId,
            patientId: invoice.patientId,
            ...payload,
          }).then(() => {
            setPlanModalOpen(false);
            void plansQuery.refetch();
          });
        }}
      />

      {showAddMaterials && (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>{t('billing.detail.addUnbilled')}</h2>
          <UnbilledConsumptionsPanel
            patientId={invoice.patientId}
            targetInvoiceId={invoice.invoiceId}
            canCreate={canCreate}
            onBilled={() => {
              void invoiceQuery.refetch();
              void consumptionsQuery.refetch();
            }}
          />
        </section>
      )}
    </div>
  );
}
