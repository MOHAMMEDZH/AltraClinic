import { randomBytes } from 'crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { USER_REPOSITORY, EVENT_PUBLISHER } from '../../../infrastructure/provider.tokens';
import { EventPublisherInterface } from '../../../infrastructure/event-publisher.interface';
import { UserRepository } from '../../identity/domain/user.repository.interface';
import { User, UserRole, ALL_ROLES } from '../../identity/domain/user.entity';
import { PasswordHasher } from '../../identity/infrastructure/password-hasher';
import { UserRegisteredEvent } from '../../identity/domain/events/user-registered.event';
import { SubscriptionEnforcementService } from '../../subscription/application/services/subscription-enforcement.service';
import type {
  ImportAdapter,
  ImportContext,
  ImportResult,
  ImportValidationResult,
} from '../domain/import/import-adapter.contracts';
import { IMPORT_EXPORT_LOG_KIND } from '../import-export.constants';

const DOCTOR_ROLES: UserRole[] = ['doctor', 'dentist', 'specialist'];

/**
 * Phase 42d — Users import adapter (business logic owned by identity/users domain).
 * Hub never opens business transactions; this adapter owns persistence decisions.
 */
@Injectable()
export class UsersImportAdapter implements ImportAdapter {
  readonly typeId = 'users-import';
  readonly supportedFormats = ['csv', 'xlsx'] as const;
  private readonly logger = new Logger(UsersImportAdapter.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisherInterface,
    private readonly enforcement: SubscriptionEnforcementService,
  ) {}

  async validate(context: ImportContext): Promise<ImportValidationResult> {
    const issues: ImportValidationResult['issues'] = [];
    let validRowCount = 0;
    context.rows.forEach((row, index) => {
      const email = String(row.email ?? '').trim();
      const firstName = String(row.firstName ?? '').trim();
      const lastName = String(row.lastName ?? '').trim();
      if (!email || !firstName || !lastName) {
        issues.push({
          row: index + 1,
          code: 'required_fields',
          message: 'email, firstName, and lastName are required',
        });
        return;
      }
      if (!email.includes('@')) {
        issues.push({
          row: index + 1,
          code: 'invalid_email',
          message: 'email format is invalid',
          field: 'email',
        });
        return;
      }
      validRowCount += 1;
    });
    return {
      valid: issues.length === 0,
      issues,
      rowCount: context.rows.length,
      validRowCount,
    };
  }

  async execute(context: ImportContext): Promise<ImportResult> {
    const validation = await this.validate(context);
    if (!validation.valid) {
      return {
        success: false,
        validation,
        summary: { created: 0, updated: 0, skipped: 0, failed: validation.issues.length, dryRun: context.dryRun },
        warnings: [],
        error: 'validation_failed',
      };
    }

    if (context.dryRun) {
      this.logger.log(
        JSON.stringify({
          kind: IMPORT_EXPORT_LOG_KIND,
          component: 'users_import_adapter',
          event: 'dry_run_summary',
          jobId: context.jobId,
          rowCount: context.rows.length,
          persisted: false,
        }),
      );
      return {
        success: true,
        validation,
        summary: {
          created: 0,
          updated: 0,
          skipped: context.rows.length,
          failed: 0,
          dryRun: true,
        },
        warnings: ['dry_run_no_persistence'],
      };
    }

    let created = 0;
    let failed = 0;
    const warnings: string[] = [];

    for (let i = 0; i < context.rows.length; i++) {
      const row = context.rows[i];
      try {
        await this.persistUser(context, row);
        created += 1;
      } catch (error) {
        failed += 1;
        warnings.push(`row ${i + 1}: ${error instanceof Error ? error.message : 'import failed'}`);
      }
    }

    return {
      success: failed === 0,
      validation,
      summary: { created, updated: 0, skipped: 0, failed, dryRun: false },
      warnings,
      error: failed > 0 ? 'partial_or_failed_import' : undefined,
    };
  }

  private async persistUser(context: ImportContext, row: Record<string, unknown>): Promise<void> {
    const email = String(row.email ?? '').toLowerCase().trim();
    const firstName = String(row.firstName ?? '').trim();
    const lastName = String(row.lastName ?? '').trim();
    const rolesRaw = row.roles;
    const roles = Array.isArray(rolesRaw)
      ? (rolesRaw.map(String).filter((r) => ALL_ROLES.includes(r as UserRole)) as UserRole[])
      : typeof rolesRaw === 'string'
        ? rolesRaw
            .split(/[;,]/)
            .map((r) => r.trim())
            .filter((r): r is UserRole => ALL_ROLES.includes(r as UserRole))
        : (['receptionist'] as UserRole[]);

    const existing = await this.users.findByEmail(email, context.tenantId);
    if (existing) {
      throw new Error('User with this email already exists');
    }

    const resolvedRoles = roles.length > 0 ? roles : (['receptionist'] as UserRole[]);
    const isStaff = resolvedRoles.some((r) => r !== ('patient' as UserRole));
    const isDoctor = resolvedRoles.some((r) => DOCTOR_ROLES.includes(r));
    if (isStaff) await this.enforcement.enforceUserLimit(context.tenantId);
    if (isDoctor) await this.enforcement.enforceDoctorLimit(context.tenantId);

    const password =
      String(row.password ?? '').trim() || randomBytes(12).toString('base64url');
    const hash = await PasswordHasher.hash(password);
    const user = User.create({
      email,
      passwordHash: hash,
      roles: resolvedRoles,
      tenantId: context.tenantId,
      branchId: context.branchId,
      firstName,
      lastName,
      firstNameAr: null,
      lastNameAr: null,
      phone: null,
    });
    await this.users.save(user);
    await this.events.publish(
      new UserRegisteredEvent(
        context.tenantId,
        context.branchId,
        user.id,
        email,
        user.roles,
      ),
    );
  }
}

/** Hub-owned structural parse only — not business validation. */
export async function parseImportRows(
  format: 'csv' | 'xlsx',
  buffer: Buffer,
): Promise<Record<string, unknown>[]> {
  if (format === 'csv') return parseCsv(buffer);
  return parseXlsx(buffer);
}

function parseCsv(buffer: Buffer): Record<string, unknown>[] {
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const row: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? '';
    });
    return row;
  });
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

async function parseXlsx(buffer: Buffer): Promise<Record<string, unknown>[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const rows: Record<string, unknown>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const email = String(row.getCell(1).text ?? '').trim();
    const firstName = String(row.getCell(2).text ?? '').trim();
    const lastName = String(row.getCell(3).text ?? '').trim();
    const rolesRaw = String(row.getCell(4).text ?? '').trim();
    const password = String(row.getCell(5).text ?? '').trim();
    if (!email && !firstName && !lastName) return;
    rows.push({
      email,
      firstName,
      lastName,
      roles: rolesRaw || undefined,
      password: password || undefined,
    });
  });
  return rows;
}
