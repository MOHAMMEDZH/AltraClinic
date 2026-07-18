import { ToothStatus } from './tooth-status.enum';

export type ToothSurface = 'mesial' | 'distal' | 'occlusal' | 'buccal' | 'lingual' | 'incisal';

export class ToothVO {
  constructor(
    public readonly toothNumber: number,
    public readonly status: ToothStatus,
    public readonly notes?: string | null,
    public readonly surfaces?: Partial<Record<ToothSurface, string>> | null,
  ) {
    if (toothNumber < 1 || toothNumber > 32) throw new Error('Invalid tooth number');
  }

  toJSON() {
    return {
      toothNumber: this.toothNumber,
      status: this.status,
      notes: this.notes,
      surfaces: this.surfaces ?? {},
    };
  }
}
