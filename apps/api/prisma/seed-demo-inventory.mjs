/**
 * Demo supplier, purchase orders, and stock requests for inventory E2E flows.
 */
export const DEMO_SUPPLIER_ID = 'a7010000-0000-4000-8000-000000000001';
export const DEMO_PO_PENDING_ID = 'a3010000-0000-4000-8000-000000000001';
export const DEMO_PO_PENDING_LINE_ID = 'a3010000-0000-4000-8000-000000000011';
export const DEMO_PO_APPROVED_ID = 'a3010000-0000-4000-8000-000000000002';
export const DEMO_PO_APPROVED_LINE_ID = 'a3010000-0000-4000-8000-000000000012';
export const DEMO_STOCK_REQUEST_ID = 'a4010000-0000-4000-8000-000000000001';
export const DEMO_STOCK_REQUEST_LINE_ID = 'a4010000-0000-4000-8000-000000000011';
export const DEMO_STOCK_REQUEST_APPROVED_ID = 'a4010000-0000-4000-8000-000000000002';
export const DEMO_STOCK_REQUEST_APPROVED_LINE_ID = 'a4010000-0000-4000-8000-000000000012';

export const DEMO_PO_PENDING_NUMBER = 'PO-DEMO-001';
export const DEMO_PO_APPROVED_NUMBER = 'PO-DEMO-002';
export const DEMO_STOCK_REQUEST_NUMBER = 'SR-DEMO-001';
export const DEMO_STOCK_REQUEST_APPROVED_NUMBER = 'SR-DEMO-002';

export const DEMO_WAREHOUSE_MAIN_ID = 'a5010000-0000-4000-8000-000000000001';
export const DEMO_WAREHOUSE_PROC_ID = 'a5010000-0000-4000-8000-000000000002';
export const DEMO_TRANSFER_ID = 'a6010000-0000-4000-8000-000000000001';
export const DEMO_TRANSFER_LINE_ID = 'a6010000-0000-4000-8000-000000000011';
export const DEMO_STOCK_COUNT_ID = 'c1000000-0000-4000-8000-000000000001';
export const DEMO_STOCK_COUNT_LINE_ID = 'c1000000-0000-4000-8000-000000000011';
export const DEMO_BATCH_EXPIRING_ID = 'b1000000-0000-4000-8000-000000000001';

export const DEMO_TRANSFER_NUMBER = 'TR-DEMO-001';
export const DEMO_STOCK_COUNT_NUMBER = 'CNT-DEMO-001';
export const DEMO_WAREHOUSE_MAIN_CODE = 'MAIN';
export const DEMO_WAREHOUSE_PROC_CODE = 'PROC';
export const DEMO_BATCH_LOT = 'LOT-MASK-2026';

