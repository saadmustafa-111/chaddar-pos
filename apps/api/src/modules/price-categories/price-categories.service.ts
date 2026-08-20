import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PriceCategory } from './entities/price-category.entity';
import { UpdatePriceCategoryDto } from './dto/update-price-category.dto';

const PRICE_CATEGORIES = [
  { code: 'BRONZE', name: 'Bronze' },
  { code: 'SILVER', name: 'Silver' },
  { code: 'GOLD', name: 'Gold' },
  { code: 'PLATINUM', name: 'Platinum' },
] as const;

@Injectable()
export class PriceCategoriesService {
  constructor(
    @InjectRepository(PriceCategory)
    private readonly priceCategoryRepository: Repository<PriceCategory>,
  ) {}

  async onModuleInit() {
    await this.seedCategories();
  }

  private async seedCategories(): Promise<void> {
    for (const category of PRICE_CATEGORIES) {
      const existing = await this.priceCategoryRepository.findOne({
        where: { code: category.code },
      });

      if (!existing) {
        const entity = this.priceCategoryRepository.create({
          code: category.code,
          name: category.name,
          purchaseRatePaisa: 0,
          sellingRatePaisa: 0,
          isActive: true,
        });
        await this.priceCategoryRepository.save(entity);
      }
    }
  }

  async findAll(): Promise<PriceCategory[]> {
    return this.priceCategoryRepository.find({
      order: { code: 'ASC' },
    });
  }

  async update(
    id: number,
    updateDto: UpdatePriceCategoryDto,
  ): Promise<PriceCategory> {
    const category = await this.priceCategoryRepository.findOne({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Price category not found');
    }

    if (updateDto.purchaseRatePaisa !== undefined) {
      category.purchaseRatePaisa = updateDto.purchaseRatePaisa;
    }

    if (updateDto.sellingRatePaisa !== undefined) {
      category.sellingRatePaisa = updateDto.sellingRatePaisa;
    }

    if (updateDto.isActive !== undefined) {
      category.isActive = updateDto.isActive;
    }

    return this.priceCategoryRepository.save(category);
  }
}
