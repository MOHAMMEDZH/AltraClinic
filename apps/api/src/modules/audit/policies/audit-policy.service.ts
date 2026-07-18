import { Injectable } from '@nestjs/common';

@Injectable()
export class AuditPolicy {
  private readonly allowedRoles = new Set(['admin', 'auditor', 'tenant_admin']);

  canAccessAudit(userRoles: string[]): boolean {
    return userRoles.some((role) => this.allowedRoles.has(role));
  }
}
