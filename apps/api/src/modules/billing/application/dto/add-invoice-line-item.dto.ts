import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AddInvoiceLineItemDto {
  @IsNotEmpty()
  @IsString()
  description!: string;

  @IsNumber()
  @Min(0.01)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taxPercent?: number;
}
