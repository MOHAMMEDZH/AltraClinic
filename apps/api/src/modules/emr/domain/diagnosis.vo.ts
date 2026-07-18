export class DiagnosisVO {
  constructor(public readonly code: string, public readonly description: string) {
    if (!code) throw new Error('Invalid diagnosis code');
  }
}
