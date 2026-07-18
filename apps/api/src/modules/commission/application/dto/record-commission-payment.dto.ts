import { IsNotEmpty, IsString, IsOptional, IsISO8601 } from 'class-validator';

export class RecordCommissionPaymentDto {
  @IsNotEmpty()
  @IsString()
  paymentMethod!: string;

  @IsOptional()
  @IsString()
  paymentReference?: string | null;

  @IsOptional()
  @IsISO8601()
  paymentDate?: string | null;
}
