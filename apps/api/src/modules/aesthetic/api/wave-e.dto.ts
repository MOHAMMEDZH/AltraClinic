import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateTreatmentCourseDto {
  @IsUUID()
  patientId!: string;

  @IsUUID()
  clinicalServiceId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  plannedSessions!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  intervalMinDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  intervalMaxDays?: number;

  @IsOptional()
  @IsUUID()
  packagePriceVersionId?: string;
}

export class TransitionTreatmentCourseDto {
  @IsIn(['ACTIVE', 'COMPLETED', 'CANCELLED'])
  toStatus!: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
}

export class LinkCourseSessionAppointmentDto {
  @IsUUID()
  appointmentId!: string;
}

export class TransitionCourseSessionDto {
  @IsIn(['COMPLETED', 'SKIPPED', 'CANCELLED'])
  toStatus!: 'COMPLETED' | 'SKIPPED' | 'CANCELLED';
}

export class CreateDeviceTreatmentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  deviceType!: string;

  /** Opaque external device identifier — not an internal UUID FK (VARCHAR(120)). */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  deviceId?: string;

  @IsUUID()
  clinicalServiceId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bodyArea?: string;

  @IsOptional()
  @IsObject()
  parameterPayload?: Record<string, unknown>;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  parameterSchemaKey!: string;

  @IsUUID()
  patientId!: string;

  @IsUUID()
  providerId!: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  recordedAt?: string;

  @IsOptional()
  @IsUUID()
  beautyAnnotationId?: string;

  @IsOptional()
  @IsUUID()
  encounterId?: string;
}

export class CorrectDeviceTreatmentDto {
  @IsObject()
  parameterPayload!: Record<string, unknown>;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class OpenDermatologyEncounterDto {
  @IsUUID()
  patientId!: string;

  @IsUUID()
  clinicianId!: string;

  @IsUUID()
  clinicalServiceId!: string;

  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  chiefComplaint?: string;
}

export class AssertPrePostCareDto {
  @IsIn(['PRE_CARE', 'POST_CARE'])
  expectedKind!: 'PRE_CARE' | 'POST_CARE';
}

export class CreatePrePostCareInstanceDto {
  @IsIn(['PRE_CARE', 'POST_CARE'])
  kind!: 'PRE_CARE' | 'POST_CARE';

  @IsUUID()
  patientId!: string;

  /** Optional explicit PUBLISHED ClinicalFormVersion id; otherwise latest PUBLISHED for kind. */
  @IsOptional()
  @IsUUID()
  versionId?: string;

  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @IsOptional()
  @IsUUID()
  clinicalServiceId?: string;
}

export class AttachDermatologyPhotoDto {
  @IsOptional()
  @IsUUID()
  mediaAssetId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  originalFilename?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  mimeType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeBytes?: number;
}
