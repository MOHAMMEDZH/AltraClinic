import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

export class ConsumeInventoryDTO {
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
  @IsUUID()
  sourceDocumentId?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsIn([
    'CLINICAL_CONSUMPTION',
    'OPERATIONAL_CONSUMPTION',
    'WASTAGE',
    'DAMAGE',
    'EXPIRED',
    'SAMPLE_OR_PROMOTIONAL',
    'CORRECTION',
  ])
  usageType?:
    | 'CLINICAL_CONSUMPTION'
    | 'OPERATIONAL_CONSUMPTION'
    | 'WASTAGE'
    | 'DAMAGE'
    | 'EXPIRED'
    | 'SAMPLE_OR_PROMOTIONAL'
    | 'CORRECTION';

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
}
