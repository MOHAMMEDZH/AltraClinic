export type BillingPermCheck = (action: string) => boolean;

export type BillingWorkspaceMode = 'finance' | 'reception' | 'management' | 'clinical';

export const PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'syriatel_cash', 'insurance'] as const;

export const INVOICE_STATUSES = ['draft', 'issued', 'partial_paid', 'paid', 'overdue', 'cancelled', 'written_off'] as const;

export const OUTSTANDING_STATUSES = ['issued', 'partial_paid', 'overdue'] as const;

export const BILLING_ROW_HEIGHT = 52;
export const BILLING_GRID_MAX_HEIGHT = 560;
export const BILLING_GRID_COLUMNS =
  'minmax(140px,1.2fr) minmax(100px,0.8fr) minmax(90px,0.7fr) minmax(100px,0.8fr) minmax(100px,0.8fr) minmax(100px,0.8fr) minmax(80px,0.6fr)';

export const BILLING_GRID_SELECT_COL = '44px';

export function billingGridColumns(selectable = false): string {
  return selectable ? `${BILLING_GRID_SELECT_COL} ${BILLING_GRID_COLUMNS}` : BILLING_GRID_COLUMNS;
}

const FINANCE_ROLES = new Set(['accountant', 'owner', 'general_manager', 'super_admin']);
const RECEPTION_ROLES = new Set(['receptionist', 'branch_manager']);
const MANAGEMENT_ROLES = new Set(['owner', 'general_manager', 'branch_manager', 'super_admin']);

export function canViewBilling(perm: BillingPermCheck): boolean {
  return perm('view');
}

export function canCreateBilling(perm: BillingPermCheck): boolean {
  return perm('create');
}

export function canUpdateBilling(perm: BillingPermCheck): boolean {
  return perm('update');
}

export function canRecordPayment(perm: BillingPermCheck): boolean {
  return perm('approve');
}

export function canCancelInvoice(perm: BillingPermCheck): boolean {
  return perm('delete');
}

export function canExportBilling(perm: BillingPermCheck): boolean {
  return perm('export');
}

export function canManageBilling(perm: BillingPermCheck): boolean {
  return perm('manage');
}

export const BILLING_PAGE_SIZES = [25, 50, 100] as const;

export function resolveBillingWorkspaceMode(roles: string[]): BillingWorkspaceMode {
  if (roles.some((r) => FINANCE_ROLES.has(r))) return 'finance';
  if (roles.some((r) => RECEPTION_ROLES.has(r))) return 'reception';
  if (roles.some((r) => MANAGEMENT_ROLES.has(r))) return 'management';
  return 'clinical';
}

export function isFinanceWorkspace(mode: BillingWorkspaceMode): boolean {
  return mode === 'finance' || mode === 'management';
}

export function invoiceIsDraft(status: string): boolean {
  return status === 'draft';
}

export function invoiceIsIssued(status: string): boolean {
  return status === 'issued';
}

export function invoiceCanReceivePayment(status: string): boolean {
  return !invoiceIsDraft(status) && !invoiceIsCancelled(status);
}

export function invoiceIsCancelled(status: string): boolean {
  return status === 'cancelled';
}

export function invoiceIsOutstanding(status: string): boolean {
  return OUTSTANDING_STATUSES.includes(status as (typeof OUTSTANDING_STATUSES)[number]);
}

export function formatBillingCurrency(amount: number, locale: string, currency = 'SYP'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
}

export function formatBillingDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso));
}

export function generateInvoiceNumber(prefix = 'INV'): string {
  const stamp = Date.now().toString(36).toUpperCase();
  return `${prefix}-${stamp}`;
}

export function normalizeStatusFilter(status: string | null | undefined): string | undefined {
  if (!status || status === 'all') return undefined;
  return status;
}
