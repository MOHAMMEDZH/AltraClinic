import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class SetCommissionEligibilityDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  defaultPercent?: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  effectiveFrom?: string;
}

export class CreateCommissionPlanDto {
  @IsUUID()
  userId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  percentage!: number;

  @IsOptional()
  @IsIn([
    'SERVICE_GROSS',
    'SERVICE_NET_AFTER_DISCOUNT',
    'SERVICE_NET_EXCLUDING_TAX',
    'COLLECTED_REVENUE',
  ])
  calculationBasis?:
    | 'SERVICE_GROSS'
    | 'SERVICE_NET_AFTER_DISCOUNT'
    | 'SERVICE_NET_EXCLUDING_TAX'
    | 'COLLECTED_REVENUE';

  @IsOptional()
  @IsIn(['INVOICE_OR_CHARGE_FINALIZED', 'PAYMENT_COLLECTED'])
  earningTrigger?: 'INVOICE_OR_CHARGE_FINALIZED' | 'PAYMENT_COLLECTED';

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  effectiveFrom!: string;

  /** Round 1: user-default only — must be omitted/null. */
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsIn([null], { message: 'branchId must be null in Round 1 (user-default plans only)' })
  branchId?: string | null;

  /** Round 1: user-default only — must be omitted/null. */
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsIn([null], { message: 'clinicalServiceId must be null in Round 1 (user-default plans only)' })
  clinicalServiceId?: string | null;
}

export class PostCommissionAccrualDto {
  @IsUUID()
  servicePerformanceId!: string;

  @IsUUID()
  invoiceLineId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class PostCollectedCommissionAccrualDto {
  @IsUUID()
  servicePerformanceId!: string;

  @IsUUID()
  invoiceLineId!: string;

  @IsUUID()
  paymentId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ReverseCommissionAccrualDto {
  @IsUUID()
  refundId!: string;

  /** Rejected by service — refund-derived proportion is authoritative. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  proportion?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class SettleCommissionAccrualDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  settlementReference!: string;

  /** Optional partial settlement amount; defaults to full net settleable. */
  @IsOptional()
  @Transform(({ value }) => (value == null ? undefined : String(value)))
  @IsString()
  @MaxLength(40)
  amount?: string;
}

export class BindInvoiceLinePerformanceDto {
  @IsUUID()
  invoiceLineId!: string;

  @IsUUID()
  servicePerformanceId!: string;
}

export class OwnerReportQueryDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsUUID()
  clinicalServiceId?: string;

  @IsOptional()
  @IsUUID()
  planVersionId?: string;

  @IsString()
  @MinLength(1)
  from!: string;

  @IsString()
  @MinLength(1)
  to!: string;
}

export class CorrectCommissionAccrualDto {
  @IsUUID()
  correctionEventId!: string;

  @IsUUID()
  replacementInvoiceLineId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class RegisterPackageSessionAllocationDto {
  @IsUUID()
  treatmentCourseId!: string;

  @IsUUID()
  courseSessionId!: string;

  @IsUUID()
  servicePerformanceId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  allocatedRevenueAmount!: string;

  /** Optional anti-tamper hint only — server derives basis from packagePriceVersionId. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  packageCommercialBasisAmount?: string;

  /** Optional anti-tamper hint only — server derives currency from packagePriceVersionId. */
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsUUID()
  invoiceLineId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ListCommissionPlansQueryDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE', 'SUPERSEDED'])
  status?: 'DRAFT' | 'ACTIVE' | 'SUPERSEDED';
}
