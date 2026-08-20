import { api } from '../../auth/api/client';

export type LandingExpenseType =
  | 'TRANSPORT'
  | 'FREIGHT'
  | 'LOADING'
  | 'UNLOADING'
  | 'HANDLING'
  | 'DELIVERY'
  | 'OTHER';

export interface LandingExpense {
  id: number;
  coilId: number;
  type: LandingExpenseType;
  amountPaisa: number;
  description: string | null;
  referenceNumber: string | null;
  expenseDate: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLandingExpenseRequest {
  type: LandingExpenseType;
  amountPaisa: number;
  expenseDate: string;
  description?: string;
  referenceNumber?: string;
}

export interface UpdateLandingExpenseRequest {
  type?: LandingExpenseType;
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
    api.post<LandingExpense>(
      `/coils/${coilId}/landing-expenses/${expenseId}`,
      data,
      true,
    ),

  remove: (coilId: number, expenseId: number) =>
    api.delete<void>(`/coils/${coilId}/landing-expenses/${expenseId}`, true),
};