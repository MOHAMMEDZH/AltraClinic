export class LocalizedTextVO {
  public readonly en: string | null;
  public readonly ar: string | null;

  constructor(en: string | null, ar: string | null) {
    const normalizedEn = en?.trim() ?? null;
    const normalizedAr = ar?.trim() ?? null;

    if (!normalizedEn && !normalizedAr) {
      throw new Error('Localized text is required');
    }

    this.en = normalizedEn;
    this.ar = normalizedAr;
  }

  getPreferred(locale?: string | null): string {
    const wantsArabic = locale?.toLowerCase().startsWith('ar');
    if (wantsArabic && this.ar) return this.ar;
    if (this.en) return this.en;
    return this.ar ?? '';
  }
}
