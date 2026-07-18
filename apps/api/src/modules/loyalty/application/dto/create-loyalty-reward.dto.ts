import { IsNotEmpty, IsString, IsNumber, IsOptional, IsISO8601 } from 'class-validator';

export class CreateLoyaltyRewardDto {
  @IsNotEmpty()
  @IsString()
  accountId!: string;

  @IsNotEmpty()
  @IsNumber()
  pointsRequired!: number;

  @IsNotEmpty()
  @IsString()
  description!: string;

  @IsOptional()
  @IsISO8601()
  expiryDate?: string | null;
}
