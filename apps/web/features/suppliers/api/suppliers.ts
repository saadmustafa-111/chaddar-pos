import { api } from '../../auth/api/client';

export interface Supplier {
  id: number;
  code: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxNumber: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplierRequest {
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxNumber?: string;
  notes?: string;
  isActive?: boolean;
}

export type UpdateSupplierRequest = Partial<CreateSupplierRequest>;

export type SupplierLedgerEntryType =
  | 'PURCHASE_DUE'
  | 'PAYMENT'
  | 'ADJUSTMENT';

export interface SupplierLedgerEntry {
  id: number;
  supplierId: number;
  purchaseId: number | null;
  entryType: SupplierLedgerEntryType;
  amountPaisa: number;
  balanceAfterPaisa: number;
  entryDate: string;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface SupplierTotals {
  totalPurchasePaisa: number;
  totalPaidPaisa: number;
  outstandingPaisa: number;
}

export interface SupplierWithTotals {
  supplier: Supplier;
  totals: SupplierTotals;
}

export interface RecordSupplierPaymentRequest {
  amountPaisa: number;
  paymentDate?: string;
  note?: string;
  purchaseId?: number;
}

export const suppliersApi = {
  findAll: () => api.get<Supplier[]>('/suppliers', true),

  findAllWithTotals: () =>
    api.get<SupplierWithTotals[]>('/suppliers/with-totals', true),

  findActive: () => api.get<Supplier[]>('/suppliers/active', true),

  findOne: (id: number) => api.get<Supplier>(`/suppliers/${id}`, true),

  getLedger: (id: number) =>
    api.get<SupplierLedgerEntry[]>(
      `/suppliers/${id}/ledger`,
      true,
    ),

  getTotals: (id: number) =>
    api.get<SupplierTotals>(`/suppliers/${id}/totals`, true),

  recordPayment: (id: number, data: RecordSupplierPaymentRequest) =>
    api.post<SupplierLedgerEntry>(
      `/suppliers/${id}/payments`,
      data,
      true,
    ),

  create: (data: CreateSupplierRequest) =>
    api.post<Supplier>('/suppliers', data, true),

  update: (id: number, data: UpdateSupplierRequest) =>
    api.patch<Supplier>(`/suppliers/${id}`, data, true),

  remove: (id: number) => api.delete<void>(`/suppliers/${id}`, true),
};

export const supplierLedgerEntryTypeLabels: Record<
  SupplierLedgerEntryType,
  string
> = {
  PURCHASE_DUE: 'Purchase Due',
  PAYMENT: 'Payment',
  ADJUSTMENT: 'Adjustment',
};