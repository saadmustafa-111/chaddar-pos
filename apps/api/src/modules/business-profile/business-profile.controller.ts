import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BusinessProfileService } from './business-profile.service';
import { UpdateBusinessProfileDto } from './dto/update-business-profile.dto';
import { BusinessProfile } from './entities/business-profile.entity';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { LocalStorageService } from '../attachments/local-storage.service';

const ALLOWED_LOGO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024;

@Controller('business-profile')
@UseGuards(SessionAuthGuard)
export class BusinessProfileController {
  constructor(
    private readonly businessProfileService: BusinessProfileService,
    private readonly storageService: LocalStorageService,
  ) {}

  @Get()
  async getProfile(): Promise<BusinessProfile> {
    return this.businessProfileService.getProfile();
  }

  @Put()
  async updateProfile(
    @Body() dto: UpdateBusinessProfileDto,
  ): Promise<BusinessProfile> {
    return this.businessProfileService.updateProfile(dto);
  }

  @Post('logo')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_LOGO_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_LOGO_TYPES.has(file.mimetype)) {
          return callback(
            new BadRequestException(
              'Invalid file type. Only JPG, PNG, and WebP images are allowed.',
            ),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async uploadLogo(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ logoUrl: string }> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const stored = await this.storageService.store(file, 'BUSINESS_PROFILE', 1);
    const logoUrl = this.storageService.getPublicUrl(stored.storedFilename);
    return { logoUrl };
  }
}
