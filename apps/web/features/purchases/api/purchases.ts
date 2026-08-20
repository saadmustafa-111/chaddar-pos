import { api } from '../../auth/api/client';
import { Supplier } from '../../suppliers/api/suppliers';
import { Coil } from '../../coils/api/coils';

export interface Purchase {
  id: number;
  code: string;
  supplierId: number;
  supplier: Supplier;
  supplierInvoiceNumber: string | null;
  purchaseDate: string;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  coils: Coil[];
}

export interface CreateCoilRequest {
  materialFamilyId?: number;
  brand?: string;
  color?: string;
  batchNumber?: string;
  width: number;
  thicknessMm?: number;
  grossWeight?: number;
  purchaseWeight: number;
  purchaseRatePaisa: number;
  location?: string;
  notes?: string;
}

export interface CreatePurchaseRequest {
  supplierId: number;
  supplierInvoiceNumber?: string;
  purchaseDate: string;
  notes?: string;
  coils: CreateCoilRequest[];
}

export const purchasesApi = {
  findAll: () => api.get<Purchase[]>('/purchases', true),

  findOne: (id: number) => api.get<Purchase>(`/purchases/${id}`, true),

  create: (data: CreatePurchaseRequest) =>
    api.post<Purchase>('/purchases', data, true),
};