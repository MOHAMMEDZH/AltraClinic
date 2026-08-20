import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { AestheticWaveEController } from './api/aesthetic-wave-e.controller';
import { TreatmentCourseService } from './services/treatment-course.service';
import { DeviceTreatmentRecordService } from './services/device-treatment-record.service';
import { DermatologyEncounterService } from './services/dermatology-encounter.service';
import { PrePostCareService } from './services/pre-post-care.service';
import { WAVE_E_AUDIT_LOG } from './ports/wave-e-audit-log.port';
import { AuditTrailWaveEAuditLog } from './infrastructure/audit-trail-wave-e-audit-log';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [AestheticWaveEController],
  providers: [
    TreatmentCourseService,
    DeviceTreatmentRecordService,
    DermatologyEncounterService,
    PrePostCareService,
    { provide: WAVE_E_AUDIT_LOG, useClass: AuditTrailWaveEAuditLog },
  ],
  exports: [
    TreatmentCourseService,
    DeviceTreatmentRecordService,
    DermatologyEncounterService,
    PrePostCareService,
  ],
})
export class AestheticModule {}
