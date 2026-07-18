export type RecurrenceFrequency = 'weekly' | 'biweekly' | 'monthly';

export function advanceRecurrenceDate(date: Date, frequency: RecurrenceFrequency): Date {
  const next = new Date(date);
  if (frequency === 'weekly') {
    next.setDate(next.getDate() + 7);
  } else if (frequency === 'biweekly') {
    next.setDate(next.getDate() + 14);
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}
