import { Module } from '@nestjs/common';
import { AuditController } from './controllers/audit.controller';
import { PrismaAuditEntryRepository } from './infrastructure/prisma-audit-entry.repository';
import { CreateAuditEntryHandler } from './application/handlers/create-audit-entry.handler';
import { GetAuditEntryHandler } from './application/handlers/get-audit-entry.handler';
import { SearchAuditLogsHandler } from './application/handlers/search-audit-logs.handler';
import { AuditPermissionGuard } from './api/audit-permission.guard';
import { AuditPolicy } from './policies/audit-policy.service';
import { AUDIT_ENTRY_REPOSITORY } from '../../infrastructure/provider.tokens';

@Module({
  controllers: [AuditController],
  providers: [
    { provide: AUDIT_ENTRY_REPOSITORY, useClass: PrismaAuditEntryRepository },
    CreateAuditEntryHandler,
    GetAuditEntryHandler,
    SearchAuditLogsHandler,
    AuditPolicy,
    AuditPermissionGuard,
  ],
  exports: [AUDIT_ENTRY_REPOSITORY],
})
export class AuditModule {}
