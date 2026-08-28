import { api } from '../../auth/api/client';

export type FinishedChaddarStatus =
  | 'AVAILABLE'
  | 'PARTIALLY_SOLD'
  | 'SOLD_OUT'
  | 'CANCELLED';

export const FinishedChaddarStatus = {
  AVAILABLE: 'AVAILABLE',
  PARTIALLY_SOLD: 'PARTIALLY_SOLD',
  SOLD_OUT: 'SOLD_OUT',
  CANCELLED: 'CANCELLED',
} as const;

export const finishedChaddarStatusLabels: Record<
  FinishedChaddarStatus,
  string
> = {
  AVAILABLE: 'Available',
  PARTIALLY_SOLD: 'Partially Sold',
  SOLD_OUT: 'Sold Out',
  CANCELLED: 'Cancelled',
};

export const finishedChaddarStatusColors: Record<
  FinishedChaddarStatus,
  'green' | 'yellow' | 'zinc' | 'red'
> = {
  AVAILABLE: 'green',
  PARTIALLY_SOLD: 'yellow',
  SOLD_OUT: 'zinc',
  CANCELLED: 'red',
};

export interface FinishedChaddarStockPriceCategory {
  id: number;
  code: string;
  name: string;
  sellingRatePaisa: number;
  isActive: boolean;
}

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
  /** Average KG per piece, persisted at production time. Used by POS. */
  weightPerPieceKg: number | null;
  finishedCostPerKgPaisa: number;
  totalProductionCostPaisa: number;
  status: FinishedChaddarStatus;
  productionDate: string;
  createdAt: string;
  updatedAt: string;
  priceCategory: FinishedChaddarStockPriceCategory | null;
}

export type SaleStatus = 'COMPLETED';
export type SalePaymentStatus = 'PAID' | 'PARTIAL' | 'UNPAID';

export const salePaymentStatusLabels: Record<SalePaymentStatus, string> = {
  PAID: 'Paid',
  PARTIAL: 'Partial',
  UNPAID: 'Unpaid',
};

export const salePaymentStatusColors: Record<
  SalePaymentStatus,
  'green' | 'yellow' | 'red'
> = {
  PAID: 'green',
  PARTIAL: 'yellow',
  UNPAID: 'red',
};

export interface SaleItem {
  id: number;
  saleId: number;
  finishedStockId: number;
  cuttingBatchId: number;
  sourceCoilId: number;
  sizeLabel: string;
  piecesSold: number;
  weightSoldKg: number;
  sellingRatePaisa: number;
  finishedCostPerKgPaisa: number;
  lineRevenuePaisa: number;
  lineCostPaisa: number;
  lineGrossProfitPaisa: number;
  note: string | null;
  createdAt: string;
}

export interface Sale {
  id: number;
  code: string;
  customerId: number | null;
  customer: {
    id: number;
    code: string;
    name: string;
    phone: string | null;
  } | null;
  saleDate: string;
  totalAmountPaisa: number;
  totalCostPaisa: number;
  grossProfitPaisa: number;
  paidAmountPaisa: number;
  dueAmountPaisa: number;
  paymentStatus: SalePaymentStatus;
  status: SaleStatus;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaleWithItems {
  sale: Sale;
  items: SaleItem[];
}

export interface CreateSaleItemRequest {
  finishedStockId: number;
  piecesSold: number;
  /** Optional — derived from pieces × weight-per-piece when omitted. */
  weightSoldKg?: number;
  /** Optional — uses price category default when omitted. */
  sellingRatePaisa?: number;
  note?: string;
}

export interface CreateSaleRequest {
  customerId?: number;
  paidAmountPaisa?: number;
  saleDate: string;
  note?: string;
  /**
   * Optional client-generated UUID per submit attempt. When the POS
   * dispatches the request twice (e.g. operator double-click), the
   * server returns the existing sale instead of creating a duplicate
   * that would re-deduct finished stock and re-credit the customer.
   */
  idempotencyKey?: string;
  items: CreateSaleItemRequest[];
}

export interface WeightPerPieceSuggestion {
  sizeLabel: string;
  weightPerPieceKg: number | null;
  source: 'HISTORY' | 'NONE';
  sampleCount: number;
}

export interface AdjustStockWeightRequest {
  remainingWeightKg: number;
}

export const finishedChaddarStockApi = {
  findAll: () =>
    api.get<FinishedChaddarStock[]>('/finished-chaddar-stock', true),

  findOne: (id: number) =>
    api.get<FinishedChaddarStock>(`/finished-chaddar-stock/${id}`, true),

  adjustWeight: (id: number, remainingWeightKg: number) =>
    api.patch<FinishedChaddarStock>(
      `/finished-chaddar-stock/${id}/adjust-weight`,
      { remainingWeightKg },
      true,
    ),
};

export const suggestWeightApi = {
  forSize: (coilId: number, sizeLabel: string) =>
    api.get<WeightPerPieceSuggestion>(
      `/cutting-batches/suggest-weight?coilId=${coilId}&sizeLabel=${encodeURIComponent(sizeLabel)}`,
      true,
    ),
};

export const salesApi = {
  findAll: () => api.get<SaleWithItems[]>('/sales', true),

  findOne: (id: number) => api.get<SaleWithItems>(`/sales/${id}`, true),

  findByCustomer: (customerId: number) =>
    api.get<SaleWithItems[]>(`/sales?customerId=${customerId}`, true),

  create: (data: CreateSaleRequest) =>
    api.post<SaleWithItems>('/sales', data, true),
};

/**
 * Compute sold weight in KG from sold pieces using the stock's persisted
 * weight-per-piece. Returns 0 when no reliable weight-per-piece exists.
 */
export function deriveSoldWeightKg(
  stock: Pick<FinishedChaddarStock, 'weightPerPieceKg' | 'piecesProduced' | 'totalWeightKg'>,
  piecesSold: number,
): number {
  if (!piecesSold || piecesSold <= 0) return 0;
  if (
    stock.weightPerPieceKg != null &&
    Number(stock.weightPerPieceKg) > 0
  ) {
    return Math.round(piecesSold * Number(stock.weightPerPieceKg) * 1000) / 1000;
  }
  if (stock.piecesProduced > 0 && stock.totalWeightKg > 0) {
    const wpp = Number(stock.totalWeightKg) / Number(stock.piecesProduced);
    return Math.round(piecesSold * wpp * 1000) / 1000;
  }
  return 0;
}

/**
 * Resolve the default selling rate in paisa for a stock — uses the
 * category's `sellingRatePaisa` when available, otherwise 0.
 */
export function deriveDefaultSellingRatePaisa(
  stock: FinishedChaddarStock,
): number {
  const rate = stock.priceCategory?.sellingRatePaisa;
  return rate != null ? Number(rate) : 0;
}
