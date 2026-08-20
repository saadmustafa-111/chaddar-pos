import { api } from '../../auth/api/client';

export type InventoryStatus = 'RAW' | 'IN_PROCESS' | 'FINISHED' | 'DEPLETED';

export interface MaterialFamilySummary {
  id: number;
  code: string;
  name: string;
}

export interface Coil {
  id: number;
  code: string;
  batchNumber: string | null;
  purchaseId: number;
  supplierId: number;
  supplier: {
    id: number;
    code: string;
    name: string;
  };
  purchase: {
    id: number;
    code: string;
    purchaseDate: string;
  };
  materialFamily: MaterialFamilySummary | null;
  brand: string | null;
  color: string | null;
  width: number;
  thicknessMm: number | null;
  grossWeight: number;
  purchaseWeight: number;
  purchaseRatePaisa: number;
  purchaseAmountPaisa: number;
  currentWeight: number;
  status: InventoryStatus;
  location: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CoilFilters {
  search?: string;
  supplierId?: number;
  status?: InventoryStatus;
  dateFrom?: string;
  dateTo?: string;
}

export interface InventoryMovement {
  id: number;
  coilId: number;
  type: string;
  weightDelta: number;
  weightBalance: number;
  referenceType: string | null;
  referenceId: number | null;
  referenceCode: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
}

export const coilsApi = {
  findAll: (filters?: CoilFilters) => {
    const params = new URLSearchParams();
    if (filters?.search) params.set('search', filters.search);
    if (filters?.supplierId) params.set('supplierId', String(filters.supplierId));
    if (filters?.status) params.set('status', filters.status);
    if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params.set('dateTo', filters.dateTo);
    const query = params.toString();
    return api.get<Coil[]>(`/coils${query ? `?${query}` : ''}`, true);
  },

  findOne: (id: number) => api.get<Coil>(`/coils/${id}`, true),

  getMovements: (id: number) =>
    api.get<InventoryMovement[]>(`/coils/${id}/movements`, true),
};