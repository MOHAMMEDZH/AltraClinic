# ROUND_1_DERMATOLOGY_E2E_MATRIX

| Case | Expected | Evidence |
|------|----------|----------|
| E4-T1 categoryKey dermatology | succeed | assertDermatologyServiceEligibility |
| E4-T2 non-derm category | reject | wave-e-round1 |
| E4-T3 appointment service mismatch | reject | dermatology-encounter.service |
| E4-T4 appointment branch mismatch | reject | same |
| E4-T5 appointment patient mismatch | reject | same |
| E4-T6 Encounter+service+photo E2E | MediaAsset ownerType=encounter | attachDermatologyPhoto + round1/production-path |
| E4-T7 cross-tenant media | reject | MediaAsset tenant scoped |
| E4-T8 no DermatologyRecord | to_regclass / model assert | validators + tests |
