# Wave E Round 1 Test Matrix

| test id | suite | assertion | type |
|---|---|---|---|
| E1-T1 | wave-d-pricing-production-path | standalone PER_COURSE resolver reject | postgres integration |
| E1-T2 | wave-d-pricing-production-path | standalone PER_PACKAGE resolver reject | postgres integration |
| E1-T3 | wave-d-pricing-production-path | PER_COURSE with TreatmentCourse + CreateAppointmentHandler | postgres integration |
| E1-T4 | wave-d-pricing-production-path | PER_PACKAGE bound to course.packagePriceVersionId | postgres integration |
| E1-T8 | wave-d-pricing-production-path | no side effects on reject (appointments/invoices/courses) | postgres integration |
| E1-U1 | pricing-unit-applicability.unit | assertCoursePackageBookingContext fail-closed | unit |
| E1-I1 | wave-e-round1 | first session skips interval | postgres integration |
| E1-I2 | wave-e-round1 | below intervalMinDays reject | postgres integration |
| E1-I3 | wave-e-round1 | above intervalMaxDays reject | postgres integration |
| E2-U1 | wave-e-transitions.unit | cross-type deviceType/schema reject | unit |
| E2-I1 | wave-e-round1 | laser+ipl key mismatch | postgres integration |
| E2-I2 | wave-e-round1 | opaque deviceId accepted | postgres integration |
| E2-I3 | wave-e-round1 | encounter branch mismatch | postgres integration |
| E2-I4 | wave-e-round1 | beauty annotation patient mismatch | postgres integration |
| E3-I1 | wave-e-round1 | non-dermatology category reject | postgres integration |
| E3-I2 | wave-e-round1 | derm appointment service mismatch | postgres integration |
| E3-I3 | wave-e-round1 | derm appointment branch mismatch | postgres integration |
| E3-I4 | wave-e-round1 | attachDermatologyPhoto MediaAsset durable | postgres integration |
| E4-I1 | wave-e-round1 | pre-post createInstance + assert round-trip | postgres integration |
| E5-I1 | wave-e-round1 | mixed-tenant createdBy insert reject | postgres integration |
| E5-I2 | wave-e-round1 | mixed-tenant recordedBy insert reject | postgres integration |
| E5-I3 | wave-e-round1 | mixed-tenant correctedBy update reject | postgres integration |
| E5-I4 | wave-e-round1 | parent-switch UPDATE createdBy reject | postgres integration |
| E5-R1 | wave-e-rls | parent-switch UPDATE courseId reject | postgres RLS |
| E5-R2 | wave-e-rls | parent-switch UPDATE appointmentId reject | postgres RLS |
| E5-R3 | wave-e-rls | parent-switch UPDATE patientId reject | postgres RLS |
| E5-R4 | wave-e-rls | parent-switch UPDATE recordedBy reject | postgres RLS |
| E5-R5 | wave-e-rls | parent-switch UPDATE createdBy reject | postgres RLS |
| PP-1 | wave-e-production-path | HTTP POST course durable in DB | postgres HTTP integration |

**Approximate new test counts:** unit +5, postgres integration +22, RLS +5, HTTP production-path +2 → **~34 new tests**.
