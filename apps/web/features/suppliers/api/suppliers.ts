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

export const suppliersApi = {
  findAll: () => api.get<Supplier[]>('/suppliers', true),

  findActive: () => api.get<Supplier[]>('/suppliers/active', true),

  findOne: (id: number) => api.get<Supplier>(`/suppliers/${id}`, true),

  create: (data: CreateSupplierRequest) =>
    api.post<Supplier>('/suppliers', data, true),

  update: (id: number, data: UpdateSupplierRequest) =>
    api.post<Supplier>(`/suppliers/${id}`, data, true),
};