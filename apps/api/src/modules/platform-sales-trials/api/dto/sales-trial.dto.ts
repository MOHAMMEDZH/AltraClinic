import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  MAX_TRIAL_MODULE_KEYS,
  MAX_TRIAL_REASON_CHARS,
  MAX_TRIAL_SPECIALTY_KEYS,
  TRIAL_MAX_EXTENSIONS_CEILING,
  TRIAL_MAX_INITIAL_DURATION_DAYS,
  TRIAL_MAX_SINGLE_EXTENSION_DAYS,
  TRIAL_MIN_DURATION_DAYS,
} from '../../platform-sales-trials.constants';
import { TRIAL_GRANT_DISPOSITIONS } from '../../domain/sales-trial.types';

const GRANT_KINDS = ['ADD_ON', 'OVERRIDE'] as const;

export class TrialOnlyGrantDto {
  @IsString()
  @MaxLength(160)
  grantKey!: string;

  @IsIn(GRANT_KINDS)
  kind!: (typeof GRANT_KINDS)[number];

  @IsOptional()
  @IsUUID()
  referenceId?: string | null;

  @IsOptional()
  @IsBoolean()
  trialOnly?: boolean;
}

export class CreateSalesTrialDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  organizationName!: string;

  @IsString()
  @MaxLength(128)
  facilityTypeKey!: string;

  @IsUUID()
  trialPlanVersionId!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TRIAL_SPECIALTY_KEYS)
  @IsString({ each: true })
  selectedSpecialtyKeys?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TRIAL_MODULE_KEYS)
  @IsString({ each: true })
  selectedModuleKeys?: string[];

  @IsOptional()
  @IsUUID()
  originatingLeadId?: string | null;

  @IsOptional()
  @IsUUID()
  ownerRepresentativeId?: string | null;

  @IsOptional()
  @IsUUID()
  platformTenantId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(TRIAL_MIN_DURATION_DAYS)
  @Max(TRIAL_MAX_INITIAL_DURATION_DAYS)
  durationDays?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(TRIAL_MAX_EXTENSIONS_CEILING)
  maxExtensions?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(32)
  @ValidateNested({ each: true })
  @Type(() => TrialOnlyGrantDto)
  trialOnlyGrants?: TrialOnlyGrantDto[];

  @IsOptional()
  @IsString()
  @MaxLength(MAX_TRIAL_REASON_CHARS)
  reason?: string;
}

export class UpdateSalesTrialDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  organizationName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  facilityTypeKey?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TRIAL_SPECIALTY_KEYS)
  @IsString({ each: true })
  selectedSpecialtyKeys?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TRIAL_MODULE_KEYS)
  @IsString({ each: true })
  selectedModuleKeys?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(TRIAL_MAX_EXTENSIONS_CEILING)
  maxExtensions?: number;

  @IsOptional()
  @IsUUID()
  ownerRepresentativeId?: string | null;

  @IsInt()
  @Min(1)
  expectedRowVersion!: number;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_TRIAL_REASON_CHARS)
  reason?: string;
}

export class ExtendSalesTrialDto {
  @IsInt()
  @Min(1)
  @Max(TRIAL_MAX_SINGLE_EXTENSION_DAYS)
  extensionDays!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(MAX_TRIAL_REASON_CHARS)
  reason!: string;

  @IsInt()
  @Min(1)
  expectedRowVersion!: number;

  @IsOptional()
  @IsBoolean()
  exceptional?: boolean;
}

export class CancelSalesTrialDto {
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_TRIAL_REASON_CHARS)
  reason!: string;

  @IsInt()
  @Min(1)
  expectedRowVersion!: number;
}

export class TrialGrantDispositionDto {
  @IsString()
  @MaxLength(160)
  grantKey!: string;

  @IsIn(TRIAL_GRANT_DISPOSITIONS as unknown as string[])
  disposition!: (typeof TRIAL_GRANT_DISPOSITIONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(160)
  paidEquivalentKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

export class ConvertSalesTrialDto {
  @IsUUID()
  targetPaidPlanVersionId!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(64)
  @ValidateNested({ each: true })
  @Type(() => TrialGrantDispositionDto)
  dispositions?: TrialGrantDispositionDto[];

  @IsInt()
  @Min(1)
  expectedRowVersion!: number;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_TRIAL_REASON_CHARS)
  reason?: string;
}
