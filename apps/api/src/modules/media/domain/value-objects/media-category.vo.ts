export type MediaCategoryType =
  | 'patient_attachment'
  | 'medical_document'
  | 'dental_image'
  | 'beauty_before_after'
  | 'invoice_attachment';

const VALID: MediaCategoryType[] = [
  'patient_attachment',
  'medical_document',
  'dental_image',
  'beauty_before_after',
  'invoice_attachment',
];

const PRISMA_MAP: Record<MediaCategoryType, string> = {
  patient_attachment: 'PATIENT_ATTACHMENT',
  medical_document: 'MEDICAL_DOCUMENT',
  dental_image: 'DENTAL_IMAGE',
  beauty_before_after: 'BEAUTY_BEFORE_AFTER',
  invoice_attachment: 'INVOICE_ATTACHMENT',
};

export class MediaCategoryVO {
  readonly value: MediaCategoryType;

  constructor(value: string) {
    const normalized = value.toLowerCase().trim() as MediaCategoryType;
    if (!VALID.includes(normalized)) {
      throw new Error(`Invalid media category: ${value}`);
    }
    this.value = normalized;
  }

  isImageCategory(): boolean {
    return this.value === 'dental_image' || this.value === 'beauty_before_after';
  }

  requiresPatientLink(): boolean {
    return this.value !== 'medical_document' && this.value !== 'invoice_attachment';
  }

  /** Patient/clinical photo categories require signed PHOTO_CONSENT (AR-10). */
  requiresPhotoConsent(): boolean {
    return (
      this.value === 'dental_image' ||
      this.value === 'beauty_before_after' ||
      this.value === 'patient_attachment'
    );
  }

  toPrisma(): string {
    return PRISMA_MAP[this.value];
  }

  static fromPrisma(value: string): MediaCategoryVO {
    const entry = Object.entries(PRISMA_MAP).find(([, v]) => v === value);
    if (!entry) throw new Error(`Unknown Prisma media category: ${value}`);
    return new MediaCategoryVO(entry[0]);
  }
}
