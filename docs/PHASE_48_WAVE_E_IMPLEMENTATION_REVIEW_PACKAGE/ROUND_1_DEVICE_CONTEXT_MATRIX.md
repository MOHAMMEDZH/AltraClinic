# ROUND_1_DEVICE_CONTEXT_MATRIX

| Case | Expected | Evidence |
|------|----------|----------|
| E3-T1 matching type+key | succeed | DEVICE_TYPE_SCHEMA_REGISTRY |
| E3-T2 cross-type key | reject | assertDeviceTypeSchemaKey |
| E3-T3 unknown key | reject | same |
| E3-T4 encounter branch mismatch | reject | device-treatment-record.service |
| E3-T5 encounter patient mismatch | reject | same |
| E3-T6 BeautyAnnotation patient mismatch | reject via BeautyRecord.patientId | assertTenantBeautyAnnotation |
| E3-T7 cross-tenant recordedBy | DB reject | Round 1 accountability trigger + RLS tests |
| E3-T8 cross-tenant correctedBy | DB reject | same trigger |
| E3-T9 deviceId | opaque external VARCHAR(120), no FK | schema + assertOpaqueExternalDeviceId |
| E3-T10 correction incompatible key | reject | correct() re-validates type↔key |
| E3-T11 rollback | in-transaction audit | existing pattern |

Full deep JSON Schema engine: **not required** by frozen Wave E; key↔type binding is production fail-closed.