export async function seedDemoInventoryProcurement(
  prisma,
  {
    tenantId,
    ownerId,
    inventoryManagerId,
    doctorId,
    gloveItemId,
    syringeItemId,
    maskItemId,
  },
) {
  await prisma.inventorySupplier.upsert({
    where: { id: DEMO_SUPPLIER_ID },
    create: {
      id: DEMO_SUPPLIER_ID,
      tenantId,
      code: 'MEDSUP',
      nameEn: 'MedSupply Co.',
      nameAr: 'شركة MedSupply',
      contactName: 'Layla Ahmad',
      email: 'orders@medsupply.example',
      phone: '+963944000111',
      leadTimeDays: 5,
      isActive: true,
    },
    update: {
      code: 'MEDSUP',
      nameEn: 'MedSupply Co.',
      nameAr: 'شركة MedSupply',
      contactName: 'Layla Ahmad',
      email: 'orders@medsupply.example',
      phone: '+963944000111',
      leadTimeDays: 5,
      isActive: true,
      deletedAt: null,
    },
  });

  await prisma.inventoryItem.updateMany({
    where: { id: { in: [gloveItemId, maskItemId] }, tenantId },
    data: { supplierId: DEMO_SUPPLIER_ID },
  });

  await prisma.purchaseOrder.upsert({
    where: { id: DEMO_PO_PENDING_ID },
    create: {
      id: DEMO_PO_PENDING_ID,
      tenantId,
      poNumber: DEMO_PO_PENDING_NUMBER,
      supplierId: DEMO_SUPPLIER_ID,
      status: 'PENDING_APPROVAL',
      notes: 'Restock low masks and gloves — demo PO awaiting approval.',
      requestedBy: inventoryManagerId,
    },
    update: {
      poNumber: DEMO_PO_PENDING_NUMBER,
      supplierId: DEMO_SUPPLIER_ID,
      status: 'PENDING_APPROVAL',
      notes: 'Restock low masks and gloves — demo PO awaiting approval.',
      requestedBy: inventoryManagerId,
      approvedBy: null,
      approvedAt: null,
    },
  });

  await prisma.purchaseOrderLine.upsert({
    where: { id: DEMO_PO_PENDING_LINE_ID },
    create: {
      id: DEMO_PO_PENDING_LINE_ID,
      tenantId,
      purchaseOrderId: DEMO_PO_PENDING_ID,
      inventoryItemId: maskItemId,
      quantityOrdered: 40,
      quantityReceived: 0,
      unitCost: 18.5,
      sortOrder: 0,
    },
    update: {
      purchaseOrderId: DEMO_PO_PENDING_ID,
      inventoryItemId: maskItemId,
      quantityOrdered: 40,
      quantityReceived: 0,
      unitCost: 18.5,
      sortOrder: 0,
    },
  });

  await prisma.purchaseOrder.upsert({
    where: { id: DEMO_PO_APPROVED_ID },
    create: {
      id: DEMO_PO_APPROVED_ID,
      tenantId,
      poNumber: DEMO_PO_APPROVED_NUMBER,
      supplierId: DEMO_SUPPLIER_ID,
      status: 'APPROVED',
      notes: 'Syringe replenishment — approved and ready to receive.',
      requestedBy: inventoryManagerId,
      approvedBy: ownerId,
      approvedAt: new Date(),
    },
    update: {
      poNumber: DEMO_PO_APPROVED_NUMBER,
      supplierId: DEMO_SUPPLIER_ID,
      status: 'APPROVED',
      notes: 'Syringe replenishment — approved and ready to receive.',
      requestedBy: inventoryManagerId,
      approvedBy: ownerId,
      approvedAt: new Date(),
    },
  });

  await prisma.purchaseOrderLine.upsert({
    where: { id: DEMO_PO_APPROVED_LINE_ID },
    create: {
      id: DEMO_PO_APPROVED_LINE_ID,
      tenantId,
      purchaseOrderId: DEMO_PO_APPROVED_ID,
      inventoryItemId: syringeItemId,
      quantityOrdered: 200,
      quantityReceived: 0,
      unitCost: 0.35,
      sortOrder: 0,
    },
    update: {
      purchaseOrderId: DEMO_PO_APPROVED_ID,
      inventoryItemId: syringeItemId,
      quantityOrdered: 200,
      quantityReceived: 0,
      unitCost: 0.35,
      sortOrder: 0,
    },
  });

  await prisma.inventoryStockRequest.upsert({
    where: { id: DEMO_STOCK_REQUEST_ID },
    create: {
      id: DEMO_STOCK_REQUEST_ID,
      tenantId,
      requestNumber: DEMO_STOCK_REQUEST_NUMBER,
      requestType: 'DEPARTMENT',
      status: 'SUBMITTED',
      departmentName: 'Procedure Room',
      notes: 'Weekly glove restock for treatment bays.',
      requestedBy: ownerId,
    },
    update: {
      requestNumber: DEMO_STOCK_REQUEST_NUMBER,
      requestType: 'DEPARTMENT',
      status: 'SUBMITTED',
      departmentName: 'Procedure Room',
      notes: 'Weekly glove restock for treatment bays.',
      requestedBy: ownerId,
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      fulfilledBy: null,
      fulfilledAt: null,
    },
  });

  await prisma.inventoryStockRequestLine.upsert({
    where: { id: DEMO_STOCK_REQUEST_LINE_ID },
    create: {
      id: DEMO_STOCK_REQUEST_LINE_ID,
      tenantId,
      stockRequestId: DEMO_STOCK_REQUEST_ID,
      inventoryItemId: gloveItemId,
      quantityRequested: 6,
      quantityFulfilled: 0,
      sortOrder: 0,
    },
    update: {
      stockRequestId: DEMO_STOCK_REQUEST_ID,
      inventoryItemId: gloveItemId,
      quantityRequested: 6,
      quantityFulfilled: 0,
      sortOrder: 0,
    },
  });

  await prisma.inventoryStockRequest.upsert({
    where: { id: DEMO_STOCK_REQUEST_APPROVED_ID },
    create: {
      id: DEMO_STOCK_REQUEST_APPROVED_ID,
      tenantId,
      requestNumber: DEMO_STOCK_REQUEST_APPROVED_NUMBER,
      requestType: 'CLINICAL',
      status: 'APPROVED',
      departmentName: 'Treatment Room 2',
      notes: 'Masks for isolation procedures — approved, awaiting issue.',
      requestedBy: doctorId,
      approvedBy: inventoryManagerId,
      approvedAt: new Date(),
    },
    update: {
      requestNumber: DEMO_STOCK_REQUEST_APPROVED_NUMBER,
      requestType: 'CLINICAL',
      status: 'APPROVED',
      departmentName: 'Treatment Room 2',
      notes: 'Masks for isolation procedures — approved, awaiting issue.',
      requestedBy: doctorId,
      approvedBy: inventoryManagerId,
      approvedAt: new Date(),
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      fulfilledBy: null,
      fulfilledAt: null,
    },
  });

  await prisma.inventoryStockRequestLine.upsert({
    where: { id: DEMO_STOCK_REQUEST_APPROVED_LINE_ID },
    create: {
      id: DEMO_STOCK_REQUEST_APPROVED_LINE_ID,
      tenantId,
      stockRequestId: DEMO_STOCK_REQUEST_APPROVED_ID,
      inventoryItemId: maskItemId,
      quantityRequested: 3,
      quantityFulfilled: 0,
      sortOrder: 0,
    },
    update: {
      stockRequestId: DEMO_STOCK_REQUEST_APPROVED_ID,
      inventoryItemId: maskItemId,
      quantityRequested: 3,
      quantityFulfilled: 0,
      sortOrder: 0,
    },
  });
}

