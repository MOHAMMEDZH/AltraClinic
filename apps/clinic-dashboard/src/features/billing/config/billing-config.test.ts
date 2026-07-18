import { describe, expect, it } from 'vitest';
import {
  billingGridColumns,
  generateInvoiceNumber,
  invoiceIsOutstanding,
  normalizeStatusFilter,
  resolveBillingWorkspaceMode,
} from '../config/billing-config';

describe('billing-config', () => {
  it('resolves workspace mode from roles', () => {
    expect(resolveBillingWorkspaceMode(['accountant'])).toBe('finance');
    expect(resolveBillingWorkspaceMode(['receptionist'])).toBe('reception');
    expect(resolveBillingWorkspaceMode(['owner'])).toBe('finance');
    expect(resolveBillingWorkspaceMode(['nurse'])).toBe('clinical');
  });

  it('detects outstanding invoices', () => {
    expect(invoiceIsOutstanding('issued')).toBe(true);
    expect(invoiceIsOutstanding('partial_paid')).toBe(true);
    expect(invoiceIsOutstanding('paid')).toBe(false);
  });

  it('normalizes status filter', () => {
    expect(normalizeStatusFilter('all')).toBeUndefined();
    expect(normalizeStatusFilter('draft')).toBe('draft');
  });

  it('generates invoice numbers', () => {
    expect(generateInvoiceNumber().startsWith('INV-')).toBe(true);
  });

  it('adds select column when grid is selectable', () => {
    expect(billingGridColumns(false).startsWith('minmax(140px')).toBe(true);
    expect(billingGridColumns(true).startsWith('44px')).toBe(true);
  });
});
