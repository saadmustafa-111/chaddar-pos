import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PriceCategory } from './entities/price-category.entity';
import { UpdatePriceCategoryDto } from './dto/update-price-category.dto';
import {
  FinishedChaddarStock,
  FinishedChaddarStatus,
} from '../finished-chaddar-stock/entities/finished-chaddar-stock.entity';
import { Coil } from '../coils/entities/coil.entity';

export interface PriceCategoryCostSummary {
  currentCostPerKgPaisa: number | null;
  marginPerKgPaisa: number | null;
  marginPercentPaisa: number | null;
}

export interface PriceCategoryWithCost extends PriceCategory {
  currentCostPerKgPaisa: number | null;
  marginPerKgPaisa: number | null;
  marginPercentPaisa: number | null;
}

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
    @InjectRepository(FinishedChaddarStock)
    private readonly finishedStockRepository: Repository<FinishedChaddarStock>,
    @InjectRepository(Coil)
    private readonly coilRepository: Repository<Coil>,
  ) {}

  private async getCostSummary(
    categoryId: number,
    sellingRatePaisa: number,
  ): Promise<PriceCategoryCostSummary> {
    const rows = await this.finishedStockRepository
      .createQueryBuilder('stock')
      .select('stock.remaining_weight_kg', 'weightKg')
      .addSelect('stock.finished_cost_per_kg_paisa', 'costPaisa')
      .where('stock.price_category_id = :categoryId', { categoryId })
      .andWhere('stock.status IN (:...statuses)', {
        statuses: [
          FinishedChaddarStatus.AVAILABLE,
          FinishedChaddarStatus.PARTIALLY_SOLD,
        ],
      })
      .andWhere('stock.remaining_weight_kg > 0')
      .getRawMany<{ weightKg: string | number; costPaisa: string | number }>();

    if (rows.length === 0) {
      return {
        currentCostPerKgPaisa: null,
        marginPerKgPaisa: null,
        marginPercentPaisa: null,
      };
    }

    let totalValuePaisa = 0;
    let totalWeightKg = 0;
    for (const r of rows) {
      totalValuePaisa += Number(r.weightKg) * Number(r.costPaisa);
      totalWeightKg += Number(r.weightKg);
    }

    if (totalWeightKg <= 0) {
      return {
        currentCostPerKgPaisa: null,
        marginPerKgPaisa: null,
        marginPercentPaisa: null,
      };
    }

    const currentCostPerKgPaisa = Math.round(totalValuePaisa / totalWeightKg);
    const marginPerKgPaisa = sellingRatePaisa - currentCostPerKgPaisa;
    const marginPercentPaisa = Math.round(
      (marginPerKgPaisa / currentCostPerKgPaisa) * 10000,
    );

    return {
      currentCostPerKgPaisa,
      marginPerKgPaisa,
      marginPercentPaisa,
    };
  }

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
          sellingRatePaisa: 0,
          isActive: true,
        });
        await this.priceCategoryRepository.save(entity);
      }
    }
  }

  async findAll(): Promise<PriceCategoryWithCost[]> {
    const categories = await this.priceCategoryRepository.find({
      order: { code: 'ASC' },
    });
    return Promise.all(
      categories.map(async (cat) => {
        const cost = await this.getCostSummary(cat.id, cat.sellingRatePaisa);
        return { ...cat, ...cost };
      }),
    );
  }

  async findActive(): Promise<PriceCategoryWithCost[]> {
    const categories = await this.priceCategoryRepository.find({
      where: { isActive: true },
      order: { code: 'ASC' },
    });
    return Promise.all(
      categories.map(async (cat) => {
        const cost = await this.getCostSummary(cat.id, cat.sellingRatePaisa);
        return { ...cat, ...cost };
      }),
    );
  }

  async update(
    id: number,
    updateDto: UpdatePriceCategoryDto,
  ): Promise<PriceCategoryWithCost> {
    const category = await this.priceCategoryRepository.findOne({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Price category not found');
    }

    if (updateDto.sellingRatePaisa !== undefined) {
      category.sellingRatePaisa = updateDto.sellingRatePaisa;
    }

    if (updateDto.isActive !== undefined) {
      category.isActive = updateDto.isActive;
    }

    const saved = await this.priceCategoryRepository.save(category);
    const cost = await this.getCostSummary(saved.id, saved.sellingRatePaisa);
    return { ...saved, ...cost };
  }

  async delete(id: number): Promise<void> {
    const category = await this.priceCategoryRepository.findOne({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException('Price category not found');
    }

    const coilCount = await this.coilRepository.count({
      where: { priceCategoryId: id },
    });
    if (coilCount > 0) {
      throw new BadRequestException(
        `Cannot delete "${category.name}" because ${coilCount} coil(s) reference it. Remove or reassign those coils first.`,
      );
    }

    const stockCount = await this.finishedStockRepository.count({
      where: { priceCategoryId: id },
    });
    if (stockCount > 0) {
      throw new BadRequestException(
        `Cannot delete "${category.name}" because ${stockCount} finished stock entry/entries reference it. Remove or reassign those records first.`,
      );
    }

    await this.priceCategoryRepository.remove(category);
  }
}
