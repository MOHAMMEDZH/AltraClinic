export interface ConsumeInventoryCommand {
  itemId: string;
  quantity: number;
  sourceDocumentId?: string | null;
}
