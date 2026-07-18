import { IsISO8601, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class RecordInvoicePaymentDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;

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
