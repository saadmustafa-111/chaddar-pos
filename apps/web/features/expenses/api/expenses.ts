import { api } from '../../auth/api/client';

export interface Expense {
  id: number;
  expenseDate: string;
  category: string;
  customCategory: string | null;
  amountPaisa: number;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export enum ExpenseCategory {
  LABOUR = 'LABOUR',
  TRANSPORT = 'TRANSPORT',
  ELECTRICITY = 'ELECTRICITY',
  RENT = 'RENT',
  FUEL = 'FUEL',
  LOADING_UNLOADING = 'LOADING_UNLOADING',
  MAINTENANCE_REPAIR = 'MAINTENANCE_REPAIR',
  OFFICE_EXPENSE = 'OFFICE_EXPENSE',
  FOOD_REFRESHMENT = 'FOOD_REFRESHMENT',
  MISCELLANEOUS = 'MISCELLANEOUS',
  OTHER = 'OTHER',
}

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  [ExpenseCategory.LABOUR]: 'Labour',
  [ExpenseCategory.TRANSPORT]: 'Transport',
  [ExpenseCategory.ELECTRICITY]: 'Electricity',
  [ExpenseCategory.RENT]: 'Rent',
  [ExpenseCategory.FUEL]: 'Fuel',
  [ExpenseCategory.LOADING_UNLOADING]: 'Loading / Unloading',
  [ExpenseCategory.MAINTENANCE_REPAIR]: 'Maintenance / Repair',
  [ExpenseCategory.OFFICE_EXPENSE]: 'Office Expense',
  [ExpenseCategory.FOOD_REFRESHMENT]: 'Food / Refreshment',
  [ExpenseCategory.MISCELLANEOUS]: 'Miscellaneous',
  [ExpenseCategory.OTHER]: 'Other / Custom',
};

export interface ExpenseSummary {
  totalExpensesPaisa: number;
  byCategory: { category: string; total: number }[];
}

export interface CreateExpenseDto {
  expenseDate: string;
  category: ExpenseCategory;
  customCategory?: string;
  amountPaisa: number;
  note?: string;
}

export interface UpdateExpenseDto {
  expenseDate?: string;
  category?: ExpenseCategory;
  customCategory?: string;
  amountPaisa?: number;
  note?: string;
}

export const expensesApi = {
  findAll: (params?: {
    dateFrom?: string;
    dateTo?: string;
    category?: ExpenseCategory;
    search?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.dateFrom) searchParams.set('dateFrom', params.dateFrom);
    if (params?.dateTo) searchParams.set('dateTo', params.dateTo);
    if (params?.category) searchParams.set('category', params.category);
    if (params?.search) searchParams.set('search', params.search);
    const qs = searchParams.toString();
    const url = qs ? `/expenses?${qs}` : '/expenses';
    return api.get<Expense[]>(url, true);
  },

  findOne: (id: number) =>
    api.get<Expense>(`/expenses/${id}`, true),

  getSummary: (params?: { dateFrom?: string; dateTo?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.dateFrom) searchParams.set('dateFrom', params.dateFrom);
    if (params?.dateTo) searchParams.set('dateTo', params.dateTo);
    const qs = searchParams.toString();
    const url = qs ? `/expenses/summary?${qs}` : '/expenses/summary';
    return api.get<ExpenseSummary>(url, true);
  },

  create: (data: CreateExpenseDto) =>
    api.post<Expense>('/expenses', data, true),

  update: (id: number, data: UpdateExpenseDto) =>
    api.patch<Expense>(`/expenses/${id}`, data, true),

  remove: (id: number) =>
    api.delete<void>(`/expenses/${id}`, true),
};
