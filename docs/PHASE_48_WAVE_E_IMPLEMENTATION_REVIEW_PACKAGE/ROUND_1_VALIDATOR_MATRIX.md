# Wave E Round 1 Validator Matrix

| validator | change | proof |
|---|---|---|
| validate-phase48-wave-e-clean.mjs | assert Round 1 accountability triggers (`treatment_courses_accountability_tenant`, `device_treatment_records_accountability_tenant`) | clean DB migrate deploy + trigger count ≥ 5 |
| validate-phase48-wave-e-upgrade.mjs | parks all `_phase48_wave_e_` migrations (base + round1) | park → Wave D deploy → restore → additive upgrade |
| validate-phase48-wave-e-permission-routes.mjs | photo route + pre-post create route in 3 matrices | controller marker + matrix fingerprint parity |
