# ROUND_1_COURSE_INTERVAL_MATRIX

| Case | Expected | Evidence |
|------|----------|----------|
| E2-T1 min boundary | succeed | wave-e-round1 intervals |
| E2-T2 below min | reject | assertCourseSessionInterval |
| E2-T3 max boundary | succeed | wave-e-round1 |
| E2-T4 above max | reject | assertCourseSessionInterval |
| E2-T5 first session | no prior → skip interval | assertCourseSessionInterval early return |
| E2-T6 reschedule invalid | UpdateAppointmentHandler calls assertCourseIntervalsForReschedule | appointment.handlers.ts |
| E2-T7 wrong-tenant package PV | reject | assertPackagePriceVersionForCourse |
| E2-T8 wrong-service package PV | reject | same |
| E2-T9 wrong unit | reject (must be PER_COURSE/PER_PACKAGE) | same |
| E2-T10 non-ACTIVE PV | reject | same |
| E2-T11 failed link unchanged | transactional | wave-e-round1 / aesthetic |

Interval metric: absolute UTC calendar-day difference between prior linked session appointment.scheduledStart and new appointment start.
