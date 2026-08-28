const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export type AttachmentEntityType =
  | 'SUPPLIER'
  | 'CUSTOMER'
  | 'PURCHASE'
  | 'SALE'
  | 'PURCHASE_PAYMENT'
  | 'CUSTOMER_PAYMENT'
  | 'EXPENSE'
  | 'COIL'
  | 'COIL_LANDING_EXPENSE'
  | 'OTHER';

export type DocumentType =
  | 'RECEIPT'
  | 'INVOICE'
  | 'PAYMENT_PROOF'
  | 'DELIVERY_CHALLAN'
  | 'PURCHASE_DOCUMENT'
  | 'CNIC'
  | 'OTHER';

export interface Attachment {
  id: number;
  entityType: AttachmentEntityType;
  entityId: number;
  documentType: DocumentType;
  originalFilename: string;
  storedFilename: string;
  mimeType: string;
  sizeBytes: number;
  note: string | null;
  uploadedBy: string | null;
  uploadedAt: string;
}

export interface UploadAttachmentRequest {
  entityType: AttachmentEntityType;
  entityId: number;
  documentType: DocumentType;
  note?: string;
}

export const documentTypeLabels: Record<DocumentType, string> = {
  RECEIPT: 'Receipt',
  INVOICE: 'Invoice',
  PAYMENT_PROOF: 'Payment Proof',
  DELIVERY_CHALLAN: 'Delivery Challan',
  PURCHASE_DOCUMENT: 'Purchase Document',
  CNIC: 'CNIC/Business Doc',
  OTHER: 'Other',
};

export const attachmentEntityTypeLabels: Record<AttachmentEntityType, string> = {
  SUPPLIER: 'Supplier',
  CUSTOMER: 'Customer',
  PURCHASE: 'Purchase',
  SALE: 'Sale',
  PURCHASE_PAYMENT: 'Purchase Payment',
  CUSTOMER_PAYMENT: 'Customer Payment',
  EXPENSE: 'Expense',
  COIL: 'Coil',
  COIL_LANDING_EXPENSE: 'Landing Expense',
  OTHER: 'Other',
};

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const fetchOptions: RequestInit = {
    ...options,
    headers,
    credentials: 'include',
  };

  const response = await fetch(`${API_URL}${endpoint}`, fetchOptions);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || 'Request failed');
  }

  return response.json();
}

async function requestUpload<T>(endpoint: string, formData: FormData): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Upload failed' }));
    throw new Error(error.message || 'Upload failed');
  }

  return response.json();
}

export const attachmentsApi = {
  findByEntity: (entityType: AttachmentEntityType, entityId: number) =>
    request<Attachment[]>(`/attachments?entityType=${entityType}&entityId=${entityId}`, { method: 'GET' }),

  findOne: (id: number) =>
    request<Attachment>(`/attachments/${id}`, { method: 'GET' }),

  upload: async (
    file: File,
    dto: UploadAttachmentRequest,
  ): Promise<Attachment> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityType', dto.entityType);
    formData.append('entityId', String(dto.entityId));
    formData.append('documentType', dto.documentType);
    if (dto.note) {
      formData.append('note', dto.note);
    }
    return requestUpload<Attachment>('/attachments/upload', formData);
  },

  delete: (id: number, entityType?: AttachmentEntityType, entityId?: number) => {
    let url = `/attachments/${id}`;
    if (entityType && entityId) {
      url += `?entityType=${entityType}&entityId=${entityId}`;
    }
    return request<void>(url, { method: 'DELETE' });
  },

  getDownloadUrl: (id: number): string => {
    return `${API_URL}/attachments/${id}/download`;
  },

  getPreviewUrl: (id: number): string => {
    return `${API_URL}/attachments/${id}/download`;
  },
};
