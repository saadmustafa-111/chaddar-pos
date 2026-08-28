import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
  Req,
  UseInterceptors,
  UploadedFile,
  StreamableFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { createReadStream } from 'fs';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { AttachmentsService } from './attachments.service';
import { AttachmentEntityType, Attachment } from './entities/attachment.entity';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_EXTENSIONS,
} from './storage.interface';

@Controller('attachments')
@UseGuards(SessionAuthGuard)
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
          return callback(
            new Error(
              `File type not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
            ),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async upload(
    @Body() dto: UploadAttachmentDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: { session?: { username?: string } },
  ): Promise<Attachment> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    return this.attachmentsService.upload(dto, file, req.session?.username);
  }

  @Get()
  async findByEntity(
    @Query('entityType') entityType: string,
    @Query('entityId', ParseIntPipe) entityId: number,
  ): Promise<Attachment[]> {
    return this.attachmentsService.findByEntity(
      entityType as AttachmentEntityType,
      entityId,
    );
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Attachment> {
    return this.attachmentsService.findOne(id);
  }

  @Get(':id/download')
  async download(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<StreamableFile> {
    const { attachment, filePath } =
      await this.attachmentsService.getFileStream(id);
    const stream = createReadStream(filePath);
    const disposition = attachment.mimeType.startsWith('image/')
      ? `inline; filename="${encodeURIComponent(attachment.originalFilename)}"`
      : `attachment; filename="${encodeURIComponent(attachment.originalFilename)}"`;
    return new StreamableFile(stream, {
      type: attachment.mimeType,
      disposition,
    });
  }

  @Delete(':id')
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
  ): Promise<void> {
    if (entityType && entityId) {
      await this.attachmentsService.validateOwnership(
        id,
        entityType as AttachmentEntityType,
        parseInt(entityId, 10),
      );
    }
    await this.attachmentsService.delete(id);
  }
}
