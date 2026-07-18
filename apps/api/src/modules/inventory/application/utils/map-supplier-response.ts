function mapSupplier(record: {
  supplierId: string;
  code: string;
  nameEn: string;
  nameAr: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  leadTimeDays: number | null;
  notes: string | null;
  isActive: boolean;
  linkedItemCount: number;
  orderCount: number;
  lastOrderDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    supplierId: record.supplierId,
    code: record.code,
    nameEn: record.nameEn,
    nameAr: record.nameAr,
    contactName: record.contactName,
    email: record.email,
    phone: record.phone,
    address: record.address,
    leadTimeDays: record.leadTimeDays,
    notes: record.notes,
    isActive: record.isActive,
    metrics: {
      linkedItemCount: record.linkedItemCount,
      orderCount: record.orderCount,
      avgLeadTimeDays: record.leadTimeDays,
      lastOrderDate: record.lastOrderDate ? record.lastOrderDate.toISOString() : null,
    },
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export { mapSupplier };
