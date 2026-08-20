import { api } from '../../auth/api/client';

export interface MaterialFamily {
  id: number;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMaterialFamilyRequest {
  name: string;
  code?: string;
  description?: string;
  isActive?: boolean;
}

export type UpdateMaterialFamilyRequest = Partial<CreateMaterialFamilyRequest>;

export const materialFamiliesApi = {
  findAll: () => api.get<MaterialFamily[]>('/material-families', true),

  findActive: () => api.get<MaterialFamily[]>('/material-families/active', true),

  findOne: (id: number) => api.get<MaterialFamily>(`/material-families/${id}`, true),

  create: (data: CreateMaterialFamilyRequest) =>
    api.post<MaterialFamily>('/material-families', data, true),

  update: (id: number, data: UpdateMaterialFamilyRequest) =>
    api.post<MaterialFamily>(`/material-families/${id}`, data, true),
};