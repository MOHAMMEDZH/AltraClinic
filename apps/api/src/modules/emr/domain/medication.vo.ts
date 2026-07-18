export class MedicationVO {
  constructor(
    public readonly name: string,
    public readonly dose: string | null = null,
    public readonly route: string | null = null,
    public readonly frequency: string | null = null
  ) {
    if (!name) throw new Error('Invalid medication');
  }
}
