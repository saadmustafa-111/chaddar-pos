import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import {
  IStorageService,
  StoredFile,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_EXTENSIONS,
} from './storage.interface';

@Injectable()
export class LocalStorageService implements IStorageService {
  private readonly uploadDir: string;
  private readonly baseUrl: string;

  constructor() {
    const attachmentsDir = process.env.ATTACHMENTS_DIR;
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction && !attachmentsDir) {
      throw new Error(
        'FATAL: ATTACHMENTS_DIR environment variable is not set. Cannot determine upload directory.',
      );
    }
    this.uploadDir =
      attachmentsDir ?? join(process.cwd(), 'data', 'attachments');
    this.baseUrl = process.env.ATTACHMENTS_BASE_URL ?? '/api/v1/attachments';
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.uploadDir, { recursive: true });
  }

  private sanitize(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);
  }

  async store(
    file: Express.Multer.File,
    entityType: string,
    entityId: number,
  ): Promise<StoredFile> {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new Error(
        `File type ${file.mimetype} is not allowed. Allowed: ${[...ALLOWED_MIME_TYPES].join(', ')}`,
      );
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(
        `File size exceeds ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB limit`,
      );
    }

    const ext =
      ALLOWED_EXTENSIONS.find((e) =>
        file.originalname.toLowerCase().endsWith(e),
      ) ?? '.bin';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    const storedFilename = `${entityType}_${entityId}_${timestamp}_${random}${ext}`;

    await this.ensureDir();
    const filePath = join(this.uploadDir, storedFilename);
    await fs.writeFile(filePath, file.buffer);

    return {
      storedFilename,
      originalFilename: this.sanitize(file.originalname),
      mimeType: file.mimetype,
      sizeBytes: file.size,
    };
  }

  getFilePath(storedFilename: string): string {
    return join(this.uploadDir, storedFilename);
  }

  getPublicUrl(storedFilename: string): string {
    return `${this.baseUrl}/${storedFilename}/download`;
  }

  async deleteFile(storedFilename: string): Promise<void> {
    const filePath = join(this.uploadDir, storedFilename);
    await fs.unlink(filePath);
  }

  async fileExists(storedFilename: string): Promise<boolean> {
    try {
      const filePath = join(this.uploadDir, storedFilename);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
