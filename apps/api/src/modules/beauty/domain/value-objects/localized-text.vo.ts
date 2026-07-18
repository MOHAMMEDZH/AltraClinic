export class LocalizedText {
  constructor(public readonly en: string | null, public readonly ar: string | null) {}

  toJSON() {
    return { en: this.en, ar: this.ar };
  }
}
