import { Injectable } from '@nestjs/common';
import { ListInvoicesHandler } from './list-invoices.handler';

function csvEscape(value: string | number): string {
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function csvRow(values: Array<string | number>): string {
  return values.map(csvEscape).join(',');
}

@Injectable()
export class ExportInvoicesHandler {
  constructor(private readonly listHandler: ListInvoicesHandler) {}

  async execute(params?: { branchId?: string | null; patientId?: string | null; status?: string | null }) {
    const invoices = await this.listHandler.execute({
      branchId: params?.branchId ?? null,
      patientId: params?.patientId ?? null,
      status: params?.status ?? null,
    });

    const lines: string[] = [];
    lines.push(csvRow(['Invoice Number', 'Patient ID', 'Status', 'Invoice Date', 'Due Date', 'Currency', 'Subtotal', 'Total', 'Paid', 'Due']));
    for (const inv of invoices) {
      const row = inv as Record<string, unknown>;
      const total = Number(row.amountTotal ?? 0);
      const paid = Number(row.amountPaid ?? 0);
      lines.push(
        csvRow([
          String(row.invoiceNumber ?? ''),
          String(row.patientId ?? ''),
          String(row.status ?? ''),
          String(row.invoiceDate ?? ''),
          String(row.dueDate ?? ''),
          String(row.currency ?? 'SYP'),
          Number(row.amountSubtotal ?? total),
          total,
          paid,
          Math.max(0, total - paid),
        ]),
      );
    }
    return lines.join('\n');
  }
}
