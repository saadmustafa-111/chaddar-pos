import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { BusinessProfile } from './entities/business-profile.entity';
import { BusinessProfileService } from './business-profile.service';
import { BusinessProfileController } from './business-profile.controller';
import { BrandingController } from './branding.controller';
import { LocalStorageService } from '../attachments/local-storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([BusinessProfile]),
    MulterModule.register({
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  ],
  controllers: [BusinessProfileController, BrandingController],
  providers: [BusinessProfileService, LocalStorageService],
  exports: [BusinessProfileService],
})
export class BusinessProfileModule {}
