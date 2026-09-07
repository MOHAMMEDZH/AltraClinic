import {
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ArrayMaxSize,
} from 'class-validator';

const SOURCES = ['INBOUND', 'OUTBOUND', 'REFERRAL', 'PARTNER', 'EVENT', 'OTHER'] as const;
const STAGES = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'DEMO_SCHEDULED',
  'PROPOSAL',
  'WON',
  'LOST',
] as const;
const DEMO_STATUSES = ['NONE', 'SCHEDULED', 'COMPLETED', 'CANCELLED'] as const;

export class CreateSalesLeadDto {
  @IsString()
  @MaxLength(255)
  organizationName!: string;

  @IsString()
  @MaxLength(255)
  contactName!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  contactPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  contactJobTitle?: string;

  @IsOptional()
  @IsIn(SOURCES)
  source?: (typeof SOURCES)[number];

  @IsOptional()
  @IsUUID()
  ownerRepresentativeId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  facilityTypeKey?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(16)
  @IsString({ each: true })
  specialtyKeys?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(32)
  @IsString({ each: true })
  desiredModuleKeys?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  estimatedUsers?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  estimatedProviders?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  estimatedLocations?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  nextActionType?: string;

  @IsOptional()
  @IsString()
  nextActionDueAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  nextActionNote?: string;

  @IsOptional()
  @IsUUID()
  linkedPlatformTenantId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class UpdateSalesLeadDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  organizationName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  contactName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  contactEmail?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  contactPhone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  contactJobTitle?: string | null;

  @IsOptional()
  @IsIn(SOURCES)
  source?: (typeof SOURCES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(128)
  facilityTypeKey?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(16)
  @IsString({ each: true })
  specialtyKeys?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(32)
  @IsString({ each: true })
  desiredModuleKeys?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  estimatedUsers?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  estimatedProviders?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  estimatedLocations?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  nextActionType?: string | null;

  @IsOptional()
  @IsString()
  nextActionDueAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  nextActionNote?: string | null;

  @IsOptional()
  @IsUUID()
  linkedPlatformTenantId?: string | null;

  @IsInt()
  @Min(1)
  expectedRowVersion!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AssignLeadOwnerDto {
  @IsOptional()
  @IsUUID()
  ownerRepresentativeId!: string | null;

  @IsInt()
  @Min(1)
  expectedRowVersion!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class ChangeLeadStageDto {
  @IsIn(STAGES)
  stage!: (typeof STAGES)[number];

  @IsInt()
  @Min(1)
  expectedRowVersion!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  wonLostReason?: string;
}

export class TerminalLeadDto {
  @IsInt()
  @Min(1)
  expectedRowVersion!: number;

  @IsString()
  @MaxLength(1000)
  wonLostReason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class UpdateLeadDemoDto {
  @IsIn(DEMO_STATUSES)
  demoStatus!: (typeof DEMO_STATUSES)[number];

  @IsOptional()
  @IsString()
  demoScheduledAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  demoTimezone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  demoNote?: string | null;

  @IsInt()
  @Min(1)
  expectedRowVersion!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class AddLeadNoteDto {
  @IsString()
  @MaxLength(2000)
  body!: string;
}
