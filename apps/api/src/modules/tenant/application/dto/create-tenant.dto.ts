import { IsString, IsOptional, IsUrl, Matches } from 'class-validator';

export class CreateTenantDTO {
  @IsString()
  name!: string;

  @IsOptional()
  @IsUrl()
  domain?: string;

  @IsOptional()
  @Matches(/^[-A-Za-z0-9_\/]+$/, { message: 'timezone must be a valid identifier' })
  timezone?: string;
}
