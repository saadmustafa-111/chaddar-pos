import { api } from '../../auth/api/client';

export interface Customer {
  id: number;
  code: string;
  name: string;
  phone: string | null;
  address: string | null;
  note: string | null;
  currentBalancePaisa: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type LedgerEntryType = 'SALE_DUE' | 'PAYMENT' | 'ADJUSTMENT';

export interface CustomerLedgerEntry {
  id: number;
  customerId: number;
  saleId: number | null;
  entryType: LedgerEntryType;
  amountPaisa: number;
  balanceAfterPaisa: number;
  entryDate: string;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface CustomerTotals {
  totalSalesPaisa: number;
  totalPaidPaisa: number;
  outstandingPaisa: number;
}

export interface CreateCustomerRequest {
  name: string;
  phone?: string;
  address?: string;
  note?: string;
  code?: string;
}

export interface UpdateCustomerRequest {
  name?: string;
  phone?: string;
  address?: string;
  note?: string;
  isActive?: boolean;
}

export interface RecordPaymentRequest {
  amountPaisa: number;
  paymentDate?: string;
  note?: string;
}

export const customersApi = {
  findAll: (search?: string) => {
    const query = search && search.trim().length > 0
      ? `?search=${encodeURIComponent(search.trim())}`
      : '';
    return api.get<Customer[]>(`/customers${query}`, true);
  },
  findAllActive: () => api.get<Customer[]>('/customers/active', true),
  findOne: (id: number) => api.get<Customer>(`/customers/${id}`, true),
  getLedger: (id: number) =>
    api.get<CustomerLedgerEntry[]>(`/customers/${id}/ledger`, true),
  getTotals: (id: number) =>
    api.get<CustomerTotals>(`/customers/${id}/totals`, true),
  create: (data: CreateCustomerRequest) =>
    api.post<Customer>('/customers', data, true),
  update: (id: number, data: UpdateCustomerRequest) =>
    api.patch<Customer>(`/customers/${id}`, data, true),
  recordPayment: (id: number, data: RecordPaymentRequest) =>
    api.post<CustomerLedgerEntry>(`/customers/${id}/payments`, data, true),

  remove: (id: number) => api.delete<void>(`/customers/${id}`, true),
};

export const ledgerEntryTypeLabels: Record<LedgerEntryType, string> = {
  SALE_DUE: 'Sale Due',
  PAYMENT: 'Payment',
  ADJUSTMENT: 'Adjustment',
};
