import { api } from '../../auth/api/client';

export interface PriceCategory {
  id: number;
  code: string;
  name: string;
  sellingRatePaisa: number;
  isActive: boolean;
  currentCostPerKgPaisa: number | null;
  marginPerKgPaisa: number | null;
  marginPercentPaisa: number | null;
}

export interface UpdatePriceCategoryRequest {
  sellingRatePaisa?: number;
  isActive?: boolean;
}

export const priceCategoriesApi = {
  findAll: () =>
    api.get<PriceCategory[]>('/price-categories', true),

  findActive: () =>
    api.get<PriceCategory[]>('/price-categories/active', true),

  update: (id: number, data: UpdatePriceCategoryRequest) =>
    api.patch<PriceCategory>(`/price-categories/${id}`, data, true),

  remove: (id: number) =>
    api.delete<void>(`/price-categories/${id}`, true),
};

export function formatCategoryRate(paisa: number): string {
  return `Rs ${(Number(paisa) / 100).toFixed(2)}/KG`;
}