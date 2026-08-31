export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];

export const STORAGE_SERVICE = 'STORAGE_SERVICE';

export interface StoredFile {
  storedFilename: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface IStorageService {
  store(
    file: Express.Multer.File,
    entityType: string,
    entityId: number,
  ): Promise<StoredFile>;
  getFilePath(storedFilename: string): string;
  getPublicUrl(storedFilename: string): string;
  deleteFile(storedFilename: string): Promise<void>;
  fileExists(storedFilename: string): Promise<boolean>;
}

export type StorageService = IStorageService;
