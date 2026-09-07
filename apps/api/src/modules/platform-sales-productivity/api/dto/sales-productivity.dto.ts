import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class GenerateCommissionSnapshotDto {
  @IsUUID()
  representativeId!: string;

  @IsString()
  @MinLength(7)
  @MaxLength(16)
  periodKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  periodTimezone?: string;

  @IsOptional()
  @IsBoolean()
  finalize?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ReviewCommissionSnapshotDto {
  @IsIn(['NONE', 'IN_REVIEW', 'REVIEWED', 'REJECTED'])
  reviewStatus!: 'NONE' | 'IN_REVIEW' | 'REVIEWED' | 'REJECTED';

  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  expectedRowVersion!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class MarkPaidCommissionSnapshotDto {
  @IsIn(['UNPAID', 'PAID'])
  paidStatus!: 'UNPAID' | 'PAID';

  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  expectedRowVersion!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  paidReason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  paidReference?: string;
}
