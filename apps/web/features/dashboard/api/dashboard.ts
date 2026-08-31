import { api } from '../../auth/api/client';

export type DashboardRange = '7d' | '30d' | '3m' | '6m' | '1y';

export interface DashboardKpis {
  totalSalesPaisa: number;
  totalProfitPaisa: number;
  totalReceivedPaisa: number;
  totalReceivablePaisa: number;
  totalPayablePaisa: number;
  inventoryValuePaisa: number;
  totalSalesCount: number;
  todaysSalesPaisa: number;
  todaysSalesCount: number;
  todaysProfitPaisa: number;
  rawCoilKg: number;
  finishedStockKg: number;
  planeStockKg: number;
  totalExpensesPaisa: number;
  periodExpensesPaisa: number;
  netProfitPaisa: number;
}

export interface DashboardTimeSeriesPoint {
  bucket: string;
  label: string;
  salesPaisa: number;
  profitPaisa: number;
  salesCount: number;
}

export interface DashboardRecentSale {
  id: number;
  code: string;
  customerId: number | null;
  customerName: string | null;
  totalAmountPaisa: number;
  paidAmountPaisa: number;
  dueAmountPaisa: number;
  paymentStatus: string;
  saleDate: string;
}

export interface DashboardTopCustomer {
  id: number;
  code: string;
  name: string;
  phone: string | null;
  outstandingPaisa: number;
  totalSalesPaisa: number;
}

export interface DashboardTopSupplier {
  id: number;
  code: string;
  name: string;
  phone: string | null;
  outstandingPaisa: number;
  totalPurchasePaisa: number;
}

export interface DashboardReceivablesSummary {
  totalOutstandingPaisa: number;
  customersWithBalance: number;
  top: DashboardTopCustomer[];
}

export interface DashboardPayablesSummary {
  totalOutstandingPaisa: number;
  suppliersWithBalance: number;
  top: DashboardTopSupplier[];
}

export interface DashboardInventorySnapshot {
  rawCoilKg: number;
  finishedStockKg: number;
  planeStockKg: number;
  totalKg: number;
  totalValuePaisa: number;
  cashReceivedPaisa: number;
  receivablePaisa: number;
  payablePaisa: number;
}

export interface DashboardSummary {
  range: DashboardRange;
  rangeStart: string;
  rangeEnd: string;
  kpis: DashboardKpis;
  timeSeries: DashboardTimeSeriesPoint[];
  recentSales: DashboardRecentSale[];
  receivables: DashboardReceivablesSummary;
  payables: DashboardPayablesSummary;
  inventory: DashboardInventorySnapshot;
}

export const dashboardApi = {
  getSummary: (range: DashboardRange = '30d') =>
    api.get<DashboardSummary>(
      `/dashboard/summary?range=${range}`,
      true,
    ),
};

export const dashboardRangeLabels: Record<DashboardRange, string> = {
  '7d': '7 Days',
  '30d': '30 Days',
  '3m': '3 Months',
  '6m': '6 Months',
  '1y': '1 Year',
};

export const DASHBOARD_RANGES: DashboardRange[] = [
  '7d',
  '30d',
  '3m',
  '6m',
  '1y',
];