import { Inject, Injectable, Logger } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { USER_REPOSITORY } from '../../../infrastructure/provider.tokens';
import { UserRepository } from '../../identity/domain/user.repository.interface';
import type {
  ExportAdapter,
  ExportContext,
  ExportFileFormat,
  ExportResult,
} from '../domain/export/export-adapter.contracts';
import { IMPORT_EXPORT_LOG_KIND } from '../import-export.constants';

/**
 * Phase 42e — Users export adapter (business query/transform owned by identity/users).
 */
@Injectable()
export class UsersExportAdapter implements ExportAdapter {
  readonly typeId = 'users-export';
  readonly supportedFormats = ['csv', 'xlsx'] as const;
  private readonly logger = new Logger(UsersExportAdapter.name);

  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async execute(context: ExportContext): Promise<ExportResult> {
    const pageSize = 200;
    let page = 1;
    const rows: Array<Record<string, string>> = [];

    for (;;) {
      const result = await this.users.list({
        tenantId: context.tenantId,
        branchId: context.branchId ?? undefined,
        page,
        limit: pageSize,
        status: 'all',
      });
      for (const user of result.items) {
        rows.push({
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          roles: user.roles.join(';'),
          branchId: user.branchId ?? '',
          isActive: String(user.isActive),
          employmentStatus: user.employmentStatus,
        });
      }
      if (result.items.length < pageSize || rows.length >= result.total) break;
      page += 1;
      if (page > 100) break;
    }

    this.logger.log(
      JSON.stringify({
        kind: IMPORT_EXPORT_LOG_KIND,
        component: 'users_export_adapter',
        event: 'dataset_generated',
        jobId: context.jobId,
        rowCount: rows.length,
        format: context.format,
      }),
    );

    const bytes =
      context.format === 'csv' ? Buffer.from(toCsv(rows), 'utf8') : await toXlsx(rows);
    const contentType =
      context.format === 'csv'
        ? 'text/csv'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const filename = `users-export-${context.jobId}.${context.format}`;

    return {
      success: true,
      artifact: {
        format: context.format,
        contentType,
        filename,
        bytes,
        rowCount: rows.length,
      },
      summary: {
        rowCount: rows.length,
        format: context.format,
        byteLength: bytes.length,
      },
      warnings: [],
    };
  }
}

function toCsv(rows: Array<Record<string, string>>): string {
  const headers = ['email', 'firstName', 'lastName', 'roles', 'branchId', 'isActive', 'employmentStatus'];
  const escape = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h] ?? '')).join(','));
  }
  return lines.join('\n');
}

async function toXlsx(rows: Array<Record<string, string>>): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Users');
  sheet.columns = [
    { header: 'email', key: 'email', width: 28 },
    { header: 'firstName', key: 'firstName', width: 16 },
    { header: 'lastName', key: 'lastName', width: 16 },
    { header: 'roles', key: 'roles', width: 24 },
    { header: 'branchId', key: 'branchId', width: 36 },
    { header: 'isActive', key: 'isActive', width: 10 },
    { header: 'employmentStatus', key: 'employmentStatus', width: 16 },
  ];
  for (const row of rows) sheet.addRow(row);
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export function assertExportFormat(format: string): asserts format is ExportFileFormat {
  if (format !== 'csv' && format !== 'xlsx') {
    throw new Error('Unsupported export format. Only CSV and XLSX are allowed.');
  }
}
