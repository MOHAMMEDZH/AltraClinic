import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TreatmentPlanItemDTO {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @MaxLength(20)
  code!: string;

  @IsString()
  @MaxLength(500)
  description!: string;

  @IsOptional()
  @IsArray()
  toothNumbers?: number[];

  @IsOptional()
  @IsInt()
  @Min(1)
  estimatedMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedCost?: number;

  @IsOptional()
  @IsUUID()
  dependsOnItemId?: string | null;

  @IsOptional()
  @IsBoolean()
  insuranceEligible?: boolean;

  @IsOptional()
  @IsNumber()
  insuranceEstimate?: number | null;

  @IsOptional()
  @IsNumber()
  patientPortion?: number | null;

  @IsOptional()
  @IsBoolean()
  requiresPreAuth?: boolean;

  @IsOptional()
  @IsString()
  preAuthStatus?: string | null;

  @IsOptional()
  @IsIn(['planned', 'scheduled', 'in_progress', 'completed', 'cancelled', 'blocked'])
  status?: string;
}

export class TreatmentPhaseDTO {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsInt()
  visitNumber?: number | null;

  @IsOptional()
  @IsString()
  estimatedVisitDate?: string | null;

  @IsOptional()
  @IsString()
  clinicalNotes?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TreatmentPlanItemDTO)
  items?: TreatmentPlanItemDTO[];
}

export class CreateTreatmentPlanDTO {
  @IsUUID()
  patientId!: string;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  clinicalNotes?: string | null;

  @IsOptional()
  @IsObject()
  insuranceSnapshot?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TreatmentPhaseDTO)
  phases?: TreatmentPhaseDTO[];
}

export class UpdateTreatmentPlanDTO {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  clinicalNotes?: string | null;

  @IsOptional()
  @IsObject()
  insuranceSnapshot?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TreatmentPhaseDTO)
  phases?: TreatmentPhaseDTO[];
}

export class RecordConsentDTO {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  method?: string;
}

export class UpdateItemStatusDTO {
  @IsIn(['planned', 'scheduled', 'in_progress', 'completed', 'cancelled', 'blocked'])
  status!: string;
}
