import { IsOptional, IsString, IsNotEmpty, IsISO8601, IsNumber } from 'class-validator';

export class CreateCommissionRuleDto {
  @IsOptional()
  @IsString()
  providerId?: string | null;

  @IsOptional()
  @IsString()
  serviceType?: string | null;

  @IsNotEmpty()
  @IsString()
  commissionRateType!: 'percentage' | 'fixed_amount';

  @IsNotEmpty()
  @IsNumber()
  commissionRateValue!: number;

  @IsOptional()
  @IsNumber()
  minimumThreshold?: number | null;

  @IsOptional()
  @IsNumber()
  maximumCap?: number | null;

  @IsNotEmpty()
  @IsISO8601()
  effectiveDate!: string;

  @IsOptional()
  @IsISO8601()
  expiryDate?: string | null;
}
