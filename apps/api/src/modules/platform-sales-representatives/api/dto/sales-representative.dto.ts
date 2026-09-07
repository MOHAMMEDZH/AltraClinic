import {
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

const CODE_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const TARGET_PERIODS = ['MONTH', 'QUARTER', 'YEAR'] as const;

export class CreateSalesRepresentativeDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  displayName?: string;

  @IsOptional()
  @Matches(CODE_PATTERN)
  regionCode?: string;

  @IsOptional()
  @Matches(CODE_PATTERN)
  territoryCode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  targetAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  targetCurrency?: string;

  @IsOptional()
  @IsIn(TARGET_PERIODS)
  targetPeriod?: (typeof TARGET_PERIODS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class UpdateSalesRepresentativeProfileDto {
  @IsOptional()
  @Matches(CODE_PATTERN)
  regionCode?: string | null;

  @IsOptional()
  @Matches(CODE_PATTERN)
  territoryCode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  displayName?: string;

  @IsInt()
  @Min(1)
  expectedRowVersion!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class UpdateSalesRepresentativeTargetDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  targetAmount?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  targetCurrency?: string | null;

  @IsOptional()
  @IsIn(TARGET_PERIODS)
  targetPeriod?: (typeof TARGET_PERIODS)[number] | null;

  @IsInt()
  @Min(1)
  expectedRowVersion!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AssignManagerDto {
  @IsOptional()
  @IsUUID()
  managerRepresentativeId?: string | null;

  @IsInt()
  @Min(1)
  expectedRowVersion!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class LifecycleActionDto {
  @IsString()
  @MaxLength(500)
  reason!: string;
}

export class OptionalReasonDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AssignRoleDto {
  @IsString()
  @MaxLength(64)
  roleKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AssignOwnershipDto {
  @IsUUID()
  platformTenantId!: string;

  @IsUUID()
  representativeId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ReassignOwnershipDto {
  @IsUUID()
  representativeId!: string;

  @IsInt()
  @Min(1)
  expectedRowVersion!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class RemoveOwnershipDto {
  @IsInt()
  @Min(1)
  expectedRowVersion!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
