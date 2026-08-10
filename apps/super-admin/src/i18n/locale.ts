/**
 * Super Admin's own locale-preference storage key. This is intentionally
 * distinct from `@booking/i18n`'s default `'booking.locale'` key (used by
 * clinic-dashboard) so that Super Admin's locale preference is fully
 * isolated: it never reads, writes, or migrates from the shared clinic key.
 */
export const SUPER_ADMIN_LOCALE_STORAGE_KEY = 'booking.super-admin.locale';
