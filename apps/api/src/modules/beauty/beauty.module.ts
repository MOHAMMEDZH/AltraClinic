import { Module } from '@nestjs/common';

import { BeautyController } from './controllers/beauty.controller';

import { BeautyRecordService } from './application/services/beauty-record.service';

import { BeautyDashboardService } from './application/services/beauty-dashboard.service';

import { BeautyExtendedService } from './application/services/beauty-extended.service';

import { BeautySessionSyncService } from './application/services/beauty-session-sync.service';

import { BeautyLoyaltyService } from './application/services/beauty-loyalty.service';

import { BeautyDashboardHandler } from './application/handlers/beauty-dashboard.handler';

import {
  BeautyPatientSummaryHandler,
  BeautyTimelineHandler,
  DeleteBeautyAnnotationHandler,
  UpdateBeautyAnnotationHandler,
} from './application/handlers/beauty-extended.handlers';

import {
  ApproveBeautyPlanHandler,
  AssertBeautyConsentHandler,
  ExportBeautyRecordHandler,
} from './application/handlers/beauty-plan.handlers';

import { BeautyPolicyService } from './policies/beauty-policy.service';

import { BeautyPermissionGuard } from './api/beauty-permission.guard';

import { InventoryModule } from '../inventory/inventory.module';

import { PatientsModule } from '../patients/patients.module';

import { LoyaltyModule } from '../loyalty/loyalty.module';

import {
  ConsumeBeautyMaterialHandler,
  CreateBeautyProcedureMaterialHandler,
  ListBeautyProcedureMaterialsHandler,
  ListPatientBeautyMaterialsHandler,
  SearchBeautyClinicalInventoryHandler,
} from './application/handlers/beauty-material.handlers';

@Module({
  imports: [InventoryModule, PatientsModule, LoyaltyModule],
  controllers: [BeautyController],
  providers: [
    BeautyRecordService,
    BeautyDashboardService,
    BeautyExtendedService,
    BeautySessionSyncService,
    BeautyLoyaltyService,
    BeautyDashboardHandler,
    BeautyPatientSummaryHandler,
    BeautyTimelineHandler,
    UpdateBeautyAnnotationHandler,
    DeleteBeautyAnnotationHandler,
    ApproveBeautyPlanHandler,
    ExportBeautyRecordHandler,
    AssertBeautyConsentHandler,
    BeautyPolicyService,
    BeautyPermissionGuard,
    ListBeautyProcedureMaterialsHandler,
    CreateBeautyProcedureMaterialHandler,
    ListPatientBeautyMaterialsHandler,
    ConsumeBeautyMaterialHandler,
    SearchBeautyClinicalInventoryHandler,
  ],
})
export class BeautyModule {}
