import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessProfile } from './entities/business-profile.entity';
import { UpdateBusinessProfileDto } from './dto/update-business-profile.dto';
import { BrandingDto } from './dto/branding.dto';

const DEFAULT_SHOP_NAME = 'SteelCoil POS';

@Injectable()
export class BusinessProfileService {
  constructor(
    @InjectRepository(BusinessProfile)
    private readonly profileRepository: Repository<BusinessProfile>,
  ) {}

  async getProfile(): Promise<BusinessProfile> {
    let profile = await this.profileRepository.findOne({ where: {} });
    if (!profile) {
      profile = this.profileRepository.create({
        shopName: DEFAULT_SHOP_NAME,
        address: null,
        phone: null,
        taxNumber: null,
        footerMessage: 'Thank you for your business.',
      });
      profile = await this.profileRepository.save(profile);
    }
    return profile;
  }

  async updateProfile(dto: UpdateBusinessProfileDto): Promise<BusinessProfile> {
    const profile = await this.getProfile();
    if (dto.shopName !== undefined) profile.shopName = dto.shopName;
    if (dto.address !== undefined) profile.address = dto.address;
    if (dto.phone !== undefined) profile.phone = dto.phone;
    if (dto.taxNumber !== undefined) profile.taxNumber = dto.taxNumber;
    if (dto.footerMessage !== undefined)
      profile.footerMessage = dto.footerMessage;
    if (dto.logoUrl !== undefined) profile.logoUrl = dto.logoUrl;
    return this.profileRepository.save(profile);
  }

  async getBranding(): Promise<BrandingDto> {
    const profile = await this.getProfile();
    return {
      shopName: profile.shopName,
      logoUrl: profile.logoUrl,
    };
  }
}
