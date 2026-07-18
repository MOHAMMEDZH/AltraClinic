import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAppointmentTemplateDTO {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  serviceType?: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(480)
  durationMin?: number;

  @IsOptional()
  @IsUUID()
  providerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isEmergency?: boolean;
}

export class BulkRescheduleDTO {
  @IsUUID(undefined, { each: true })
  appointmentIds!: string[];

  @IsInt()
  @Min(-90)
  @Max(90)
  shiftDays!: number;
}

export class ResourceAvailabilityQueryDTO {
  @IsUUID()
  resourceId!: string;

  @IsString()
  date!: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(480)
  durationMin?: number;
}
