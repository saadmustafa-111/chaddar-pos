import { api } from '../../auth/api/client';

export type FinishedStockStatus =
  | 'AVAILABLE'
  | 'PARTIALLY_SOLD'
  | 'SOLD_OUT'
  | 'CANCELLED';

export const FinishedStockStatus = {
  AVAILABLE: 'AVAILABLE',
  PARTIALLY_SOLD: 'PARTIALLY_SOLD',
  SOLD_OUT: 'SOLD_OUT',
  CANCELLED: 'CANCELLED',
} as const;

export const finishedStockStatusLabels: Record<FinishedStockStatus, string> = {
  AVAILABLE: 'Available',
  PARTIALLY_SOLD: 'Partially Sold',
  SOLD_OUT: 'Sold Out',
  CANCELLED: 'Cancelled',
};

export const finishedStockStatusColors: Record<
  FinishedStockStatus,
  'green' | 'yellow' | 'zinc' | 'red'
> = {
  AVAILABLE: 'green',
  PARTIALLY_SOLD: 'yellow',
  SOLD_OUT: 'zinc',
  CANCELLED: 'red',
};

export type CoilStatus = 'RAW' | 'IN_PROCESS' | 'FINISHED' | 'DEPLETED';

export const CoilStatus = {
  RAW: 'RAW',
  IN_PROCESS: 'IN_PROCESS',
  FINISHED: 'FINISHED',
  DEPLETED: 'DEPLETED',
} as const;

export const coilStatusLabels: Record<CoilStatus, string> = {
  RAW: 'Raw',
  IN_PROCESS: 'In Process',
  FINISHED: 'Finished',
  DEPLETED: 'Depleted',
};

export const coilStatusColors: Record<
  CoilStatus,
  'blue' | 'yellow' | 'green' | 'zinc'
> = {
  RAW: 'blue',
  IN_PROCESS: 'yellow',
  FINISHED: 'green',
  DEPLETED: 'zinc',
};

export interface InventorySummary {
  rawCoils: {
    totalCoils: number;
    activeCoils: number;
    depletedCoils: number;
    totalCurrentWeightKg: number;
    totalWastageWeightKg: number;
    totalPurchaseAmountPaisa: number;
    totalRemainingCostValuePaisa: number;
  };
  finishedChaddar: {
    totalStockRows: number;
    sellableRows: number;
    partialRows: number;
    soldOutRows: number;
    totalRemainingPieces: number;
    totalRemainingWeightKg: number;
    totalFinishedCostValuePaisa: number;
  };
}

export interface FinishedStockRow {
  id: number;
  code: string;
  sizeLabel: string;
  thicknessMm: number | null;
  color: string | null;
  brand: string | null;
  sourceCoilId: number;
  sourceCoilCode: string | null;
  cuttingBatchId: number;
  remainingPieces: number;
  remainingWeightKg: number;
  totalWeightKg: number;
  weightPerPieceKg: number | null;
  finishedCostPerKgPaisa: number;
  totalProductionCostPaisa: number;
  remainingCostValuePaisa: number;
  status: FinishedStockStatus;
  productionDate: string;
  priceCategoryId: number | null;
  priceCategoryName: string | null;
  priceCategoryCode: string | null;
}

export interface FinishedStockFacets {
  sizeLabels: string[];
  thicknessMm: number[];
}

export interface RawCoilRow {
  id: number;
  code: string;
  batchNumber: string | null;
  supplierId: number;
  supplierName: string | null;
  priceCategoryId: number | null;
  priceCategoryName: string | null;
  brand: string | null;
  color: string | null;
  width: number;
  thicknessMm: number | null;
  purchaseWeight: number;
  currentWeight: number;
  wastageWeight: number;
  purchaseRatePaisa: number;
  purchaseAmountPaisa: number;
  status: CoilStatus;
  processingStatus: string;
  createdAt: string;
}

export interface FinishedStockFilters {
  search?: string;
  categoryId?: number;
  sizeLabel?: string;
  thicknessMm?: number | '';
  status?: FinishedStockStatus | '';
  includeSoldOut?: boolean;
}

export interface RawCoilFilters {
  search?: string;
  supplierId?: number | '';
  status?: CoilStatus | '';
  categoryId?: number | '';
}

function buildFinishedQuery(
  filters: FinishedStockFilters,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (filters.search) out.search = filters.search;
  if (filters.categoryId) out.categoryId = String(filters.categoryId);
  if (filters.sizeLabel) out.sizeLabel = filters.sizeLabel;
  if (filters.thicknessMm !== '' && filters.thicknessMm != null) {
    out.thicknessMm = String(filters.thicknessMm);
  }
  if (filters.status) out.status = filters.status;
  if (filters.includeSoldOut) out.includeSoldOut = 'true';
  return out;
}

function buildRawQuery(filters: RawCoilFilters): Record<string, string> {
  const out: Record<string, string> = {};
  if (filters.search) out.search = filters.search;
  if (filters.supplierId) out.supplierId = String(filters.supplierId);
  if (filters.status) out.status = filters.status;
  if (filters.categoryId) out.categoryId = String(filters.categoryId);
  return out;
}

export const inventoryApi = {
  summary: () => api.get<InventorySummary>('/inventory/summary', true),

  finishedStock: (filters: FinishedStockFilters = {}) =>
    api.get<FinishedStockRow[]>(
      `/inventory/finished-stock?${new URLSearchParams(
        buildFinishedQuery(filters),
      ).toString()}`,
      true,
    ),

  finishedStockFacets: () =>
    api.get<FinishedStockFacets>(
      '/inventory/finished-stock/facets',
      true,
    ),

  rawCoils: (filters: RawCoilFilters = {}) =>
    api.get<RawCoilRow[]>(
      `/inventory/raw-coils?${new URLSearchParams(
        buildRawQuery(filters),
      ).toString()}`,
      true,
    ),
};
