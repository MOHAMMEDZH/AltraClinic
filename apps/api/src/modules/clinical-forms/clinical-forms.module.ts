import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { ClinicalFormsController } from './api/clinical-forms.controller';
import { ClinicalFormTemplateService } from './services/clinical-form-template.service';
import { ClinicalFormVersionService } from './services/clinical-form-version.service';
import { PatientFormInstanceService } from './services/patient-form-instance.service';
import { ClinicalServiceFormRequirementService } from './services/clinical-service-form-requirement.service';
import { RequiredConsentGateService } from './services/required-consent-gate.service';
import { PhotoConsentMediaGateService } from './services/photo-consent-media-gate.service';
import { CLINICAL_FORMS_AUDIT_LOG } from './ports/clinical-forms-audit-log.port';
import { AuditTrailClinicalFormsAuditLog } from './infrastructure/audit-trail-clinical-forms-audit-log';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [ClinicalFormsController],
  providers: [
    ClinicalFormTemplateService,
    ClinicalFormVersionService,
    PatientFormInstanceService,
    ClinicalServiceFormRequirementService,
    RequiredConsentGateService,
    PhotoConsentMediaGateService,
    {
      provide: CLINICAL_FORMS_AUDIT_LOG,
      useClass: AuditTrailClinicalFormsAuditLog,
    },
  ],
  exports: [
    RequiredConsentGateService,
    PhotoConsentMediaGateService,
    ClinicalFormTemplateService,
    ClinicalFormVersionService,
    PatientFormInstanceService,
    ClinicalServiceFormRequirementService,
  ],
})
export class ClinicalFormsModule {}
