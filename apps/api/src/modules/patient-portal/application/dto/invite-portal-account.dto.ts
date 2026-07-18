import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PORTAL_LOCALES, PortalLocale } from '../../domain/value-objects/portal-preferences.vo';

export class InvitePortalAccountDto {
  @IsString()
  @IsNotEmpty()
  patientId!: string;

  @IsOptional()
  @IsIn(PORTAL_LOCALES)
  locale?: PortalLocale;
}
