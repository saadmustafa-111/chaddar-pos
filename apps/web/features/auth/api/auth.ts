import { api } from './client';

export interface LoginRequest {
  password: string;
}

export interface LoginResponse {
  message: string;
}

export interface SessionResponse {
  authenticated: boolean;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordResponse {
  message: string;
}

export const authApi = {
  login: (password: string) =>
    api.post<LoginResponse>('/auth/login', { password }, true),

  logout: () =>
    api.post<{ message: string }>('/auth/logout', undefined, true),

  getSession: () =>
    api.get<SessionResponse>('/auth/session', true),

  changePassword: (data: ChangePasswordRequest) =>
    api.post<ChangePasswordResponse>('/auth/change-password', data, true),
};
