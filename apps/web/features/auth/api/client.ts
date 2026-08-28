const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

interface RequestOptions {
  method?: string;
  body?: unknown;
  credentials?: boolean;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, credentials = false } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const fetchOptions: RequestInit = {
    method,
    headers,
    credentials: credentials ? 'include' : undefined,
  };

  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${endpoint}`, fetchOptions);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || 'Request failed');
  }

  return response.json();
}

export const api = {
  post: <T>(endpoint: string, body?: unknown, credentials = false) =>
    request<T>(endpoint, { method: 'POST', body, credentials }),

  put: <T>(endpoint: string, body?: unknown, credentials = false) =>
    request<T>(endpoint, { method: 'PUT', body, credentials }),

  patch: <T>(endpoint: string, body?: unknown, credentials = false) =>
    request<T>(endpoint, { method: 'PATCH', body, credentials }),

  get: <T>(endpoint: string, credentials = false) =>
    request<T>(endpoint, { method: 'GET', credentials }),

  delete: <T>(endpoint: string, credentials = false) =>
    request<T>(endpoint, { method: 'DELETE', credentials }),
};
