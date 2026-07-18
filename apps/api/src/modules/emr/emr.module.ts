import { Module } from '@nestjs/common';
import { TenantScopedAccessGuard } from '../../common/tenant-scoped-access.guard';
import { DentalModule } from '../dental/dental.module';
import { EncounterController } from './controllers/encounter.controller';
import { EmrController } from './controllers/emr.controller';
import { PrismaEncounterRepository } from './infrastructure/prisma-encounter.repository';
import { CreateEncounterHandler } from './application/handlers/create-encounter.handler';
import { GetEncounterHandler } from './application/handlers/get-encounter.handler';
import {
  EmrMetricsHandler,
  ListEncountersHandler,
  UpdateEncounterHandler,
} from './application/handlers/encounter.handlers';
import {
  AppendVitalsHandler,
  CompleteEncounterHandler,
  CreatePatientProblemHandler,
  EmrClinicalSearchHandler,
  EmrDashboardHandler,
  GetEncounterAuditHandler,
  GetPrescriptionHistoryHandler,
  ListPatientProblemsHandler,
  ResolvePatientProblemHandler,
  SignEncounterHandler,
  UpdateSoapNotesHandler,
} from './application/handlers/emr-extended.handlers';
import {
  CreateLabResultHandler,
  CreateNoteTemplateHandler,
  DeleteNoteTemplateHandler,
  GetEncounterBillingHandler,
  ListLabResultsHandler,
  ListNoteTemplatesHandler,
  ListPatientTreatmentPlansHandler,
  RecordMedicationRefillHandler,
  UpdateNoteTemplateHandler,
  UpdateStructuredNotesHandler,
  CheckDrugInteractionsHandler,
  CoSignEncounterHandler,
  CreateEmrTreatmentPlanHandler,
  UpdateEmrTreatmentPlanHandler,
  UpdateEmrTreatmentItemStatusHandler,
} from './application/handlers/emr-supplementary.handlers';
import { EmrEncounterService } from './application/services/emr-encounter.service';
import { EmrEventService } from './application/services/emr-event.service';
import { EmrProblemService } from './application/services/emr-problem.service';
import { EmrLabService } from './application/services/emr-lab.service';
import { EmrNoteTemplateService } from './application/services/emr-note-template.service';
import { EmrTreatmentPlanService } from './application/services/emr-treatment-plan.service';
import { EmrBillingService } from './application/services/emr-billing.service';
import { EmrDrugInteractionService } from './application/services/emr-drug-interaction.service';
import { ENCOUNTER_REPOSITORY } from '../../infrastructure/provider.tokens';
import { PatientsModule } from '../patients/patients.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ListEncounterMaterialsHandler } from './application/handlers/list-encounter-materials.handler';
import { ConsumeEncounterMaterialHandler } from './application/handlers/consume-encounter-material.handler';
import { SearchClinicalInventoryHandler } from './application/handlers/search-clinical-inventory.handler';

@Module({
  imports: [PatientsModule, InventoryModule, DentalModule],
  controllers: [EncounterController, EmrController],
  providers: [
    { provide: ENCOUNTER_REPOSITORY, useClass: PrismaEncounterRepository },
    EmrEncounterService,
    EmrEventService,
    EmrProblemService,
    EmrLabService,
    EmrNoteTemplateService,
    EmrTreatmentPlanService,
    EmrBillingService,
    EmrDrugInteractionService,
    CreateEncounterHandler,
    GetEncounterHandler,
    ListEncountersHandler,
    EmrMetricsHandler,
    UpdateEncounterHandler,
    ListEncounterMaterialsHandler,
    ConsumeEncounterMaterialHandler,
    SearchClinicalInventoryHandler,
    CompleteEncounterHandler,
    SignEncounterHandler,
    AppendVitalsHandler,
    GetEncounterAuditHandler,
    EmrClinicalSearchHandler,
    EmrDashboardHandler,
    UpdateSoapNotesHandler,
    ListPatientProblemsHandler,
    CreatePatientProblemHandler,
    ResolvePatientProblemHandler,
    GetPrescriptionHistoryHandler,
    ListLabResultsHandler,
    CreateLabResultHandler,
    ListNoteTemplatesHandler,
    CreateNoteTemplateHandler,
    UpdateNoteTemplateHandler,
    DeleteNoteTemplateHandler,
    ListPatientTreatmentPlansHandler,
    GetEncounterBillingHandler,
    UpdateStructuredNotesHandler,
    RecordMedicationRefillHandler,
    CheckDrugInteractionsHandler,
    CoSignEncounterHandler,
    CreateEmrTreatmentPlanHandler,
    UpdateEmrTreatmentPlanHandler,
    UpdateEmrTreatmentItemStatusHandler,
    TenantScopedAccessGuard,
  ],
  exports: [],
})
export class EMRModule {}
