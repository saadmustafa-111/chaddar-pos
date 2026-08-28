import { Controller, Get } from '@nestjs/common';
import { BusinessProfileService } from './business-profile.service';
import { BrandingDto } from './dto/branding.dto';

@Controller('branding')
export class BrandingController {
  constructor(
    private readonly businessProfileService: BusinessProfileService,
  ) {}

  @Get()
  async getBranding(): Promise<BrandingDto> {
    return this.businessProfileService.getBranding();
  }
}
