import { api } from '../../auth/api/client';

export interface PriceCategory {
  id: number;
  code: string;
  name: string;
  purchaseRatePaisa: number;
  sellingRatePaisa: number;
  isActive: boolean;
}

export interface UpdatePriceCategoryRequest {
  purchaseRatePaisa?: number;
  sellingRatePaisa?: number;
  isActive?: boolean;
}

export const priceCategoriesApi = {
  findAll: () =>
    api.get<PriceCategory[]>('/price-categories', true),

  update: (id: number, data: UpdatePriceCategoryRequest) =>
    api.post<PriceCategory>(`/price-categories/${id}`, data, true),
};
