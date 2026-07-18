export class TimeSlotVO {
  constructor(public readonly start: string, public readonly end: string) {
    // Expect ISO 8601 strings for simplicity
    if (!start || !end) throw new Error('Invalid timeslot');
  }

  overlaps(other: TimeSlotVO) {
    return !(this.end <= other.start || this.start >= other.end);
  }
}
