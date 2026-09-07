import { Type } from 'class-transformer';
import {
  IsDefined,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class LinkPlanItemAppointmentDto {
  @IsDefined()
  @IsUUID()
  appointmentId!: string;

  @IsOptional()
  @IsIn(['PRIMARY', 'SUPPORTING'])
  linkRole?: 'PRIMARY' | 'SUPPORTING';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CompletePlanItemFromAppointmentDto {
  @IsDefined()
  @IsUUID()
  appointmentId!: string;
}

export class CreateDentalLabCaseDto {
  @IsDefined()
  @IsUUID()
  patientId!: string;

  @IsDefined()
  @IsUUID()
  providerId!: string;

  @IsOptional()
  @IsUUID()
  planItemId?: string;

  @IsDefined()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  labVendor!: string;

  @IsDefined()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  caseType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  toothOrArch?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  shade?: string;

  @IsOptional()
  @IsString()
  specs?: string;

  @IsOptional()
  @IsISO8601()
  expectedAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  costRef?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class TransitionDentalLabCaseDto {
  @IsDefined()
  @IsIn(['DRAFT', 'SENT', 'IN_LAB', 'RECEIVED', 'SEATED', 'CANCELLED'])
  status!: string;
}

export class AttachDentalLabCaseMediaDto {
  @IsDefined()
  @IsUUID()
  mediaAssetId!: string;
}
