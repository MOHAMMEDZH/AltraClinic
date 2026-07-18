import { IsNotEmpty, IsString, IsOptional, IsISO8601, IsArray, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CommissionLineItemDto {
  @IsOptional()
  @IsString()
  appointmentId?: string | null;

  @IsNotEmpty()
  @IsString()
  serviceDescription!: string;

  @IsNotEmpty()
  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  commissionRateType?: 'percentage' | 'fixed_amount';

  @IsOptional()
  @IsNumber()
  commissionRateValue?: number;

  @IsOptional()
  @IsString()
  serviceType?: string | null;

  @IsOptional()
  @IsNumber()
  minimumThreshold?: number | null;

  @IsOptional()
  @IsNumber()
  maximumCap?: number | null;

  @IsNotEmpty()
  @IsISO8601()
  date!: string;
}

export class CalculateCommissionDto {
  @IsNotEmpty()
  @IsString()
  providerId!: string;

  @IsOptional()
  @IsString()
  branchId?: string | null;

  @IsNotEmpty()
  @IsISO8601()
  periodStart!: string;

  @IsNotEmpty()
  @IsISO8601()
  periodEnd!: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  basisDocumentIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommissionLineItemDto)
  lineItems?: CommissionLineItemDto[];
}
