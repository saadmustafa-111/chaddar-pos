import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attachment, AttachmentEntityType } from './entities/attachment.entity';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';
import type { StoredFile, IStorageService } from './storage.interface';
import { STORAGE_SERVICE } from './storage.interface';
import { AttachmentEntityValidator } from './attachment-entity-validator';

@Injectable()
export class AttachmentsService {
  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: IStorageService,
    private readonly entityValidator: AttachmentEntityValidator,
  ) {}

  async upload(
    dto: UploadAttachmentDto,
    file: Express.Multer.File,
    uploadedBy?: string,
  ): Promise<Attachment> {
    if (dto.entityType !== AttachmentEntityType.OTHER) {
      await this.entityValidator.validateEntityExists(
        dto.entityType,
        dto.entityId,
      );
    }

    const stored: StoredFile = await this.storageService.store(
      file,
      dto.entityType,
      dto.entityId,
    );

    const attachment = this.attachmentRepository.create({
      entityType: dto.entityType,
      entityId: dto.entityId,
      documentType: dto.documentType,
      originalFilename: stored.originalFilename,
      storedFilename: stored.storedFilename,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
      note: dto.note ?? null,
      uploadedBy: uploadedBy ?? null,
    });

    return this.attachmentRepository.save(attachment);
  }

  async findByEntity(
    entityType: AttachmentEntityType,
    entityId: number,
  ): Promise<Attachment[]> {
    return this.attachmentRepository.find({
      where: { entityType, entityId },
      order: { uploadedAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Attachment> {
    const attachment = await this.attachmentRepository.findOne({
      where: { id },
    });
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }
    return attachment;
  }

  async getFileStream(
    id: number,
  ): Promise<{ attachment: Attachment; filePath: string }> {
    const attachment = await this.findOne(id);
    const filePath = this.storageService.getFilePath(attachment.storedFilename);
    const exists = await this.storageService.fileExists(
      attachment.storedFilename,
    );
    if (!exists) {
      throw new NotFoundException('File not found on disk');
    }
    return { attachment, filePath };
  }

  async delete(id: number): Promise<void> {
    const attachment = await this.findOne(id);
    await this.storageService.deleteFile(attachment.storedFilename);
    await this.attachmentRepository.remove(attachment);
  }

  async deleteByEntity(
    entityType: AttachmentEntityType,
    entityId: number,
  ): Promise<void> {
    const attachments = await this.findByEntity(entityType, entityId);
    for (const a of attachments) {
      await this.storageService.deleteFile(a.storedFilename);
    }
    await this.attachmentRepository.remove(attachments);
  }

  async validateOwnership(
    id: number,
    entityType: AttachmentEntityType,
    entityId: number,
  ): Promise<void> {
    const attachment = await this.findOne(id);
    if (
      attachment.entityType !== entityType ||
      attachment.entityId !== entityId
    ) {
      throw new BadRequestException(
        'Attachment does not belong to this entity',
      );
    }
  }
}
