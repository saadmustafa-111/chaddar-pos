import { api } from '../../auth/api/client';

export type InventoryStatus = 'RAW' | 'IN_PROCESS' | 'FINISHED' | 'DEPLETED';

export const InventoryStatus = {
  RAW: 'RAW',
  IN_PROCESS: 'IN_PROCESS',
  FINISHED: 'FINISHED',
  DEPLETED: 'DEPLETED',
} as const;

export type ProcessingStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export const ProcessingStatus = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
} as const;

export interface MaterialFamilySummary {
  id: number;
  code: string;
  name: string;
}

export interface PriceCategorySummary {
  id: number;
  code: string;
  name: string;
  purchaseRatePaisa: number;
  sellingRatePaisa: number;
  isActive: boolean;
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
  priceCategory: PriceCategorySummary | null;
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
  processingStatus: ProcessingStatus;
  processingDate: string | null;
  processingNote: string | null;
  wastageWeight: number;
  location: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  /**
   * Most recent kg/foot derived from the coil's own cutting history,
   * exposed by the backend so the operator sees a sensible preview
   * immediately when moving material to Plane Stock.
   */
  lastKgPerFoot?: number | null;
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

export interface UpdateProcessingRequest {
  processingStatus?: ProcessingStatus;
  processingDate?: string;
  processingNote?: string;
  wastageWeight?: number;
}

export interface UpdateCoilRequest {
  location?: string | null;
  notes?: string | null;
}

export interface FinishedCostSummary {
  coilId: number;
  coilCode: string;
  purchaseCostPaisa: number;
  additionalExpensesPaisa: number;
  totalInvestedCostPaisa: number;
  originalWeightKg: number;
  wastageWeightKg: number;
  remainingUsableWeightKg: number;
  finishedCostPerKgPaisa: number;
}

export interface CuttingBatchRow {
  lengthFt: number;
  quantity: number;
  pieceWeightKg: number;
  totalWeightKg: number;
}

export interface CuttingBatch {
  id: number;
  code: string;
  sourceCoilId: number;
  sizeLabel: string;
  widthMm: number | null;
  thicknessMm: number | null;
  color: string | null;
  brand: string | null;
  piecesProduced: number;
  cuttingWeightKg: number;
  /** Average KG per piece across all rows of this batch. */
  weightPerPieceKg: number | null;
  /** Number of 10-ft equivalent pieces the batch represents. */
  tenFtEquivalentQty: number | null;
  /** Average weight of one 10-ft piece based on the production formula. */
  avg10ftPieceWeightKg: number | null;
  /** Usable coil weight captured at production time. */
  usableCoilWeightKg: number | null;
  /** JSON snapshot of the cutting rows for auditability. */
  cutRowsJson: string | null;
  finishedCostPerKgPaisa: number;
  totalProductionCostPaisa: number;
  productionDate: string;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type FinishedChaddarStatus =
  | 'AVAILABLE'
  | 'PARTIALLY_SOLD'
  | 'SOLD_OUT'
  | 'CANCELLED';

export interface FinishedChaddarStock {
  id: number;
  code: string;
  cuttingBatchId: number;
  sourceCoilId: number;
  sizeLabel: string;
  widthMm: number | null;
  thicknessMm: number | null;
  color: string | null;
  brand: string | null;
  /** Length of one piece in feet (e.g. 8, 10, 12). */
  lengthFt: number | null;
  piecesProduced: number;
  totalWeightKg: number;
  remainingPieces: number;
  remainingWeightKg: number;
  /** Average KG per piece, persisted at production time. */
  weightPerPieceKg: number | null;
  finishedCostPerKgPaisa: number;
  totalProductionCostPaisa: number;
  status: FinishedChaddarStatus;
  productionDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CuttingBatchWithStock {
  cuttingBatch: CuttingBatch;
  finishedStock: FinishedChaddarStock;
}

export interface CreateCuttingRowRequest {
  lengthFt: number;
  quantity: number;
}

export interface CreateCuttingBatchRequest {
  sizeLabel: string;
  rows: CreateCuttingRowRequest[];
  /** Optional override for the usable coil weight (KG). */
  usableCoilWeightKg?: number;
  productionDate: string;
  note?: string;
}

export interface WeightPerPieceSuggestion {
  sizeLabel: string;
  weightPerPieceKg: number | null;
  source: 'HISTORY' | 'NONE';
  sampleCount: number;
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

  updateProcessing: (id: number, data: UpdateProcessingRequest) =>
    api.patch<Coil>(`/coils/${id}/processing`, data, true),

  getFinishedCost: (id: number) =>
    api.get<FinishedCostSummary>(`/coils/${id}/finished-cost`, true),

  update: (id: number, data: UpdateCoilRequest) =>
    api.patch<Coil>(`/coils/${id}`, data, true),

  delete: (id: number) => api.delete<void>(`/coils/${id}`, true),
};

export const cuttingBatchesApi = {
  findByCoil: (coilId: number) =>
    api.get<CuttingBatchWithStock[]>(
      `/coils/${coilId}/cutting-batches`,
      true,
    ),

  create: (coilId: number, data: CreateCuttingBatchRequest) =>
    api.post<CuttingBatchWithStock>(
      `/coils/${coilId}/cutting-batches`,
      data,
      true,
    ),

  suggestWeight: (coilId: number, sizeLabel: string) =>
    api.get<WeightPerPieceSuggestion>(
      `/cutting-batches/suggest-weight?coilId=${coilId}&sizeLabel=${encodeURIComponent(sizeLabel)}`,
      true,
    ),
};

export const finishedChaddarStockApi = {
  findAll: () =>
    api.get<FinishedChaddarStock[]>('/finished-chaddar-stock', true),

  findOne: (id: number) =>
    api.get<FinishedChaddarStock>(`/finished-chaddar-stock/${id}`, true),
};

export const processingStatusLabels: Record<ProcessingStatus, string> = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
};

export const inventoryStatusLabels: Record<InventoryStatus, string> = {
  RAW: 'Raw',
  IN_PROCESS: 'In Process',
  FINISHED: 'Finished',
  DEPLETED: 'Depleted',
};

export const finishedChaddarStatusLabels: Record<
  FinishedChaddarStatus,
  string
> = {
  AVAILABLE: 'Available',
  PARTIALLY_SOLD: 'Partially Sold',
  SOLD_OUT: 'Sold Out',
  CANCELLED: 'Cancelled',
};