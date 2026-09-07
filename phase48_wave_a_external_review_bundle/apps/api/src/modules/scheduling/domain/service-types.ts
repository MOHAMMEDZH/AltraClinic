export const SCHEDULING_SERVICE_TYPES = [
  { id: 'consultation', defaultDurationMin: 30 },
  { id: 'follow_up', defaultDurationMin: 20 },
  { id: 'procedure', defaultDurationMin: 60 },
  { id: 'cleaning', defaultDurationMin: 45 },
  { id: 'imaging', defaultDurationMin: 30 },
  { id: 'lab', defaultDurationMin: 15 },
  { id: 'emergency', defaultDurationMin: 30 },
] as const;

export type SchedulingServiceTypeId = (typeof SCHEDULING_SERVICE_TYPES)[number]['id'];
