import { IsBoolean, IsIn, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PORTAL_LOCALES, PortalLocale } from '../../domain/value-objects/portal-preferences.vo';

export class NotificationChannelsDto {
  @IsBoolean()
  email!: boolean;

  @IsBoolean()
  sms!: boolean;

  @IsBoolean()
  push!: boolean;
}

export class UpdatePortalPreferencesDto {
  @IsIn(PORTAL_LOCALES)
  locale!: PortalLocale;

  @ValidateNested()
  @Type(() => NotificationChannelsDto)
  channels!: NotificationChannelsDto;
}
