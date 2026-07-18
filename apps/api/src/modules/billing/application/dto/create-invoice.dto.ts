import { IsArray, IsBoolean, IsISO8601, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AddInvoiceLineItemDto } from './add-invoice-line-item.dto';

export class CreateInvoiceDto {
  @IsNotEmpty()
  @IsString()
  patientId!: string;

  @IsOptional()
  @IsString()
  branchId?: string | null;

  @IsNotEmpty()
  @IsString()
  invoiceNumber!: string;

  @IsNotEmpty()
  @IsISO8601()
  invoiceDate!: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string | null;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  notes?: string | null;

  /** When false, allows clinical/treatment invoices without an active subscription. Defaults to true. */
  @IsOptional()
  @IsBoolean()
  requireActiveSubscription?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddInvoiceLineItemDto)
  lineItems?: AddInvoiceLineItemDto[];
}
