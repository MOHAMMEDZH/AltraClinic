import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class UploadMediaDTO {
  @IsString()
  @IsIn(['patient_attachment', 'medical_document', 'dental_image', 'beauty_before_after', 'invoice_attachment'])
  category!: string;

  @IsString()
  ownerType!: string;

  @IsUUID()
  ownerId!: string;

  @IsOptional()
  @IsUUID()
  patientId?: string;

  @IsOptional()
  @IsUUID()
  comparisonGroupId?: string;

  @IsOptional()
  @IsIn(['before', 'after'])
  comparisonRole?: 'before' | 'after';

  @IsOptional()
  @IsString()
  @IsIn(['xray', 'panoramic', 'intraoral', 'before', 'after', 'treatment', 'cbct'])
  imagingType?: string;

  @IsOptional()
  @IsString()
  title?: string;

  /** JSON array of tooth numbers, e.g. "[14,15]" */
  @IsOptional()
  @IsString()
  toothNumbers?: string;

  @IsOptional()
  @IsUUID()
  encounterId?: string;
}
