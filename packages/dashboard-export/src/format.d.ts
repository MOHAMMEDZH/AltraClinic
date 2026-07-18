export declare function formatExportCurrency(amount: number, locale: string, currency?: string): string;
/** Latin digits + ASCII currency code — avoids bidi/tofu issues in PDF. */
export declare function formatExportCurrencyForPdf(amount: number, locale: string, currency?: string): string;
export declare function formatExportNumber(value: number, locale: string): string;
export declare function formatExportNumberForPdf(value: number, locale: string): string;
export declare function formatExportPercent(value: number, locale: string): string;
export declare function formatExportPercentForPdf(value: number, locale: string): string;
export declare function formatExportDate(isoDate: string, locale: string): string;
export declare function formatExportDateForPdf(isoDate: string, locale: string): string;
export declare function formatExportDateTime(iso: string, locale: string): string;
export declare function formatExportDateTimeForPdf(iso: string, locale: string): string;
export declare function pickLocalizedExportName(locale: string, en: string | null | undefined, ar: string | null | undefined): string;
export declare function formatExportPersonName(locale: string, firstName: string, lastName: string, firstNameAr: string | null, lastNameAr: string | null): string;
export declare function isRtlLocale(locale: string): boolean;
