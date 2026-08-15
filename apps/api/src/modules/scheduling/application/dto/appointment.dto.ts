import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RecurrenceDTO {
  @IsIn(['weekly', 'biweekly', 'monthly'])
  frequency!: 'weekly' | 'biweekly' | 'monthly';

  @IsInt()
  @Min(2)
  @Max(52)
  occurrences!: number;
}

export class CreateAppointmentDTO {
  @IsUUID()
  patientId!: string;

  @IsUUID()
  providerId!: string;

  @IsISO8601()
  start!: string;

  @IsISO8601()
  end!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  serviceType?: string;

  @IsOptional()
  @IsBoolean()
  isEmergency?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => RecurrenceDTO)
  recurrence?: RecurrenceDTO;

  @IsOptional()
  @IsUUID()
  resourceId?: string;

  @IsOptional()
  @IsUUID()
  clinicalServiceId?: string;

  @IsOptional()
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  pricingUnit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  commercialReason?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  resourceIds?: string[];
}

export class UpdateAppointmentDTO {
  @IsOptional()
  @IsIn(['confirm', 'cancel', 'complete', 'no_show', 'check_in', 'start_visit'])
  action?: 'confirm' | 'cancel' | 'complete' | 'no_show' | 'check_in' | 'start_visit';

  @IsOptional()
  @IsUUID()
  providerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  serviceType?: string | null;

  @IsOptional()
  @IsBoolean()
  isEmergency?: boolean;

  @IsOptional()
  @IsIn(['future'])
  seriesScope?: 'future';

  @IsOptional()
  @IsUUID()
  resourceId?: string | null;

  @IsOptional()
  @IsISO8601()
  start?: string;

  @IsOptional()
  @IsISO8601()
  end?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  cancellationReason?: string | null;

  /** Wave B — canonical clinical service identity */
  @IsOptional()
  @IsUUID()
  clinicalServiceId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  changeReason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  commercialReason?: string;

  @IsOptional()
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  pricingUnit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  resourceIds?: string[];
}

export class ListAppointmentsQueryDTO {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsUUID()
  providerId?: string;

  @IsOptional()
  @IsUUID()
  patientId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsIn(['pending', 'confirmed', 'checked_in', 'in_progress', 'cancelled', 'completed', 'no_show'])
  status?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  limit?: number;

  @IsOptional()
  offset?: number;
}

export class CommercialCorrectionDTO {
  @IsUUID()
  clinicalServiceId!: string;

  @IsString()
  @MaxLength(500)
  changeReason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  commercialReason?: string;

  @IsOptional()
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  pricingUnit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;
}

export class CreateProviderEligibilityDTO {
  @IsUUID()
  providerUserId!: string;

  @IsUUID()
  clinicalServiceId!: string;

  @IsOptional()
  @IsUUID()
  branchId?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsISO8601()
  effectiveFrom!: string;

  @IsOptional()
  @IsISO8601()
  effectiveTo?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  specialtyRequirementRef?: string;
}

export class UpsertResourceRequirementDTO {
  @IsUUID()
  clinicalServiceId!: string;

  @IsIn(['ROOM', 'EQUIPMENT'])
  resourceType!: 'ROOM' | 'EQUIPMENT';

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class EligibilityReadinessQueryDTO {
  @IsOptional()
  @IsString()
  clinicalServiceIds?: string;

  @IsOptional()
  @IsString()
  providerUserIds?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}
