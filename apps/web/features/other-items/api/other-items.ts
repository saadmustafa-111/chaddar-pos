import { api } from '../../auth/api/client';

export interface OtherItem {
  id: number;
  name: string;
  pricePaisa: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOtherItemRequest {
  name: string;
  pricePaisa: number;
  note?: string;
}

export interface UpdateOtherItemRequest {
  name?: string;
  pricePaisa?: number;
  note?: string;
}

export const otherItemsApi = {
  findAll: (search?: string) => {
    const url = search ? `/other-items?search=${encodeURIComponent(search)}` : '/other-items';
    return api.get<OtherItem[]>(url, true);
  },

  findOne: (id: number) =>
    api.get<OtherItem>(`/other-items/${id}`, true),

  create: (data: CreateOtherItemRequest) =>
    api.post<OtherItem>('/other-items', data, true),

  update: (id: number, data: UpdateOtherItemRequest) =>
    api.patch<OtherItem>(`/other-items/${id}`, data, true),

  remove: (id: number) =>
    api.delete<void>(`/other-items/${id}`, true),
};
