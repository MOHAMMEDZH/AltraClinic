import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
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
