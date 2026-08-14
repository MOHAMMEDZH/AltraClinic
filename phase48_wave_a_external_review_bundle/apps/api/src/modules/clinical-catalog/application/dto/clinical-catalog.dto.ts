import {
  ClinicalPricingUnit,
  ClinicalServiceDomain,
  ClinicalServiceLifecycle,
  ClinicalServiceProvenance,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class TranslationInputDto {
  @IsString()
  @IsNotEmpty()
  locale!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  shortDescription?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  longDescription?: string | null;
}

export class CreateClinicalServiceDraftDto {
  @IsEnum(ClinicalServiceProvenance)
  provenance!: ClinicalServiceProvenance;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  stableKey!: string;

  @IsOptional()
  @IsEnum(ClinicalServiceDomain)
  domain?: ClinicalServiceDomain;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  categoryKey?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24 * 60)
  defaultDurationMin?: number | null;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TranslationInputDto)
  translations!: TranslationInputDto[];
}

export class UpdateClinicalServiceDraftDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  stableKey?: string;

  @IsOptional()
  @IsEnum(ClinicalServiceDomain)
  domain?: ClinicalServiceDomain;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  categoryKey?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24 * 60)
  defaultDurationMin?: number | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TranslationInputDto)
  translations?: TranslationInputDto[];
}

export class ListClinicalServicesQueryDto {
  @IsOptional()
  @IsEnum(ClinicalServiceLifecycle)
  lifecycle?: ClinicalServiceLifecycle;

  @IsOptional()
  @IsEnum(ClinicalServiceProvenance)
  provenance?: ClinicalServiceProvenance;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;
}

export class UpsertTenantServiceConfigDto {
  @IsUUID()
  clinicalServiceId!: string;

  @IsOptional()
  @IsUUID()
  branchId?: string | null;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24 * 60)
  defaultDurationOverride?: number | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiresResourceTypes?: string[];

  @IsOptional()
  @IsBoolean()
  bookingVisibleOnPortal?: boolean;
}

export class SetTenantServiceConfigEnabledDto {
  @IsBoolean()
  enabled!: boolean;
}

export class CreateClinicalPriceDraftDto {
  @IsUUID()
  clinicalServiceId!: string;

  @IsOptional()
  @IsUUID()
  branchId?: string | null;

  @IsOptional()
  @IsUUID()
  serviceVariantId?: string | null;

  @IsOptional()
  @IsEnum(ClinicalPricingUnit)
  pricingUnit?: ClinicalPricingUnit;

  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currency!: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  taxPercent?: number;

  @IsISO8601()
  effectiveFrom!: string;

  @IsOptional()
  @IsISO8601()
  effectiveTo?: string | null;
}

export class PublishClinicalPriceDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}

/** Explicit price/config list scope — never infer from omitted branchId. */
export type ClinicalCatalogListScope = 'tenant' | 'branch' | 'all';

export class ListClinicalPricesQueryDto {
  @IsOptional()
  @IsUUID()
  clinicalServiceId?: string;

  @IsIn(['tenant', 'branch', 'all'])
  scope!: ClinicalCatalogListScope;

  @ValidateIf((o: ListClinicalPricesQueryDto) => o.scope === 'branch')
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE', 'SCHEDULED', 'SUPERSEDED', 'INACTIVE'])
  status?: 'DRAFT' | 'ACTIVE' | 'SCHEDULED' | 'SUPERSEDED' | 'INACTIVE';
}

export class LookupClinicalPriceQueryDto {
  @IsUUID()
  clinicalServiceId!: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsEnum(ClinicalPricingUnit)
  pricingUnit!: ClinicalPricingUnit;

  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currency!: string;

  @IsOptional()
  @IsUUID()
  serviceVariantId?: string;

  @IsOptional()
  @IsISO8601()
  at?: string;
}

export class ListTenantServiceConfigsQueryDto {
  @IsOptional()
  @IsUUID()
  clinicalServiceId?: string;

  @IsIn(['tenant', 'branch', 'all'])
  scope!: ClinicalCatalogListScope;

  @ValidateIf((o: ListTenantServiceConfigsQueryDto) => o.scope === 'branch')
  @IsUUID()
  branchId?: string;
}

export class EffectiveTenantServiceConfigQueryDto {
  @IsUUID()
  clinicalServiceId!: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}