export async function seedDemoInventoryOperations(
  prisma,
  {
    tenantId,
    branchId,
    inventoryManagerId,
    gloveItemId,
    syringeItemId,
    maskItemId,
  },
) {
  await prisma.inventoryWarehouse.upsert({
    where: { id: DEMO_WAREHOUSE_MAIN_ID },
    create: {
      id: DEMO_WAREHOUSE_MAIN_ID,
      tenantId,
      branchId,
      code: DEMO_WAREHOUSE_MAIN_CODE,
      nameEn: 'Main store',
      nameAr: 'المخزن الرئيسي',
      isDefault: true,
      isActive: true,
    },
    update: {
      code: DEMO_WAREHOUSE_MAIN_CODE,
      nameEn: 'Main store',
      nameAr: 'المخزن الرئيسي',
      isDefault: true,
      isActive: true,
      deletedAt: null,
    },
  });

  await prisma.inventoryWarehouse.upsert({
    where: { id: DEMO_WAREHOUSE_PROC_ID },
    create: {
      id: DEMO_WAREHOUSE_PROC_ID,
      tenantId,
      branchId,
      code: DEMO_WAREHOUSE_PROC_CODE,
      nameEn: 'Procedure room',
      nameAr: 'غرفة الإجراءات',
      isDefault: false,
      isActive: true,
    },
    update: {
      code: DEMO_WAREHOUSE_PROC_CODE,
      nameEn: 'Procedure room',
      nameAr: 'غرفة الإجراءات',
      isDefault: false,
      isActive: true,
      deletedAt: null,
    },
  });

  const warehouseStock = [
    { warehouseId: DEMO_WAREHOUSE_MAIN_ID, itemId: gloveItemId, qty: 14 },
    { warehouseId: DEMO_WAREHOUSE_MAIN_ID, itemId: syringeItemId, qty: 150 },
    { warehouseId: DEMO_WAREHOUSE_MAIN_ID, itemId: maskItemId, qty: 5 },
    { warehouseId: DEMO_WAREHOUSE_PROC_ID, itemId: gloveItemId, qty: 0 },
  ];

  for (const row of warehouseStock) {
    await prisma.inventoryWarehouseStock.upsert({
      where: {
        tenantId_warehouseId_inventoryItemId: {
          tenantId,
          warehouseId: row.warehouseId,
          inventoryItemId: row.itemId,
        },
      },
      create: {
        tenantId,
        warehouseId: row.warehouseId,
        inventoryItemId: row.itemId,
        quantityOnHand: row.qty,
      },
      update: { quantityOnHand: row.qty },
    });
  }

  const shippedAt = new Date();
  await prisma.inventoryStockTransfer.upsert({
    where: { id: DEMO_TRANSFER_ID },
    create: {
      id: DEMO_TRANSFER_ID,
      tenantId,
      transferNumber: DEMO_TRANSFER_NUMBER,
      fromWarehouseId: DEMO_WAREHOUSE_MAIN_ID,
      toWarehouseId: DEMO_WAREHOUSE_PROC_ID,
      status: 'IN_TRANSIT',
      notes: 'Gloves for procedure room — in transit demo transfer.',
      requestedBy: inventoryManagerId,
      shippedAt,
    },
    update: {
      transferNumber: DEMO_TRANSFER_NUMBER,
      fromWarehouseId: DEMO_WAREHOUSE_MAIN_ID,
      toWarehouseId: DEMO_WAREHOUSE_PROC_ID,
      status: 'IN_TRANSIT',
      notes: 'Gloves for procedure room — in transit demo transfer.',
      requestedBy: inventoryManagerId,
      shippedAt,
      receivedAt: null,
    },
  });

  await prisma.inventoryStockTransferLine.upsert({
    where: { id: DEMO_TRANSFER_LINE_ID },
    create: {
      id: DEMO_TRANSFER_LINE_ID,
      tenantId,
      stockTransferId: DEMO_TRANSFER_ID,
      inventoryItemId: gloveItemId,
      quantity: 10,
      quantityReceived: 0,
      sortOrder: 0,
    },
    update: {
      stockTransferId: DEMO_TRANSFER_ID,
      inventoryItemId: gloveItemId,
      quantity: 10,
      quantityReceived: 0,
      sortOrder: 0,
    },
  });

  const startedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const completedAt = new Date(Date.now() - 30 * 60 * 1000);
  await prisma.inventoryStockCount.upsert({
    where: { id: DEMO_STOCK_COUNT_ID },
    create: {
      id: DEMO_STOCK_COUNT_ID,
      tenantId,
      countNumber: DEMO_STOCK_COUNT_NUMBER,
      warehouseId: DEMO_WAREHOUSE_MAIN_ID,
      status: 'PENDING_APPROVAL',
      notes: 'Monthly cycle count — gloves variance pending approval.',
      requestedBy: inventoryManagerId,
      startedAt,
      completedAt,
    },
    update: {
      countNumber: DEMO_STOCK_COUNT_NUMBER,
      warehouseId: DEMO_WAREHOUSE_MAIN_ID,
      status: 'PENDING_APPROVAL',
      notes: 'Monthly cycle count — gloves variance pending approval.',
      requestedBy: inventoryManagerId,
      approvedBy: null,
      approvedAt: null,
      startedAt,
      completedAt,
    },
  });

  await prisma.inventoryStockCountLine.upsert({
    where: { id: DEMO_STOCK_COUNT_LINE_ID },
    create: {
      id: DEMO_STOCK_COUNT_LINE_ID,
      tenantId,
      stockCountId: DEMO_STOCK_COUNT_ID,
      inventoryItemId: gloveItemId,
      systemQuantity: 24,
      countedQuantity: 22,
      sortOrder: 0,
    },
    update: {
      stockCountId: DEMO_STOCK_COUNT_ID,
      inventoryItemId: gloveItemId,
      systemQuantity: 24,
      countedQuantity: 22,
      sortOrder: 0,
    },
  });

  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 14);
  expiryDate.setHours(0, 0, 0, 0);

  await prisma.inventoryBatch.upsert({
    where: { id: DEMO_BATCH_EXPIRING_ID },
    create: {
      id: DEMO_BATCH_EXPIRING_ID,
      tenantId,
      inventoryItemId: maskItemId,
      lotNumber: DEMO_BATCH_LOT,
      expiryDate,
      quantityOnHand: 3,
      status: 'ACTIVE',
    },
    update: {
      inventoryItemId: maskItemId,
      lotNumber: DEMO_BATCH_LOT,
      expiryDate,
      quantityOnHand: 3,
      status: 'ACTIVE',
    },
  });
}
