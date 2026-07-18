import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { RegisterUserHandler } from './register-user.handler';
import { TenantContextService } from '../../../../infrastructure/tenant-context.service';
import { ALL_ROLES, UserRole } from '../../domain/user.entity';

export interface ImportUserRow {
  email: string;
  firstName: string;
  lastName: string;
  roles?: string[];
  password?: string;
}

@Injectable()
export class ImportUsersHandler {
  constructor(
    private readonly registerHandler: RegisterUserHandler,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(rows: ImportUserRow[]) {
    const tenant = await this.tenantContext.resolve();
    let created = 0;
    const errors: Array<{ row: number; message: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (!row.email?.trim() || !row.firstName?.trim() || !row.lastName?.trim()) {
          throw new Error('email, firstName, and lastName are required');
        }
        const roles = (row.roles ?? ['receptionist']).filter((r): r is UserRole =>
          ALL_ROLES.includes(r as UserRole),
        );
        const password = row.password?.trim() || randomBytes(12).toString('base64url');
        await this.registerHandler.execute({
          email: row.email.trim(),
          password,
          firstName: row.firstName.trim(),
          lastName: row.lastName.trim(),
          roles: roles.length > 0 ? roles : ['receptionist'],
          branchId: tenant.branchId ?? null,
        });
        created++;
      } catch (err) {
        errors.push({ row: i + 1, message: err instanceof Error ? err.message : 'Import failed' });
      }
    }

    return { created, errors };
  }
}
