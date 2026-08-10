from pathlib import Path
p = Path(r"C:\Users\mrame\Projects\Booking System\apps\api\src\modules\tenant-provisioning\tests\tenant-provisioning-pending-legacy.postgres.integration.spec.ts")
text = p.read_text(encoding="utf-8")
needle = "where: { status: 'ACTIVE', id: progress.tenantId ?? undefined },"
if needle not in text:
    raise SystemExit("needle not found")
text = text.replace(
    needle,
    "where: { status: 'ACTIVE', features: { path: ['provisioningRequestId'], equals: progress.id } },",
)
p.write_text(text, encoding="utf-8")
print("patched")
