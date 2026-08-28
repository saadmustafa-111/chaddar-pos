import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import {
  AttachmentEntityType,
  DocumentType,
} from '../entities/attachment.entity';

export class UploadAttachmentDto {
  @IsEnum(AttachmentEntityType)
  entityType: AttachmentEntityType;

  @IsInt()
  entityId: number;

  @IsEnum(DocumentType)
  documentType: DocumentType;

  @IsOptional()
  @IsString()
  note?: string;
}
