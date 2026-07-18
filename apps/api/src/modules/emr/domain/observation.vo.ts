export class ObservationVO {
  constructor(public readonly type: string, public readonly value: string, public readonly unit?: string) {
    if (!type) throw new Error('Invalid observation');
  }
}
