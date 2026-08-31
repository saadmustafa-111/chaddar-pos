import { api } from '../../auth/api/client';

export type PlaneStockStatus = 'AVAILABLE' | 'CONSUMED' | 'CANCELLED';

export const PlaneStockStatus = {
  AVAILABLE: 'AVAILABLE' as const,
  CONSUMED: 'CONSUMED' as const,
  CANCELLED: 'CANCELLED' as const,
};

export interface PlaneStockRow {
  id: number;
  coilId: number;
  coilCode: string | null;
  purchaseId: number | null;
  purchaseCode: string | null;
  supplierId: number | null;
  supplierName: string | null;
  materialFamilyId: number | null;
  materialFamilyName: string | null;
  brand: string | null;
  color: string | null;
  widthMm: number | null;
  thicknessMm: number | null;
  weightKg: number;
  calculatedFeet: number;
  kgPerFoot: number;
  costPerKgPaisa: number;
  totalValuePaisa: number;
  status: PlaneStockStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlaneStockSummary {
  totalWeightKg: number;
  totalFeet: number;
  totalValuePaisa: number;
  entryCount: number;
}

export interface MoveToPlaneRequest {
  weightKg: number;
  note?: string;
}

export const planeStockApi = {
  findAll: () => api.get<PlaneStockRow[]>('/plane-stock', true),

  findOne: (id: number) =>
    api.get<PlaneStockRow>(`/plane-stock/${id}`, true),

  getSummary: () =>
    api.get<PlaneStockSummary>('/plane-stock/summary', true),

  findByCoil: (coilId: number) =>
    api.get<PlaneStockRow[]>(`/coils/${coilId}/plane-stock`, true),

  moveFromCoil: (coilId: number, data: MoveToPlaneRequest) =>
    api.post<PlaneStockRow>(
      `/coils/${coilId}/plane-stock`,
      data,
      true,
    ),
};

export const planeStockStatusLabels: Record<PlaneStockStatus, string> = {
  AVAILABLE: 'Available',
  CONSUMED: 'Consumed',
  CANCELLED: 'Cancelled',
};