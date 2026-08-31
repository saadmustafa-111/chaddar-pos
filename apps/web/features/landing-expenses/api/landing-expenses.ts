import { api } from '../../auth/api/client';

export type LegacyExpenseType =
  | 'TRANSPORT'
  | 'FREIGHT'
  | 'LOADING'
  | 'UNLOADING'
  | 'HANDLING'
  | 'DELIVERY'
  | 'OTHER';

export const legacyExpenseTypeLabels: Record<LegacyExpenseType, string> = {
  TRANSPORT: 'Transport',
  FREIGHT: 'Freight',
  LOADING: 'Loading',
  UNLOADING: 'Unloading',
  HANDLING: 'Handling',
  DELIVERY: 'Delivery',
  OTHER: 'Other',
};

export interface LandingExpense {
  id: number;
  coilId: number;
  type: string;
  amountPaisa: number;
  description: string | null;
  referenceNumber: string | null;
  expenseDate: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLandingExpenseRequest {
  amountPaisa: number;
  expenseDate: string;
  description: string;
  referenceNumber?: string;
}

export interface UpdateLandingExpenseRequest {
  amountPaisa?: number;
  expenseDate?: string;
  description?: string;
  referenceNumber?: string;
}

export const landingExpensesApi = {
  findByCoil: (coilId: number) =>
    api.get<LandingExpense[]>(`/coils/${coilId}/landing-expenses`, true),

  create: (coilId: number, data: CreateLandingExpenseRequest) =>
    api.post<LandingExpense>(`/coils/${coilId}/landing-expenses`, data, true),

  update: (coilId: number, expenseId: number, data: UpdateLandingExpenseRequest) =>
    api.patch<LandingExpense>(
      `/coils/${coilId}/landing-expenses/${expenseId}`,
      data,
      true,
    ),

  remove: (coilId: number, expenseId: number) =>
    api.delete<void>(`/coils/${coilId}/landing-expenses/${expenseId}`, true),
};

export function getExpenseDisplayName(expense: LandingExpense): string {
  if (expense.description && expense.description.trim().length > 0) {
    return expense.description.trim();
  }
  const legacy = expense.type as LegacyExpenseType;
  return legacyExpenseTypeLabels[legacy] ?? expense.type ?? 'Expense';
}