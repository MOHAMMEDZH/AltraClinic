import { Module } from '@nestjs/common';
import { TenantScopedAccessGuard } from '../../common/tenant-scoped-access.guard';
import { PatientController } from './controllers/patient.controller';
import { PrismaPatientRepository } from './infrastructure/prisma-patient.repository';
import { CreatePatientHandler } from './application/handlers/create-patient.handler';
import { GetPatientHandler } from './application/handlers/get-patient.handler';
import {
  QuickRegisterPatientHandler,
  ListPatientsHandler,
  UpdatePatientHandler,
  ArchivePatientHandler,
  ReactivatePatientHandler,
  MergePatientsHandler,
  GetPatientTimelineHandler,
  GetPatientDuplicatesHandler,
} from './application/handlers/patient.handlers';
import { PATIENT_REPOSITORY } from '../../infrastructure/provider.tokens';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [SubscriptionModule],
  controllers: [PatientController],
  providers: [
    { provide: PATIENT_REPOSITORY, useClass: PrismaPatientRepository },
    CreatePatientHandler,
    QuickRegisterPatientHandler,
    ListPatientsHandler,
    GetPatientHandler,
    UpdatePatientHandler,
    ArchivePatientHandler,
    ReactivatePatientHandler,
    MergePatientsHandler,
    GetPatientTimelineHandler,
    GetPatientDuplicatesHandler,
    TenantScopedAccessGuard,
  ],
  exports: [PATIENT_REPOSITORY],
})
export class PatientsModule {}
