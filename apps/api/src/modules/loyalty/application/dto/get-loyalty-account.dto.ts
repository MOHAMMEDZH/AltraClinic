import { IsNotEmpty, IsString } from 'class-validator';

export class GetLoyaltyAccountDto {
  @IsNotEmpty()
  @IsString()
  accountId!: string;
}
