import { ToothVO } from './tooth.vo';
import { DentalProcedure } from './dental-procedure.entity';
import { ToothStatus } from './tooth-status.enum';

export class DentalChart {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly patientId: string,
    public teeth: ToothVO[] = [],
    public procedures: DentalProcedure[] = [],
    public readonly createdAt: string = new Date().toISOString(),
    public updatedAt: string = new Date().toISOString(),
    public odontogramMode: 'adult' | 'pediatric' = 'adult',
  ) {}

  applyProcedure(proc: DentalProcedure) {
    this.procedures.push(proc);
    for (const num of proc.toothNumbers) {
      const idx = this.teeth.findIndex((t) => this.toothNum(t) === num);
      if (idx >= 0) {
        const current = this.teeth[idx];
        const status = this.inferStatusFromProcedure(proc.code);
        this.teeth[idx] = new ToothVO(num, status, current instanceof ToothVO ? current.notes : null);
      }
    }
    this.updatedAt = new Date().toISOString();
  }

  updateTooth(toothNumber: number, status: ToothStatus, notes?: string | null) {
    const idx = this.teeth.findIndex((t) => this.toothNum(t) === toothNumber);
    if (idx >= 0) {
      this.teeth[idx] = new ToothVO(toothNumber, status, notes ?? null);
      this.updatedAt = new Date().toISOString();
    }
  }

  private toothNum(t: ToothVO | { toothNumber: number }): number {
    return t instanceof ToothVO ? t.toothNumber : t.toothNumber;
  }

  private inferStatusFromProcedure(code: string): ToothStatus {
    const c = code.toLowerCase();
    if (c.includes('extract')) return ToothStatus.Extraction;
    if (c.includes('crown')) return ToothStatus.Crown;
    if (c.includes('implant')) return ToothStatus.Implant;
    if (c.includes('rct') || c.includes('root')) return ToothStatus.RootCanal;
    if (c.includes('fill')) return ToothStatus.Filled;
    if (c.includes('caries') || c.includes('decay')) return ToothStatus.Decayed;
    return ToothStatus.Filled;
  }

  toJSON() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      patientId: this.patientId,
      teeth: this.teeth.map((t) => t.toJSON()),
      procedures: this.procedures,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      odontogramMode: this.odontogramMode,
    };
  }
}
