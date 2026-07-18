import { Module } from '@nestjs/common';
import { DentalController } from './controllers/dental.controller';
import { CreateTreatmentHandler } from './application/handlers/create-treatment.handler';
import { GetDentalChartHandler } from './application/handlers/get-dental-chart.handler';
import {
  CreateDentalChartHandler,
  DentalMetricsHandler,
  DentalOverviewHandler,
  UpdateDentalTeethHandler,
} from './application/handlers/dental.handlers';
import { DentalOverviewService } from './application/services/dental-overview.service';
import { DentalExtendedService } from './application/services/dental-extended.service';
import { DentalDashboardHandler } from './application/handlers/dental-dashboard.handler';
import { DentalDashboardService } from './application/services/dental-dashboard.service';
import { TreatmentPlanService } from './application/services/treatment-plan.service';
import { PeriodontalService } from './application/services/periodontal.service';
import {
  ComparePeriodontalExamsHandler,
  CreatePeriodontalExamHandler,
  GetPeriodontalExamHandler,
  ListPeriodontalExamsHandler,
  PeriodontalProgressHandler,
  UpdatePeriodontalExamHandler,
} from './application/handlers/perio.handlers';
import {
  ApproveTreatmentPlanHandler,
  CreateTreatmentPlanHandler,
  GetTreatmentPlanHandler,
  ListTreatmentPlansHandler,
  RecordTreatmentConsentHandler,
  SubmitTreatmentPlanHandler,
  TreatmentPlanAnalyticsHandler,
  UpdateTreatmentItemStatusHandler,
  UpdateTreatmentPlanHandler,
} from './application/handlers/treatment-plan.handlers';
import {
  CreateDentalClinicalNoteHandler,
  CreateImplantRecordHandler,
  CreateOrthodonticCaseHandler,
  CreateTreatmentPlanInvoiceHandler,
  DentalPatientSummaryHandler,
  DentalTimelineHandler,
  ListDentalClinicalNotesHandler,
  ListImplantRecordsHandler,
  ListOrthodonticCasesHandler,
  UpdateImplantRecordHandler,
  UpdateOdontogramModeHandler,
  UpdateOrthodonticCaseHandler,
} from './application/handlers/dental-extended.handlers';
import { PrismaDentalRepository } from './infrastructure/prisma-dental.repository';
import { DentalPolicyService } from './policies/dental-policy.service';
import { DentalPermissionGuard } from './api/dental-permission.guard';
import { DENTAL_RECORD_REPOSITORY } from '../../infrastructure/provider.tokens';
import { InventoryModule } from '../inventory/inventory.module';
import { PatientsModule } from '../patients/patients.module';
import { BillingModule } from '../billing/billing.module';
import {
  ConsumeDentalMaterialHandler,
  CreateDentalProcedureMaterialHandler,
  ListDentalProcedureMaterialsHandler,
  ListPatientDentalMaterialsHandler,
  SearchDentalClinicalInventoryHandler,
} from './application/handlers/dental-material.handlers';

@Module({
  imports: [InventoryModule, PatientsModule, BillingModule],
  controllers: [DentalController],
  providers: [
    CreateTreatmentHandler,
    GetDentalChartHandler,
    CreateDentalChartHandler,
    UpdateDentalTeethHandler,
    DentalMetricsHandler,
    DentalOverviewHandler,
    DentalOverviewService,
    DentalExtendedService,
    DentalDashboardService,
    DentalDashboardHandler,
    DentalPatientSummaryHandler,
    DentalTimelineHandler,
    ListOrthodonticCasesHandler,
    CreateOrthodonticCaseHandler,
    UpdateOrthodonticCaseHandler,
    ListImplantRecordsHandler,
    CreateImplantRecordHandler,
    UpdateImplantRecordHandler,
    ListDentalClinicalNotesHandler,
    CreateDentalClinicalNoteHandler,
    UpdateOdontogramModeHandler,
    CreateTreatmentPlanInvoiceHandler,
    TreatmentPlanService,
    ListTreatmentPlansHandler,
    GetTreatmentPlanHandler,
    CreateTreatmentPlanHandler,
    UpdateTreatmentPlanHandler,
    SubmitTreatmentPlanHandler,
    ApproveTreatmentPlanHandler,
    RecordTreatmentConsentHandler,
    UpdateTreatmentItemStatusHandler,
    TreatmentPlanAnalyticsHandler,
    PeriodontalService,
    ListPeriodontalExamsHandler,
    GetPeriodontalExamHandler,
    CreatePeriodontalExamHandler,
    UpdatePeriodontalExamHandler,
    PeriodontalProgressHandler,
    ComparePeriodontalExamsHandler,
    ListDentalProcedureMaterialsHandler,
    CreateDentalProcedureMaterialHandler,
    ListPatientDentalMaterialsHandler,
    ConsumeDentalMaterialHandler,
    SearchDentalClinicalInventoryHandler,
    DentalPolicyService,
    DentalPermissionGuard,
    { provide: DENTAL_RECORD_REPOSITORY, useClass: PrismaDentalRepository },
  ],
  exports: [TreatmentPlanService],
})
export class DentalModule {}
