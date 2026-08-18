import { Type, Transform } from 'class-transformer';
import {
  IsDefined,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNotEmptyObject,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  Min,
  Validate,
  ValidateNested,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/** Approved client-postable usage types (REVERSAL is system-only via reverse endpoint). */
export const INVENTORY_USAGE_TYPES = [
  'CLINICAL_CONSUMPTION',
  'OPERATIONAL_CONSUMPTION',
  'WASTAGE',
  'DAMAGE',
  'EXPIRED',
  'SAMPLE_OR_PROMOTIONAL',
  'CORRECTION',
] as const;

export type InventoryUsageTypeDto = (typeof INVENTORY_USAGE_TYPES)[number];

export class InjectableUsageDto {
  @IsOptional()
  @IsNumber()
  dose?: number;

  @IsOptional()
  @IsString()
  anatomicalSite?: string;

  @IsOptional()
  @IsUUID()
  beautyAnnotationId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class PostInventoryUsageDto {
  @IsNotEmpty()
  @IsUUID()
  itemId!: string;

  @IsNumber()
  @IsPositive()
  quantity!: number;

  /** Accountable human who used the item. Required for CLINICAL_CONSUMPTION. */
  @IsOptional()
  @IsUUID()
  usedByUserId?: string;

  @IsOptional()
  @IsIn([...INVENTORY_USAGE_TYPES])
  usageType?: InventoryUsageTypeDto;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  encounterId?: string;

  @IsOptional()
  @IsUUID()
  beautyAnnotationId?: string;

  @IsOptional()
  @IsUUID()
  patientId?: string;

  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @IsOptional()
  @IsUUID()
  clinicalServiceId?: string;

  @IsOptional()
  @IsUUID()
  inventoryBatchId?: string;

  @IsOptional()
  @IsString()
  reasonCode?: string;

  @IsOptional()
  @IsString()
  procedureCode?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => InjectableUsageDto)
  injectable?: InjectableUsageDto;
}

export class ReverseInventoryUsageDto {
  @IsOptional()
  @IsString()
  reasonCode?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CorrectInventoryUsageCorrectionDto {
  @IsNotEmpty()
  @IsUUID()
  itemId!: string;

  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsOptional()
  @IsUUID()
  usedByUserId?: string;

  @IsOptional()
  @IsIn([...INVENTORY_USAGE_TYPES])
  usageType?: InventoryUsageTypeDto;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsUUID()
  inventoryBatchId?: string;

  @IsOptional()
  @IsUUID()
  patientId?: string;

  @IsOptional()
  @IsUUID()
  clinicalServiceId?: string;

  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @IsOptional()
  @IsString()
  reasonCode?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => InjectableUsageDto)
  injectable?: InjectableUsageDto;
}

export class CorrectInventoryUsageDto {
  @IsNotEmpty()
  @IsString()
  reasonCode!: string;

  @IsDefined()
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => CorrectInventoryUsageCorrectionDto)
  correction!: CorrectInventoryUsageCorrectionDto;
}

const emptyToUndef = ({ value }: { value: unknown }) =>
  value === '' || value === undefined || value === null ? undefined : value;

export const INVENTORY_USAGE_FILTER_TYPES = [...INVENTORY_USAGE_TYPES, 'REVERSAL'] as const;

export const OWNER_REPORT_LIMIT_MAX = 200;

@ValidatorConstraint({ name: 'inventoryOwnerReportDateRange', async: false })
class InventoryOwnerReportDateRangeConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments) {
    const o = args.object as InventoryUsageOwnerReportQueryDto;
    if (!o.from || !o.to) return true;
    const from = new Date(o.from).getTime();
    const to = new Date(o.to).getTime();
    if (Number.isNaN(from) || Number.isNaN(to)) return true;
    return from <= to;
  }

  defaultMessage() {
    return 'from must be less than or equal to to';
  }
}

export class InventoryUsageOwnerReportQueryDto {
  @Transform(emptyToUndef)
  @IsOptional()
  @IsISO8601()
  @Validate(InventoryOwnerReportDateRangeConstraint)
  from?: string;

  @Transform(emptyToUndef)
  @IsOptional()
  @IsISO8601()
  to?: string;

  @Transform(emptyToUndef)
  @IsOptional()
  @IsIn([...INVENTORY_USAGE_FILTER_TYPES])
  usageType?: (typeof INVENTORY_USAGE_FILTER_TYPES)[number];

  @Transform(emptyToUndef)
  @IsOptional()
  @IsUUID()
  usedByUserId?: string;

  @Transform(emptyToUndef)
  @IsOptional()
  @IsUUID()
  inventoryItemId?: string;

  @Transform(emptyToUndef)
  @IsOptional()
  @IsUUID()
  inventoryBatchId?: string;

  @Transform(emptyToUndef)
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @Transform(emptyToUndef)
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @Transform(emptyToUndef)
  @IsOptional()
  @IsUUID()
  clinicalServiceId?: string;

  @Transform(emptyToUndef)
  @IsOptional()
  @IsIn(['true', 'false', '1', '0'])
  includePhi?: string;

  @Transform(({ value }) => {
    if (value === '' || value === undefined || value === null) return undefined;
    return Number(value);
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(OWNER_REPORT_LIMIT_MAX)
  limit?: number;

  @Transform(({ value }) => {
    if (value === '' || value === undefined || value === null) return undefined;
    return Number(value);
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}

export class InventoryUsageListQueryDto {
  @Transform(emptyToUndef)
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @Transform(emptyToUndef)
  @IsOptional()
  @IsUUID()
  encounterId?: string;

  @Transform(emptyToUndef)
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @Transform(emptyToUndef)
  @IsOptional()
  @IsString()
  procedureCode?: string;

  @Transform(({ value }) => {
    if (value === '' || value === undefined || value === null) return undefined;
    return Number(value);
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(OWNER_REPORT_LIMIT_MAX)
  limit?: number;

  @Transform(({ value }) => {
    if (value === '' || value === undefined || value === null) return undefined;
    return Number(value);
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}
