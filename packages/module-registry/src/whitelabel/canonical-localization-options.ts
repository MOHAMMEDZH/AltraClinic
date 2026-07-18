import type { CanonicalLocalizationOption } from './white-label-types';

export const CANONICAL_LOCALIZATION_OPTIONS: readonly CanonicalLocalizationOption[] = [
  { localizationId: 'locale-en', labelKey: 'whitelabel.localization.localeEn', optionKind: 'locale', defaultValue: 'en', sortOrder: 10 },
  { localizationId: 'locale-ar', labelKey: 'whitelabel.localization.localeAr', optionKind: 'locale', defaultValue: 'ar-SY', sortOrder: 20 },
  { localizationId: 'date-format-iso', labelKey: 'whitelabel.localization.dateIso', optionKind: 'dateFormat', defaultValue: 'yyyy-MM-dd', sortOrder: 30 },
  { localizationId: 'date-format-us', labelKey: 'whitelabel.localization.dateUs', optionKind: 'dateFormat', defaultValue: 'MM/dd/yyyy', sortOrder: 40 },
  { localizationId: 'date-format-eu', labelKey: 'whitelabel.localization.dateEu', optionKind: 'dateFormat', defaultValue: 'dd/MM/yyyy', sortOrder: 50 },
  { localizationId: 'time-format-12h', labelKey: 'whitelabel.localization.time12h', optionKind: 'timeFormat', defaultValue: '12h', sortOrder: 60 },
  { localizationId: 'time-format-24h', labelKey: 'whitelabel.localization.time24h', optionKind: 'timeFormat', defaultValue: '24h', sortOrder: 70 },
  { localizationId: 'currency-display-code', labelKey: 'whitelabel.localization.currencyCode', optionKind: 'currencyDisplay', defaultValue: 'code', sortOrder: 80 },
  { localizationId: 'currency-display-symbol', labelKey: 'whitelabel.localization.currencySymbol', optionKind: 'currencyDisplay', defaultValue: 'symbol', sortOrder: 90 },
] as const;

export const CANONICAL_LOCALIZATION_OPTION_COUNT = CANONICAL_LOCALIZATION_OPTIONS.length;

export const CANONICAL_LOCALIZATION_OPTION_IDS = CANONICAL_LOCALIZATION_OPTIONS.map((option) => option.localizationId);

export const CANONICAL_LOCALIZATION_OPTION_ID_SET = new Set(CANONICAL_LOCALIZATION_OPTION_IDS);
