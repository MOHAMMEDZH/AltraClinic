export interface UploadMediaCommand {
  category: string;
  ownerType: string;
  ownerId: string;
  patientId?: string | null;
  originalFilename: string;
  mimeType: string;
  buffer: Buffer;
  uploadedBy: string;
  comparisonGroupId?: string | null;
  comparisonRole?: 'before' | 'after' | null;
  clinical?: {
    imagingType?: string | null;
    title?: string | null;
    toothNumbers?: number[];
    encounterId?: string | null;
  } | null;
}
