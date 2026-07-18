export interface BillingSavedView {
  id: string;
  name: string;
  search: string;
  status: string;
  createdAt: string;
}

const STORAGE_KEY = 'booking.billing.savedViews';
const MAX_VIEWS = 12;

function readAll(): BillingSavedView[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BillingSavedView[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_VIEWS) : [];
  } catch {
    return [];
  }
}

function writeAll(views: BillingSavedView[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(views.slice(0, MAX_VIEWS)));
}

export function listBillingSavedViews(): BillingSavedView[] {
  return readAll();
}

export function saveBillingSavedView(
  view: Omit<BillingSavedView, 'id' | 'createdAt'> & { id?: string },
): BillingSavedView {
  const existing = readAll();
  const next: BillingSavedView = {
    id: view.id ?? crypto.randomUUID(),
    name: view.name.trim(),
    search: view.search.trim(),
    status: view.status,
    createdAt: view.id ? existing.find((v) => v.id === view.id)?.createdAt ?? new Date().toISOString() : new Date().toISOString(),
  };
  writeAll([next, ...existing.filter((v) => v.id !== next.id)]);
  return next;
}

export function deleteBillingSavedView(id: string): void {
  writeAll(readAll().filter((v) => v.id !== id));
}
