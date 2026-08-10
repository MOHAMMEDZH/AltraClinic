import { Module, forwardRef } from '@nestjs/common';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { AuthModule } from '../auth/auth.module';
import { AuditCenterQueryService } from './application/audit-center-query.service';
import { AuditCenterEvidenceService } from './application/audit-center-evidence.service';
import { AuditCenterExportService } from './application/audit-center-export.service';
import { AuditCenterRateLimitService } from './application/audit-center-rate-limit.service';
import { PlatformAuditCenterController } from './controllers/platform-audit-center.controller';

/**
 * Flexible Step 21 — Platform Audit Center.
 * Contained behind AUDIT_CENTER_ENABLED (default false).
 * Read/export only — never mutates domain Sources of Record.
 */
@Module({
  imports: [InfrastructureModule, forwardRef(() => AuthModule)],
  controllers: [PlatformAuditCenterController],
  providers: [
    AuditCenterQueryService,
    AuditCenterEvidenceService,
    AuditCenterExportService,
    AuditCenterRateLimitService,
  ],
  exports: [AuditCenterQueryService, AuditCenterEvidenceService, AuditCenterExportService],
})
export class PlatformAuditCenterModule {}
