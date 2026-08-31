import { api } from '../../auth/api/client';

export interface BusinessProfile {
  id: number;
  shopName: string;
  address: string | null;
  phone: string | null;
  taxNumber: string | null;
  footerMessage: string | null;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateBusinessProfileRequest {
  shopName?: string;
  address?: string;
  phone?: string;
  taxNumber?: string;
  footerMessage?: string;
  logoUrl?: string;
}

export interface LogoUploadResponse {
  logoUrl: string;
}

export const businessProfileApi = {
  get: () => api.get<BusinessProfile>('/business-profile', true),
  update: (data: UpdateBusinessProfileRequest) =>
    api.put<BusinessProfile>('/business-profile', data, true),
  uploadLogo: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'}/business-profile/logo`,
      {
        method: 'POST',
        credentials: 'include',
        body: formData,
      },
    ).then((res) => {
      if (!res.ok) {
        return res.json().then((d) => { throw new Error(d.message ?? 'Upload failed'); });
      }
      return res.json() as Promise<LogoUploadResponse>;
    });
  },
};